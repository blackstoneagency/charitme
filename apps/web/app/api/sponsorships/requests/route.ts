import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { isValidSponsorshipAmount, remainingSponsorshipSlots } from '../../../../lib/sponsorships';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  opportunityId: z.string().uuid(),
  amountCents: z.number().int().min(0).max(1_000_000_000),
  sponsorName: z.string().trim().max(120).optional(),
  message: z.string().trim().max(2000).optional(),
});

// GET /api/sponsorships/requests?opportunityId=  — organizer sees requests for
// their opportunity; otherwise the caller's own sponsorship requests.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const opportunityId = new URL(request.url).searchParams.get('opportunityId');

  if (opportunityId) {
    const { data: opp } = await supabaseAdmin.from('sponsorship_opportunities').select('organizer_id').eq('id', opportunityId).maybeSingle();
    if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (opp.organizer_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from('sponsorship_requests')
      .select('id, opportunity_id, sponsor_id, sponsor_name, amount_cents, message, deliverables, status, created_at')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ requests: data ?? [] });
  }

  const { data, error } = await supabaseAdmin
    .from('sponsorship_requests')
    .select('id, opportunity_id, sponsor_id, sponsor_name, amount_cents, message, deliverables, status, created_at')
    .eq('sponsor_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

// POST /api/sponsorships/requests — a sponsor offers to sponsor an opportunity.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const { opportunityId, amountCents, sponsorName, message } = parsed.data;

  const { data: opp } = await supabaseAdmin
    .from('sponsorship_opportunities')
    .select('id, organizer_id, min_amount_cents, slots, status')
    .eq('id', opportunityId)
    .maybeSingle();
  if (!opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
  if (opp.status !== 'open') return NextResponse.json({ error: 'This opportunity is not open', code: 'NOT_OPEN' }, { status: 409 });
  if (opp.organizer_id === user.id) return NextResponse.json({ error: 'You cannot sponsor your own opportunity', code: 'OWN' }, { status: 409 });
  if (!isValidSponsorshipAmount(amountCents, opp.min_amount_cents)) {
    return NextResponse.json({ error: 'Offer is below the minimum sponsorship amount', code: 'BELOW_MIN' }, { status: 409 });
  }

  const { count: filled } = await supabaseAdmin
    .from('sponsorship_requests')
    .select('id', { count: 'exact', head: true })
    .eq('opportunity_id', opportunityId)
    .in('status', ['accepted', 'agreed', 'fulfilled']);
  if (remainingSponsorshipSlots(opp.slots, filled ?? 0) === 0) {
    return NextResponse.json({ error: 'This sponsorship is fully committed', code: 'FULL' }, { status: 409 });
  }

  const { data: existing } = await supabaseAdmin
    .from('sponsorship_requests')
    .select('id, status')
    .eq('opportunity_id', opportunityId)
    .eq('sponsor_id', user.id)
    .maybeSingle();
  if (existing && !['withdrawn', 'declined'].includes(existing.status)) {
    return NextResponse.json({ error: 'You already have a request for this opportunity', code: 'ALREADY_REQUESTED' }, { status: 409 });
  }

  const row = { opportunity_id: opportunityId, sponsor_id: user.id, sponsor_name: sponsorName ?? null, amount_cents: amountCents, message: message ?? null, status: 'pending' as const };
  const { data: inserted, error } = existing
    ? await supabaseAdmin.from('sponsorship_requests').update(row).eq('id', existing.id).select().maybeSingle()
    : await supabaseAdmin.from('sponsorship_requests').insert(row).select().maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: inserted }, { status: 201 });
}
