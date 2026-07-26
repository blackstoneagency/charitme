import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { createClient } from '../../../../../../lib/supabase-server';
import { hoursForCheckout } from '../../../../../../lib/volunteer-shifts-core';

export const dynamic = 'force-dynamic';

// POST /api/volunteers/hours/[id]/check-out — the volunteer stops their clock.
// Hours stay `pending` here: recording time is not the same as certifying it,
// and only the organizer can do the latter.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: row } = await supabaseAdmin
    .from('volunteer_hours')
    .select('id, volunteer_user_id, checked_in_at, checked_out_at, status')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Only the volunteer may close their own clock. Not 404 — they can see the
  // row exists via their own list; a 403 is the honest answer.
  if (row.volunteer_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!row.checked_in_at) {
    return NextResponse.json({ error: 'This entry has no check-in to close.' }, { status: 409 });
  }
  if (row.checked_out_at) {
    return NextResponse.json({ error: 'Already checked out.' }, { status: 409 });
  }

  const checkedOutAt = new Date().toISOString();
  const { hours, capped } = hoursForCheckout(row.checked_in_at, checkedOutAt);

  const { data, error } = await supabaseAdmin
    .from('volunteer_hours')
    .update({ checked_out_at: checkedOutAt, hours })
    .eq('id', id)
    .is('checked_out_at', null) // optimistic guard against a double check-out
    .select('id, checked_in_at, checked_out_at, hours, status')
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Already checked out.' }, { status: 409 });

  // `capped` is surfaced, not swallowed: it means the elapsed time exceeded
  // MAX_SHIFT_HOURS and was clamped, which an organizer should look at before
  // verifying rather than discovering on an employer report.
  return NextResponse.json({ hours: data, capped });
}
