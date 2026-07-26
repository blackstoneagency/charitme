import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { createClient } from '../../../../../../lib/supabase-server';
import { isAdmin } from '../../../../../../lib/roles';

export const dynamic = 'force-dynamic';

const Body = z.object({ decision: z.enum(['verified', 'rejected']), notes: z.string().max(500).optional() });

// POST /api/volunteers/hours/[id]/verify — the opportunity owner (or an admin)
// certifies or rejects logged hours. This is the gate between "a volunteer says
// they were here" and a figure an employer will accept, so it is deliberately
// the only path that can set status='verified'.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { decision, notes } = parsed.data;

  const { data: row } = await supabaseAdmin
    .from('volunteer_hours')
    .select('id, opportunity_id, volunteer_user_id, status, checked_out_at')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: opp } = await supabaseAdmin
    .from('volunteer_opportunities')
    .select('id, created_by')
    .eq('id', row.opportunity_id)
    .maybeSingle();
  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const owner = opp.created_by === user.id;
  const admin = await isAdmin(user.id, user.email);
  if (!owner && !admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // A volunteer cannot certify their own time even if they happen to own the
  // opportunity. The database trigger cannot see this — from its side the actor
  // IS the owner — so it is enforced here, where both identities are known.
  if (row.volunteer_user_id === user.id && !admin) {
    return NextResponse.json(
      { error: 'You cannot verify your own volunteer hours.' },
      { status: 403 },
    );
  }

  if (decision === 'verified' && !row.checked_out_at) {
    return NextResponse.json({ error: 'Cannot verify hours that are still open.' }, { status: 409 });
  }

  const update: Record<string, unknown> = { status: decision };
  if (notes !== undefined) update.notes = notes;
  // Attribution must be explicit: this writes through the service-role client,
  // where auth.uid() is NULL, and the trigger rejects a verification that does
  // not name its verifier (migration 20260806010000).
  if (decision === 'verified') update.verified_by = user.id;

  const { data, error } = await supabaseAdmin
    .from('volunteer_hours')
    .update(update)
    .eq('id', id)
    .eq('status', row.status) // only move from the state we authorized against
    .select('id, status, verified_by, verified_at, hours')
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Entry changed concurrently — retry.' }, { status: 409 });

  return NextResponse.json({ hours: data });
}
