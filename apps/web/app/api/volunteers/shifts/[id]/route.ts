import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { isAdmin } from '../../../../../lib/roles';
import { canTransitionShift, type ShiftStatus } from '../../../../../lib/volunteer-shifts-core';

export const dynamic = 'force-dynamic';

const Body = z.object({ status: z.enum(['scheduled', 'cancelled', 'completed']) });

const REFUSAL_STATUS: Record<string, number> = {
  same_status: 409,
  already_cancelled: 409,
  not_a_transition: 400,
};

// PATCH /api/volunteers/shifts/[id] — the organizer cancels a shift or marks it
// complete.
//
// Cancelling stops FUTURE check-ins (canCheckIn refuses a cancelled shift). It
// deliberately does NOT touch hours already logged: a volunteer who turned up and
// worked is owed that time regardless of what later happens to the shift record,
// so cancellation is not a route to erasing attendance. See
// cancellationVoidsLoggedHours() for that rule stated in code.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const to = parsed.data.status as ShiftStatus;

  const { data: shift } = await supabaseAdmin
    .from('volunteer_shifts')
    .select('id, opportunity_id, status')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!shift) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: opp } = await supabaseAdmin
    .from('volunteer_opportunities')
    .select('id, created_by')
    .eq('id', shift.opportunity_id)
    .maybeSingle();
  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (opp.created_by !== user.id && !(await isAdmin(user.id, user.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const from = shift.status as ShiftStatus;
  const transition = canTransitionShift(from, to);
  if (!transition.allowed) {
    return NextResponse.json(
      { error: `Cannot change a shift from ${from} to ${to}.`, reason: transition.reason },
      { status: REFUSAL_STATUS[transition.reason ?? ''] ?? 409 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('volunteer_shifts')
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', from) // optimistic guard: only move from the state we validated
    .select('id, status')
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Shift changed concurrently — retry.' }, { status: 409 });

  return NextResponse.json({ shift: data });
}
