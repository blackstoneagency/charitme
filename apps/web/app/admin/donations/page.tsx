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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function AdminDonationsPage() {
  await requireAdmin();

  type DonationRow = {
    id: string;
    campaign_id: string;
    donor_id: string | null;
    amount_cents: number;
    status: string;
    anonymous: boolean;
    created_at: string;
  };

  // Fetch latest 200 donations + counts by status
  const [
    { data: donations },
    { data: allAmounts },
    { count: completedCount },
    { count: pendingCount },
    { count: refundedCount },
    { count: failedCount },
  ] = await Promise.all([
    supabaseAdmin
      .from('donations')
      .select('id, campaign_id, donor_id, amount_cents, status, anonymous, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    // NOTE: For large datasets, replace with a Supabase RPC for server-side SUM
    supabaseAdmin
      .from('donations')
      .select('amount_cents')
      .eq('status', 'completed'),
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true }).eq('status', 'refunded'),
    supabaseAdmin.from('donations').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
  ]);

  const donationList = (donations ?? []) as DonationRow[];

  const totalCents = (allAmounts ?? []).reduce(
    (s, d) => s + ((d as { amount_cents: number }).amount_cents ?? 0), 0,
  );
  const totalCount = (completedCount ?? 0) + (pendingCount ?? 0) + (refundedCount ?? 0) + (failedCount ?? 0);
  const avgCents = (completedCount ?? 0) > 0
    ? Math.round(totalCents / (completedCount ?? 1))
    : 0;

  // Resolve campaign titles
  const campaignIds = [...new Set(donationList.map(d => d.campaign_id))];
  const campaignMap = new Map<string, string>();
  if (campaignIds.length > 0) {
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id, title')
      .in('id', campaignIds);
    for (const c of (campaigns ?? []) as { id: string; title: string }[]) {
      campaignMap.set(c.id, c.title);
    }
  }

  // Resolve donor names
  const donorIds = [...new Set(
    donationList.filter(d => d.donor_id && !d.anonymous).map(d => d.donor_id as string),
  )];
  const donorMap = new Map<string, string>();
  if (donorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', donorIds);
    for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) {
      if (p.full_name) donorMap.set(p.id, p.full_name);
    }
  }

  const rows: TableRow[] = donationList.map(d => {
    const donorName = (d.anonymous || !d.donor_id)
      ? 'Anonymous'
      : (donorMap.get(d.donor_id!) ?? 'Unknown Donor');
    return {
      title: donorName,
      subtitle: campaignMap.get(d.campaign_id) ?? 'Unknown Campaign',
      status: capitalize(d.status),
      amount: fmtCents(d.amount_cents),
      meta: [fmtDate(d.created_at), d.anonymous ? 'Anonymous' : 'Identified'],
    };
  });

  const metrics: Metric[] = [
    {
      label: 'Total Donations',
      value: fmtCents(totalCents),
      change: 'completed donations',
      icon: 'gift',
      tone: 'violet',
    },
    {
      label: 'Total Count',
      value: totalCount.toLocaleString(),
      change: 'all statuses',
      icon: 'users',
      tone: 'green',
    },
    {
      label: 'Average Donation',
      value: fmtCents(avgCents),
      change: 'per completed tx',
      icon: 'chart',
      tone: 'blue',
    },
    {
      label: 'Refunded',
      value: (refundedCount ?? 0).toLocaleString(),
      change: 'transactions',
      icon: 'check',
      tone: 'orange',
    },
  ];

  return (
    <PageScaffold
      mode="admin"
      active="Donations"
      title="Donations"
      subtitle="Manage donations, donors, and transactions from start to finish."
      metrics={metrics}
      rows={rows}
      tabs={[
        `All (${totalCount})`,
        `Completed (${completedCount ?? 0})`,
        `Pending (${pendingCount ?? 0})`,
        `Refunded (${refundedCount ?? 0})`,
      ]}
    />
  );
}
