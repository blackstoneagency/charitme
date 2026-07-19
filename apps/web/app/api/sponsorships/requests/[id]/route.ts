import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import {
  RequestUpdateSchema,
  canTransitionRequest,
  committedAmountDelta,
  type RequestActor,
  type RequestStatus,
} from '../../../../../lib/sponsorships-core';
import { notify } from '../../../../../lib/notify';
import { sponsorshipOfferResolved } from '../../../../../lib/notify-core';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/sponsorships/requests/:id
// Organizer: accept / decline / fulfill. Sponsor: withdraw.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: req } = await supabaseAdmin
    .from('sponsorship_requests')
    .select('id, opportunity_id, sponsor_id, status, amount_cents')
    .eq('id', id)
    .maybeSingle();
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: opp } = await supabaseAdmin
    .from('sponsorship_opportunities')
    .select('organizer_id, raised_amount_cents, title')
    .eq('id', req.opportunity_id)
    .maybeSingle();
  if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });

  const isOrganizer = opp.organizer_id === user.id;
  const isSponsor = req.sponsor_id === user.id;
  if (!isOrganizer && !isSponsor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const actor: RequestActor = isOrganizer ? 'organizer' : 'sponsor';

  const body = await request.json().catch(() => null);
  const parsed = RequestUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { status } = parsed.data;

  if (status === req.status) {
    return NextResponse.json({ error: 'No change' }, { status: 400 });
  }
  if (!canTransitionRequest(actor, req.status as RequestStatus, status)) {
    return NextResponse.json(
      { error: `A ${actor} cannot move a request from ${req.status} to ${status}` },
      { status: 409 },
    );
  }

  const delta = committedAmountDelta(req.status as RequestStatus, status, req.amount_cents);
  if (delta !== 0) {
    const next = Math.max(0, opp.raised_amount_cents + delta);
    const { error: oppErr } = await supabaseAdmin
      .from('sponsorship_opportunities')
      .update({ raised_amount_cents: next })
      .eq('id', req.opportunity_id);
    if (oppErr) return NextResponse.json({ error: oppErr.message }, { status: 500 });
  }

  const { error } = await supabaseAdmin
    .from('sponsorship_requests')
    .update({ status })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the sponsor when the organizer resolves their offer.
  if (isOrganizer) {
    await notify(req.sponsor_id, sponsorshipOfferResolved(status, opp.title as string), { request_id: id });
  }

  return NextResponse.json({ ok: true });
}
