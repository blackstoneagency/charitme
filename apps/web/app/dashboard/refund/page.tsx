import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import RefundForm, { type RefundableDonation } from './RefundForm';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────
type DonationRow = {
  id: string;
  amount_cents: number;
  currency: string | null;
  status: string;
  created_at: string;
  campaign_id: string;
};

type RefundRow = {
  donation_id: string;
  status: string;
};

type CampaignRow = {
  id: string;
  title: string;
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function RefundPage({
  searchParams,
}: {
  searchParams?: Promise<{ donation_id?: string }>;
}) {
  const [user, sp] = await Promise.all([
    requireUser(),
    searchParams ?? Promise.resolve({} as { donation_id?: string }),
  ]);

  const preselectedId = sp.donation_id ?? null;

  // ── Fetch donor's completed donations from the last 90 days ───────────────
  // (60-day limit enforced by API; showing 90 here so donors can see recent
  //  ineligible donations and understand why they can't request a refund)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: rawDonations } = await supabaseAdmin
    .from('donations')
    .select('id, amount_cents, currency, status, created_at, campaign_id')
    .eq('donor_id', user.id)
    .in('status', ['completed', 'refunded'])
    .gte('created_at', ninetyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  const donations = (rawDonations ?? []) as DonationRow[];

  if (donations.length === 0) {
    // No donations in window — pass empty list directly
    return (
      <CharitMeShell active="Refund">
        <TopBar
          title="Request a Refund"
          subtitle="Submit a refund request for a recent donation."
        />
        <div className="kf-admin-dash" style={{ maxWidth: 640 }}>
          <RefundForm donations={[]} preselectedId={null} />
        </div>
      </CharitMeShell>
    );
  }

  // ── Resolve campaign titles ───────────────────────────────────────────────
  const campaignIds = [...new Set(donations.map((d) => d.campaign_id))];
  const { data: campaignData } = await supabaseAdmin
    .from('campaigns')
    .select('id, title')
    .in('id', campaignIds);

  const campaignMap = new Map<string, string>(
    ((campaignData ?? []) as CampaignRow[]).map((c) => [c.id, c.title]),
  );

  // ── Check which donations already have a pending/approved refund request ──
  const donationIds = donations.map((d) => d.id);
  const { data: existingRefunds } = await supabaseAdmin
    .from('refunds')
    .select('donation_id, status')
    .in('donation_id', donationIds);

  const pendingRefundSet = new Set(
    ((existingRefunds ?? []) as RefundRow[])
      .filter((r) => ['requested', 'approved'].includes(r.status))
      .map((r) => r.donation_id),
  );

  // ── Build enriched list ───────────────────────────────────────────────────
  const enriched: RefundableDonation[] = donations.map((d) => ({
    id: d.id,
    amount_cents: d.amount_cents,
    currency: d.currency,
    campaign_title: campaignMap.get(d.campaign_id) ?? 'Unknown Campaign',
    campaign_id: d.campaign_id,
    created_at: d.created_at,
    status: d.status,
    existing_request: pendingRefundSet.has(d.id) || d.status === 'refunded',
  }));

  return (
    <CharitMeShell active="Refund">
      <TopBar
        title="Request a Refund"
        subtitle="Select a donation and describe your reason. Our team reviews requests within 3–5 business days."
      />
      <div className="kf-admin-dash">
        <RefundForm donations={enriched} preselectedId={preselectedId} />
      </div>
    </CharitMeShell>
  );
}
