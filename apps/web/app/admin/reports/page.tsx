import 'server-only';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import ReportsClient, { type ReportItem } from './_components/ReportsClient';

export const dynamic = 'force-dynamic';

function fmtCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${Math.round(dollars).toLocaleString('en-US')}`;
  return `$${Math.round(dollars).toLocaleString('en-US')}`;
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function AdminReportsPage() {
  await requireAdmin();

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
    { count: recurringDonors },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabaseAdmin.from('donations').select('amount_cents').eq('status', 'completed'),
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabaseAdmin.from('payouts').select('amount_cents').eq('status', 'paid'),
    supabaseAdmin.from('payouts').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('campaign_updates').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('donor_messages').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('webhook_events').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('donations').select('donor_id', { count: 'exact', head: true }),
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

  const today = todayStr();

  // Build derived report items
  const reports: ReportItem[] = [
    {
      id: 'donation-summary',
      name: 'Donation Summary',
      category: 'Finance',
      createdBy: 'System',
      status: 'Live',
      createdOn: today,
      value: fmtCents(totalDonationsCents),
      description: `${(totalDonationCount ?? 0).toLocaleString()} transactions · avg ${fmtCents(avgDonationCents)}`,
    },
    {
      id: 'campaign-performance',
      name: 'Campaign Performance',
      category: 'Campaigns',
      createdBy: 'System',
      status: 'Live',
      createdOn: today,
      value: (totalCampaigns ?? 0).toLocaleString() + ' total',
      // Same as the countries page: a null count means the query failed, not that
      // the number is zero. Render unknown rather than a confident 0.
      description: `${activeCampaigns ?? '—'} active · ${completedCampaigns ?? '—'} completed`,
    },
    {
      id: 'user-activity',
      name: 'User Activity',
      category: 'Users',
      createdBy: 'System',
      status: 'Live',
      createdOn: today,
      value: (totalUsers ?? 0).toLocaleString() + ' users',
      description: 'All registered accounts on the platform',
    },
    {
      id: 'payout-summary',
      name: 'Payout Summary',
      category: 'Finance',
      createdBy: 'System',
      status: 'Live',
      createdOn: today,
      value: fmtCents(totalPayoutsCents),
      description: `${(totalPayouts ?? 0).toLocaleString()} payout requests processed`,
    },
    {
      id: 'recurring-donations',
      name: 'Recurring Donations',
      category: 'Finance',
      createdBy: 'System',
      status: 'Live',
      createdOn: today,
      value: (recurringDonors ?? 0).toLocaleString() + ' donors',
      description: 'Donors with recurring contribution patterns',
    },
    {
      id: 'top-donors',
      name: 'Top Donors',
      category: 'Users',
      createdBy: 'System',
      status: 'Live',
      createdOn: today,
      value: fmtCents(totalDonationsCents),
      description: 'Highest-value donors ranked by total giving',
    },
    {
      id: 'donation-trends',
      name: 'Donation Trends',
      category: 'Finance',
      createdBy: 'System',
      status: 'Live',
      createdOn: today,
      value: (totalDonationCount ?? 0).toLocaleString() + ' events',
      description: 'Donation velocity over time periods',
    },
    {
      id: 'campaign-updates',
      name: 'Campaign Updates',
      category: 'Engagement',
      createdBy: 'System',
      status: 'Live',
      createdOn: today,
      value: (totalUpdates ?? 0).toLocaleString() + ' posts',
      description: 'Posts and updates published by organizers',
    },
    {
      id: 'donor-messages',
      name: 'Donor Messages',
      category: 'Engagement',
      createdBy: 'System',
      status: 'Live',
      createdOn: today,
      value: (totalMessages ?? 0).toLocaleString() + ' messages',
      description: 'Messages left by donors on campaigns',
    },
    {
      id: 'webhook-events',
      name: 'Webhook Events',
      category: 'System',
      createdBy: 'System',
      status: 'Live',
      createdOn: today,
      value: (totalWebhooks ?? 0).toLocaleString() + ' events',
      description: 'Stripe webhook events processed by the platform',
    },
  ];

  const categoryMap: Record<string, number> = {};
  for (const r of reports) {
    categoryMap[r.category] = (categoryMap[r.category] ?? 0) + 1;
  }

  const COLORS: Record<string, string> = {
    Finance: 'var(--brand-text)',
    Campaigns: 'var(--pink-text)',
    Users: 'var(--blue-text)',
    Engagement: 'var(--green-text)',
    System: 'var(--orange-text)',
  };

  const categories = Object.entries(categoryMap).map(([label, count]) => ({
    label,
    count,
    color: COLORS[label] ?? 'var(--t3)',
  }));

  const dataPoints =
    (totalDonationCount ?? 0) +
    (totalUpdates ?? 0) +
    (totalMessages ?? 0) +
    (totalWebhooks ?? 0);

  return (
    <CharitMeShell active="Reports" mode="admin">
      <TopBar
        title="Reports"
        subtitle="Create, run, analyze and export reports to drive data-informed decisions."
        actions={<></>}
      />
      <ReportsClient
        reports={reports}
        categories={categories}
        totalReports={reports.length}
        scheduledReports={0}
        totalExports={0}
        dataPoints={dataPoints}
      />
    </CharitMeShell>
  );
}
