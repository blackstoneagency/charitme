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
export default async function AdminPayoutsPage() {
  await requireAdmin();

  type PayoutRow = {
    id: string;
    campaign_id: string;
    user_id: string;
    amount_cents: number;
    payout_speed: string | null;
    status: string;
    created_at: string;
  };

  const [
    { data: payouts },
    { data: paidAmounts },
    { data: pendingAmounts },
    { count: requestedCount },
    { count: paidCount },
    { count: failedCount },
  ] = await Promise.all([
    supabaseAdmin
      .from('payouts')
      .select('id, campaign_id, user_id, amount_cents, payout_speed, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    // NOTE: For large datasets, replace with a Supabase RPC for server-side SUM
    supabaseAdmin.from('payouts').select('amount_cents').eq('status', 'paid'),
    supabaseAdmin.from('payouts').select('amount_cents').in('status', ['requested', 'approved']),
    supabaseAdmin
      .from('payouts')
      .select('*', { count: 'exact', head: true })
      .in('status', ['requested', 'approved']),
    supabaseAdmin.from('payouts').select('*', { count: 'exact', head: true }).eq('status', 'paid'),
    supabaseAdmin.from('payouts').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
  ]);

  const payoutList = (payouts ?? []) as PayoutRow[];

  const totalPaidCents = (paidAmounts ?? []).reduce(
    (s, p) => s + ((p as { amount_cents: number }).amount_cents ?? 0), 0,
  );
  const totalPendingCents = (pendingAmounts ?? []).reduce(
    (s, p) => s + ((p as { amount_cents: number }).amount_cents ?? 0), 0,
  );

  // Resolve campaign titles
  const campaignIds = [...new Set(payoutList.map(p => p.campaign_id))];
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

  // Resolve organizer names
  const organizerIds = [...new Set(payoutList.map(p => p.user_id))];
  const organizerMap = new Map<string, string>();
  if (organizerIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', organizerIds);
    for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) {
      if (p.full_name) organizerMap.set(p.id, p.full_name);
    }
  }

  const rows: TableRow[] = payoutList.map(p => ({
    title: organizerMap.get(p.user_id) ?? 'Unknown Organizer',
    subtitle: campaignMap.get(p.campaign_id) ?? 'Unknown Campaign',
    status: capitalize(p.status),
    amount: fmtCents(p.amount_cents),
    meta: [
      p.payout_speed ? capitalize(p.payout_speed) : 'Standard',
      fmtDate(p.created_at),
    ],
  }));

  const totalAll = (requestedCount ?? 0) + (paidCount ?? 0) + (failedCount ?? 0);

  const metrics: Metric[] = [
    {
      label: 'Total Paid Out',
      value: fmtCents(totalPaidCents),
      change: 'completed payouts',
      icon: 'wallet',
      tone: 'violet',
    },
    {
      label: 'Pending',
      value: fmtCents(totalPendingCents),
      change: 'awaiting approval',
      icon: 'audit',
      tone: 'orange',
    },
    {
      label: 'Completed',
      value: (paidCount ?? 0).toLocaleString(),
      change: 'payout transactions',
      icon: 'check',
      tone: 'green',
    },
    {
      label: 'Failed',
      value: (failedCount ?? 0).toLocaleString(),
      change: 'need review',
      icon: 'doc',
      tone: 'pink',
    },
  ];

  return (
    <PageScaffold
      mode="admin"
      active="Payouts"
      title="Payouts"
      subtitle="Manage payout requests, review details, take action, and track payouts."
      metrics={metrics}
      rows={rows}
      tabs={[
        `All (${totalAll})`,
        `Pending (${requestedCount ?? 0})`,
        `Completed (${paidCount ?? 0})`,
        `Failed (${failedCount ?? 0})`,
      ]}
    />
  );
}
