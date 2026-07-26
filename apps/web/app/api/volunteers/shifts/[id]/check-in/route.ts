import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { createClient } from '../../../../../../lib/supabase-server';
import { checkRateLimitDurable } from '../../../../../../lib/rate-limit-durable';
import { canCheckIn, isValidCheckInCode, formatCheckInCode } from '../../../../../../lib/volunteer-shifts-core';

export const dynamic = 'force-dynamic';

const Body = z.object({ code: z.string().min(1).max(32) });

/** Refusal reasons map to statuses a client can act on without parsing prose. */
const REFUSAL_STATUS: Record<string, number> = {
  shift_cancelled: 409,
  shift_full: 409,
  already_checked_in: 409,
  too_early: 425,
  shift_over: 410,
};

// POST /api/volunteers/shifts/[id]/check-in — a volunteer scans the shift QR (or
// types the code) and starts their clock.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Throttled per user even though the route is authenticated. The repo only
  // *requires* limits on unauthenticated mutations, but this endpoint takes a
  // guessable code: 32^8 is far too large to brute force in practice, and a
  // limit costs nothing, so there is no reason to leave the guessing surface
  // unbounded.
  if (!(await checkRateLimitDurable(`vol-checkin:${user.id}`, 20, 60_000))) {
    return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  if (!isValidCheckInCode(parsed.data.code)) {
    return NextResponse.json({ error: 'That check-in code is not valid.' }, { status: 400 });
  }

  const { data: shift } = await supabaseAdmin
    .from('volunteer_shifts')
    .select('id, opportunity_id, starts_at, ends_at, capacity, filled_count, status, checkin_code')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!shift) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Compare normalised forms so a scan with stray whitespace or lowercase still
  // matches, while a wrong code still fails.
  if (formatCheckInCode(shift.checkin_code ?? '') !== formatCheckInCode(parsed.data.code)) {
    return NextResponse.json({ error: 'That code does not match this shift.' }, { status: 403 });
  }

  // An open row is one with no check-out. The partial unique index enforces this
  // too; checking here lets us return a useful message instead of a 500.
  const { data: open } = await supabaseAdmin
    .from('volunteer_hours')
    .select('id')
    .eq('shift_id', id)
    .eq('volunteer_user_id', user.id)
    .is('checked_out_at', null)
    .is('deleted_at', null)
    .maybeSingle();

  const decision = canCheckIn(shift, { now: new Date(), hasOpenCheckIn: Boolean(open) });
  if (!decision.allowed) {
    return NextResponse.json(
      { error: 'Cannot check in', reason: decision.reason },
      { status: REFUSAL_STATUS[decision.reason ?? ''] ?? 409 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('volunteer_hours')
    .insert({
      shift_id: shift.id,
      opportunity_id: shift.opportunity_id,
      volunteer_user_id: user.id,
      checked_in_at: new Date().toISOString(),
      source: 'check_in',
      status: 'pending',
      hours: 0,
    })
    .select('id, checked_in_at, status')
    .single();

  if (error) {
    // 23505 = the partial unique index caught a concurrent double-scan.
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Cannot check in', reason: 'already_checked_in' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  // Best-effort occupancy, matching the applications route's consistency model.
  await supabaseAdmin
    .from('volunteer_shifts')
    .update({ filled_count: (shift.filled_count ?? 0) + 1 })
    .eq('id', shift.id);

  return NextResponse.json({ hours: data });
}
