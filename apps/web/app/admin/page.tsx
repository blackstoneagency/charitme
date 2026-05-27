import 'server-only';
import { PageScaffold, type TableRow, type Metric } from '../../components/KindFundShellServer';
import { requireAdmin } from '../../lib/auth';
import { supabaseAdmin } from '../../lib/supabase';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function AdminDashboardPage() {
  await requireAdmin();

  // Parallel: user count, campaign count, donation amounts, payout amounts, recent campaigns
  const [
    { count: totalUsers },
    { count: totalCampaigns },
    { data: donationRows },
    { data: payoutRows },
    { data: recentCampaigns },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }),
    // NOTE: For large datasets, replace with a Supabase RPC for server-side SUM
    supabaseAdmin.from('donations').select('amount_cents').eq('status', 'completed'),
    supabaseAdmin.from('payouts').select('amount_cents').eq('status', 'paid'),
    supabaseAdmin
      .from('campaigns')
      .select('id, title, status, raised_amount, goal_amount, category, user_id')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const totalDonationsCents = (donationRows ?? []).reduce(
    (s, d) => s + ((d as { amount_cents: number }).amount_cents ?? 0), 0,
  );
  const totalPayoutsCents = (payoutRows ?? []).reduce(
    (s, p) => s + ((p as { amount_cents: number }).amount_cents ?? 0), 0,
  );

  // Resolve organizer names
  const campaignList = (recentCampaigns ?? []) as {
    id: string;
    title: string;
    status: string;
    raised_amount: number;
    goal_amount: number;
    category: string | null;
    user_id: string;
  }[];

  const organizerIds = [...new Set(campaignList.map(c => c.user_id))];
  const profileMap = new Map<string, string>();
  if (organizerIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', organizerIds);
    for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) {
      if (p.full_name) profileMap.set(p.id, p.full_name);
    }
  }

  const rows: TableRow[] = campaignList.map(c => ({
    title: c.title,
    subtitle: profileMap.get(c.user_id) ?? 'Unknown Organizer',
    status: capitalize(c.status),
    amount: fmtCents(c.raised_amount ?? 0),
    meta: [
      c.category ?? 'Uncategorized',
      `Goal: ${fmtCents(c.goal_amount ?? 0)}`,
    ],
  }));

  const metrics: Metric[] = [
    {
      label: 'Total Users',
      value: (totalUsers ?? 0).toLocaleString(),
      change: 'registered accounts',
      icon: 'users',
      tone: 'violet',
    },
    {
      label: 'Campaigns',
      value: (totalCampaigns ?? 0).toLocaleString(),
      change: 'all statuses',
      icon: 'stack',
      tone: 'green',
    },
    {
      label: 'Donations',
      value: fmtCents(totalDonationsCents),
      change: 'total completed',
      icon: 'gift',
      tone: 'blue',
    },
    {
      label: 'Payouts',
      value: fmtCents(totalPayoutsCents),
      change: 'total paid out',
      icon: 'wallet',
      tone: 'orange',
    },
  ];

  return (
    <PageScaffold
      mode="admin"
      active="Dashboard"
      title="Admin Dashboard"
      subtitle="Get a high-level overview of the platform and drill down into what matters."
      metrics={metrics}
      rows={rows}
      tabs={['Overview', 'Donations', 'Users', 'Payouts']}
    />
  );
}
