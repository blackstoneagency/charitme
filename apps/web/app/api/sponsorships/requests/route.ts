import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { listSponsorRequests, listOpportunityRequests } from '../../../../lib/sponsorships';
import { RequestCreateSchema, isAcceptingRequests } from '../../../../lib/sponsorships-core';
import { notify } from '../../../../lib/notify';
import { sponsorshipOfferReceived } from '../../../../lib/notify-core';
import { formatMoneyShort } from '@shared/currencies';

// GET /api/sponsorships/requests            -> the signed-in sponsor's requests
// GET /api/sponsorships/requests?opportunityId=  -> requests to an owned opportunity
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const opportunityId = new URL(request.url).searchParams.get('opportunityId');
  if (opportunityId) {
    const { data: opp } = await supabaseAdmin
      .from('sponsorship_opportunities')
      .select('organizer_id')
      .eq('id', opportunityId)
      .maybeSingle();
    if (!opp || opp.organizer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ requests: await listOpportunityRequests(opportunityId) });
  }

  return NextResponse.json({ requests: await listSponsorRequests(user.id) });
}

// POST /api/sponsorships/requests — sponsor offers to sponsor an opportunity.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = RequestCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { opportunity_id, amount_cents, company_name, message, benefits_requested } = parsed.data;

  const { data: opp } = await supabaseAdmin
    .from('sponsorship_opportunities')
    .select('organizer_id, status, min_amount_cents, title, currency')
    .eq('id', opportunity_id)
    .maybeSingle();
  if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
  if (opp.organizer_id === user.id) {
    return NextResponse.json({ error: 'You cannot sponsor your own opportunity' }, { status: 400 });
  }
  if (!isAcceptingRequests(opp)) {
    return NextResponse.json({ error: 'This opportunity is not accepting sponsors' }, { status: 409 });
  }
  if (amount_cents < opp.min_amount_cents) {
    return NextResponse.json(
      { error: `Minimum sponsorship for this opportunity is ${opp.min_amount_cents} cents` },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin.from('sponsorship_requests').insert({
    opportunity_id,
    sponsor_id: user.id,
    company_name: company_name ?? null,
    amount_cents,
    message: message ?? null,
    benefits_requested: benefits_requested ?? null,
  });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You already have a request for this opportunity' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  await notify(
    opp.organizer_id,
    sponsorshipOfferReceived(
      company_name || 'A sponsor',
      formatMoneyShort(amount_cents, opp.currency ?? 'usd'),
      opp.title as string,
    ),
    { opportunity_id, amount_cents },
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
