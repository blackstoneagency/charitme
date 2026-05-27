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

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function AdminCampaignsPage() {
  await requireAdmin();

  const [
    { data: campaigns, count: totalCount },
    { count: activeCount },
    { count: draftCount },
    { count: pendingCount },
  ] = await Promise.all([
    supabaseAdmin
      .from('campaigns')
      .select(
        'id, title, status, raised_amount, goal_amount, backer_count, category, user_id, created_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabaseAdmin
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft'),
    supabaseAdmin
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'paused']),
  ]);

  type CampaignRow = {
    id: string;
    title: string;
    status: string;
    raised_amount: number;
    goal_amount: number;
    backer_count: number;
    category: string | null;
    user_id: string;
    created_at: string;
  };

  const campaignList = (campaigns ?? []) as CampaignRow[];

  // Resolve organizer names
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
      c.category ? capitalize(c.category) : 'Uncategorized',
      `${(c.backer_count ?? 0).toLocaleString()} donors · Goal ${fmtCents(c.goal_amount ?? 0)}`,
    ],
  }));

  const metrics: Metric[] = [
    {
      label: 'All Campaigns',
      value: (totalCount ?? 0).toLocaleString(),
      change: 'all statuses',
      icon: 'stack',
      tone: 'violet',
    },
    {
      label: 'Active',
      value: (activeCount ?? 0).toLocaleString(),
      change: 'live right now',
      icon: 'check',
      tone: 'green',
    },
    {
      label: 'Pending / Paused',
      value: (pendingCount ?? 0).toLocaleString(),
      change: 'need attention',
      icon: 'audit',
      tone: 'orange',
    },
    {
      label: 'Drafts',
      value: (draftCount ?? 0).toLocaleString(),
      change: 'not yet published',
      icon: 'doc',
      tone: 'blue',
    },
  ];

  return (
    <PageScaffold
      mode="admin"
      active="Campaigns"
      title="Campaigns"
      subtitle="Create, review, approve, manage and track campaigns from start to finish."
      metrics={metrics}
      rows={rows}
      tabs={[
        `All (${totalCount ?? 0})`,
        `Active (${activeCount ?? 0})`,
        `Draft (${draftCount ?? 0})`,
        `Pending (${pendingCount ?? 0})`,
      ]}
    />
  );
}
