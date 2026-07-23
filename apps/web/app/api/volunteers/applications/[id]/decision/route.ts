import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { createClient } from '../../../../../../lib/supabase-server';
import { isAdmin } from '../../../../../../lib/roles';
import {
  canTransitionApplication,
  applicationSlotDelta,
  type VolunteerApplicationStatus,
} from '../../../../../../lib/volunteers';

export const dynamic = 'force-dynamic';

const DecisionSchema = z.object({
  decision: z.enum(['accepted', 'declined', 'completed']),
});

// POST /api/volunteers/applications/[id]/decision — the opportunity owner (or an
// admin) accepts / declines / completes an application. Accepting fills a slot;
// leaving "accepted" frees one. Capacity is enforced on accept.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = DecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const to = parsed.data.decision as VolunteerApplicationStatus;

  // Load the application and its opportunity (for ownership + capacity).
  const { data: app } = await supabaseAdmin
    .from('volunteer_applications')
    .select('id, status, opportunity_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: opp } = await supabaseAdmin
    .from('volunteer_opportunities')
    .select('id, created_by, slots, slots_filled')
    .eq('id', app.opportunity_id)
    .maybeSingle();
  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Authorize: opportunity owner or an admin may decide.
  const owner = opp.created_by === user.id;
  if (!owner && !(await isAdmin(user.id, user.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const from = app.status as VolunteerApplicationStatus;
  if (!canTransitionApplication(from, to, 'org')) {
    return NextResponse.json(
      { error: `Illegal transition: ${from} → ${to}.` },
      { status: 409 },
    );
  }

  // Capacity check when this decision fills a slot.
  const delta = applicationSlotDelta(from, to);
  if (delta > 0 && opp.slots != null && opp.slots_filled >= opp.slots) {
    return NextResponse.json({ error: 'This opportunity is full' }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from('volunteer_applications')
    .update({ status: to, decided_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', from) // optimistic guard: only move from the status we validated
    .select('id, status')
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Application changed concurrently — retry.' }, { status: 409 });

  // Reflect the slot change on the opportunity. Best-effort read-modify-write,
  // matching the apply route's consistency model; the status guard above keeps
  // the delta from being applied twice for the same decision.
  if (delta !== 0) {
    const next = Math.max(0, (opp.slots_filled ?? 0) + delta);
    await supabaseAdmin
      .from('volunteer_opportunities')
      .update({ slots_filled: next })
      .eq('id', opp.id);
  }

  return NextResponse.json({ application: data });
}
