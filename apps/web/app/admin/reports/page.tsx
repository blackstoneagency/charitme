import 'server-only';
import { PageScaffold, type TableRow, type Metric } from '../../../components/KindFundShellServer';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

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

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function AdminReportsPage() {
  await requireAdmin();

  // Aggregate platform stats for the reports overview
  const [
    { count: totalUsers },
    { count: totalCampaigns },
    { count: activeCampaigns },
    { count: completedCampaigns },
    { data: donationAmounts },
    { count: totalDonationCount },
    { data: payoutAmounts },
    { count: totalPayouts },
    { count: totalUpdates },
    { count: totalMessages },
    { count: totalWebhooks },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    // NOTE: For large datasets, replace with a Supabase RPC for server-side SUM
    supabaseAdmin.from('donations').select('amount_cents').eq('status', 'completed'),
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabaseAdmin.from('payouts').select('amount_cents').eq('status', 'paid'),
    supabaseAdmin.from('payouts').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('campaign_updates').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('donor_messages').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('webhook_events').select('*', { count: 'exact', head: true }),
  ]);

  const totalDonationsCents = (donationAmounts ?? []).reduce(
    (s, d) => s + ((d as { amount_cents: number }).amount_cents ?? 0), 0,
  );
  const totalPayoutsCents = (payoutAmounts ?? []).reduce(
    (s, p) => s + ((p as { amount_cents: number }).amount_cents ?? 0), 0,
  );
  const avgDonationCents = (totalDonationCount ?? 0) > 0
    ? Math.round(totalDonationsCents / (totalDonationCount ?? 1))
    : 0;

  // Shape real aggregate stats as report rows
  const rows: TableRow[] = [
    {
      title: 'User Summary',
      subtitle: 'All registered accounts on the platform',
      status: 'Live',
      amount: (totalUsers ?? 0).toLocaleString() + ' users',
      meta: ['Users', 'Platform'],
    },
    {
      title: 'Campaign Performance',
      subtitle: `${activeCampaigns ?? 0} active · ${completedCampaigns ?? 0} completed`,
      status: 'Live',
      amount: (totalCampaigns ?? 0).toLocaleString() + ' total',
      meta: ['Campaigns', 'Platform'],
    },
    {
      title: 'Donation Summary',
      subtitle: `${(totalDonationCount ?? 0).toLocaleString()} transactions · avg ${fmtCents(avgDonationCents)}`,
      status: 'Live',
      amount: fmtCents(totalDonationsCents),
      meta: ['Donations', 'Finance'],
    },
    {
      title: 'Payout Summary',
      subtitle: `${(totalPayouts ?? 0).toLocaleString()} payout requests processed`,
      status: 'Live',
      amount: fmtCents(totalPayoutsCents),
      meta: ['Payouts', 'Finance'],
    },
    {
      title: 'Campaign Updates',
      subtitle: 'Posts and updates published by organizers',
      status: 'Live',
      amount: (totalUpdates ?? 0).toLocaleString() + ' posts',
      meta: ['Content', 'Engagement'],
    },
    {
      title: 'Donor Messages',
      subtitle: 'Messages left by donors on campaigns',
      status: 'Live',
      amount: (totalMessages ?? 0).toLocaleString() + ' messages',
      meta: ['Messages', 'Engagement'],
    },
    {
      title: 'Webhook Events',
      subtitle: 'Stripe webhook events processed by the platform',
      status: 'Live',
      amount: (totalWebhooks ?? 0).toLocaleString() + ' events',
      meta: ['Stripe', 'System'],
    },
  ];

  const metrics: Metric[] = [
    {
      label: 'Users',
      value: (totalUsers ?? 0).toLocaleString(),
      change: 'registered',
      icon: 'users',
      tone: 'violet',
    },
    {
      label: 'Total Raised',
      value: fmtCents(totalDonationsCents),
      change: 'all time',
      icon: 'gift',
      tone: 'green',
    },
    {
      label: 'Campaigns',
      value: (totalCampaigns ?? 0).toLocaleString(),
      change: 'all statuses',
      icon: 'stack',
      tone: 'blue',
    },
    {
      label: 'Data Points',
      value: (
        (totalDonationCount ?? 0) +
        (totalUpdates ?? 0) +
        (totalMessages ?? 0) +
        (totalWebhooks ?? 0)
      ).toLocaleString(),
      change: 'tracked events',
      icon: 'chart',
      tone: 'orange',
    },
  ];

  return (
    <PageScaffold
      mode="admin"
      active="Reports"
      title="Reports"
      subtitle="Create, run, analyze and export reports to drive data-informed decisions."
      metrics={metrics}
      rows={rows}
      tabs={['All Reports', 'Finance', 'Campaigns', 'Engagement']}
    />
  );
}
