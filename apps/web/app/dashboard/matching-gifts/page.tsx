import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import MatchingGiftsClient, { type ClaimView, type EligibleDonation } from './MatchingGiftsClient';

export const dynamic = 'force-dynamic';

type CampaignRef = { id: string; title: string; slug: string };

export default async function MatchingGiftsPage() {
  const user = await requireUser();

  // Existing claims for this donor.
  const { data: claimRows } = await supabaseAdmin
    .from('matching_gift_claims')
    .select('id, donation_id, campaign_id, employer_name, donation_amount_cents, match_ratio, estimated_match_cents, status, employer_reference, note, created_at')
    .eq('donor_id', user.id)
    .order('created_at', { ascending: false });

  const claims = claimRows ?? [];

  // The donor's completed donations, to offer as eligible for a claim.
  const { data: donationRows } = await supabaseAdmin
    .from('donations')
    .select('id, campaign_id, amount_cents, currency, created_at')
    .eq('donor_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(100);

  const donations = donationRows ?? [];

  const campaignIds = [...new Set([...claims.map((c) => c.campaign_id), ...donations.map((d) => d.campaign_id)])].filter(Boolean);
  const campaignMap = new Map<string, CampaignRef>();
  if (campaignIds.length > 0) {
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id, title, slug')
      .in('id', campaignIds);
    for (const c of (campaigns ?? []) as CampaignRef[]) campaignMap.set(c.id, c);
  }

  // A donation is eligible if it has no active (non-cancelled) claim.
  const activeClaimDonationIds = new Set(claims.filter((c) => c.status !== 'cancelled').map((c) => c.donation_id));

  const eligible: EligibleDonation[] = donations
    .filter((d) => !activeClaimDonationIds.has(d.id))
    .map((d) => ({
      id: d.id,
      amountCents: Number(d.amount_cents) || 0,
      currency: (d.currency as string) ?? 'usd',
      createdAt: d.created_at as string,
      campaignTitle: campaignMap.get(d.campaign_id)?.title ?? 'Campaign',
    }));

  const claimViews: ClaimView[] = claims.map((c) => ({
    id: c.id,
    donationId: c.donation_id,
    employerName: c.employer_name,
    donationAmountCents: Number(c.donation_amount_cents) || 0,
    matchRatio: Number(c.match_ratio) || 0,
    estimatedMatchCents: Number(c.estimated_match_cents) || 0,
    status: c.status,
    employerReference: c.employer_reference,
    note: c.note,
    createdAt: c.created_at as string,
    campaignTitle: campaignMap.get(c.campaign_id)?.title ?? 'Campaign',
    campaignSlug: campaignMap.get(c.campaign_id)?.slug ?? null,
  }));

  return (
    <CharitMeShell active="Matching Gifts">
      <TopBar
        title="Matching Gifts"
        subtitle="Many employers match employee donations dollar-for-dollar. File a match to multiply your impact — free."
      />
      <div className="kf-admin-dash">
        <MatchingGiftsClient initialClaims={claimViews} eligibleDonations={eligible} />
      </div>
    </CharitMeShell>
  );
}
