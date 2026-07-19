import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { estimateMatchForEmployer } from '../../../lib/matching-gifts';
import { emailDomain, resolveCorporateMatch, type MatchingGiftRule } from '../../../lib/corporate';

export const dynamic = 'force-dynamic';

/**
 * If the donor belongs to a registered corporate account (by verified
 * membership or matching email domain), resolve the match against that
 * company's rules + caps. Returns null to fall back to the static estimator.
 */
async function resolveCorporate(opts: {
  userId: string;
  userEmail: string | null | undefined;
  donationCents: number;
  campaignId: string;
}): Promise<{ accountId: string; accountName: string; ratio: number; matchedCents: number } | null> {
  const { userId, userEmail, donationCents, campaignId } = opts;

  // Prefer an active membership; otherwise match the email domain.
  const { data: membership } = await supabaseAdmin
    .from('corporate_members')
    .select('corporate_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  let account: { id: string; name: string; default_match_ratio: number; annual_cap_cents: number | null; active: boolean } | null = null;
  if (membership) {
    const { data } = await supabaseAdmin
      .from('corporate_accounts')
      .select('id, name, default_match_ratio, annual_cap_cents, active')
      .eq('id', membership.corporate_id)
      .maybeSingle();
    account = data ?? null;
  } else {
    const domain = emailDomain(userEmail);
    if (domain) {
      const { data } = await supabaseAdmin
        .from('corporate_accounts')
        .select('id, name, default_match_ratio, annual_cap_cents, active')
        .eq('email_domain', domain)
        .maybeSingle();
      account = data ?? null;
    }
  }

  if (!account || !account.active) return null;

  const [{ data: ruleRows }, { data: campaign }] = await Promise.all([
    supabaseAdmin.from('matching_gift_rules').select('category, ratio, per_gift_cap_cents, annual_cap_cents, active').eq('corporate_id', account.id),
    supabaseAdmin.from('campaigns').select('category').eq('id', campaignId).maybeSingle(),
  ]);

  // Prior matched this calendar year (for the annual cap), for this donor + account.
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)).toISOString();
  const { data: priorClaims } = await supabaseAdmin
    .from('matching_gift_claims')
    .select('estimated_match_cents')
    .eq('donor_id', userId)
    .eq('corporate_account_id', account.id)
    .gte('created_at', yearStart)
    .in('status', ['submitted', 'requested_from_employer', 'approved', 'received']);
  const priorMatched = (priorClaims ?? []).reduce((s, c) => s + (Number(c.estimated_match_cents) || 0), 0);

  const rules: MatchingGiftRule[] = (ruleRows ?? []).map((r) => ({
    category: r.category, ratio: Number(r.ratio) || 0, perGiftCapCents: r.per_gift_cap_cents, annualCapCents: r.annual_cap_cents, active: r.active,
  }));

  const result = resolveCorporateMatch({
    account: { defaultMatchRatio: Number(account.default_match_ratio) || 1, annualCapCents: account.annual_cap_cents, active: account.active },
    rules,
    donationCents,
    category: (campaign?.category as string) ?? null,
    priorMatchedThisYearCents: priorMatched,
  });

  return { accountId: account.id, accountName: account.name, ratio: result.ratio, matchedCents: result.matchedCents };
}

const CreateSchema = z.object({
  donationId: z.string().uuid(),
  employerName: z.string().trim().min(2).max(120),
  note: z.string().trim().max(500).optional(),
});

// GET /api/matching-gifts
// Returns the signed-in donor's matching-gift claims, newest first, with the
// campaign title for display.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: claims, error } = await supabaseAdmin
    .from('matching_gift_claims')
    .select('id, donation_id, campaign_id, employer_name, donation_amount_cents, match_ratio, estimated_match_cents, status, employer_reference, note, created_at, updated_at')
    .eq('donor_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const campaignIds = [...new Set((claims ?? []).map((c) => c.campaign_id))];
  const titles: Record<string, { title: string; slug: string }> = {};
  if (campaignIds.length > 0) {
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id, title, slug')
      .in('id', campaignIds);
    for (const c of campaigns ?? []) titles[c.id] = { title: c.title, slug: c.slug };
  }

  return NextResponse.json({
    claims: (claims ?? []).map((c) => ({ ...c, campaign: titles[c.campaign_id] ?? null })),
  });
}

// POST /api/matching-gifts { donationId, employerName, note? }
// Files a matching-gift claim for one of the donor's own completed donations.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { donationId, employerName, note } = parsed.data;

  // The donation must belong to the signed-in donor and be completed.
  const { data: donation, error: donationError } = await supabaseAdmin
    .from('donations')
    .select('id, donor_id, campaign_id, amount_cents, status')
    .eq('id', donationId)
    .maybeSingle();

  if (donationError) return NextResponse.json({ error: donationError.message }, { status: 500 });
  if (!donation) return NextResponse.json({ error: 'Donation not found' }, { status: 404 });
  if (donation.donor_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (donation.status !== 'completed') {
    return NextResponse.json({ error: 'Only completed donations are eligible for a matching gift' }, { status: 409 });
  }

  // One claim per donation.
  const { data: existing } = await supabaseAdmin
    .from('matching_gift_claims')
    .select('id, status')
    .eq('donation_id', donationId)
    .maybeSingle();
  if (existing && existing.status !== 'cancelled') {
    return NextResponse.json({ error: 'A matching-gift claim already exists for this donation', code: 'ALREADY_CLAIMED' }, { status: 409 });
  }

  const amountCents = Number(donation.amount_cents) || 0;

  // Prefer a verified corporate-account match (rules + caps); fall back to the
  // static employer estimator.
  const corporate = await resolveCorporate({
    userId: user.id,
    userEmail: user.email,
    donationCents: amountCents,
    campaignId: donation.campaign_id,
  });
  const estimate = estimateMatchForEmployer(amountCents, employerName);

  const usedCorporate = corporate != null;
  const ratio = usedCorporate ? corporate!.ratio : estimate.ratio;
  const matchedCents = usedCorporate ? corporate!.matchedCents : estimate.estimatedMatchCents;

  const row = {
    donation_id: donationId,
    campaign_id: donation.campaign_id,
    donor_id: user.id,
    employer_name: usedCorporate ? corporate!.accountName : employerName,
    donation_amount_cents: amountCents,
    match_ratio: ratio,
    estimated_match_cents: matchedCents,
    corporate_account_id: usedCorporate ? corporate!.accountId : null,
    status: 'submitted' as const,
    note: note ?? null,
  };

  // Re-filing a previously cancelled claim replaces it (unique on donation_id).
  const { data: inserted, error: insertError } = existing
    ? await supabaseAdmin.from('matching_gift_claims').update(row).eq('id', existing.id).select().maybeSingle()
    : await supabaseAdmin.from('matching_gift_claims').insert(row).select().maybeSingle();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({
    claim: inserted,
    estimate: {
      matched: usedCorporate ? matchedCents > 0 : estimate.matched,
      ratio,
      estimatedMatchCents: matchedCents,
      source: usedCorporate ? 'corporate' : 'estimator',
    },
  }, { status: 201 });
}
