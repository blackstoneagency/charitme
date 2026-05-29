import Link from 'next/link';
import { KindFundShell, TopBar, MetricGrid, KFIcon } from '../../../components/KindFundShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type CampaignIdTitle = {
  id: string;
  title: string;
};

type UpdateRow = {
  id: string;
  campaign_id: string;
  title: string;
  body: string;
  created_at: string;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function truncate(text: string, max = 80): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const userId = user.id;
  const activeTab = (typeof params.tab === 'string' ? params.tab : 'all').toLowerCase();

  // Step 1: get user's campaign IDs + titles
  const { data: campaignData } = await supabaseAdmin
    .from('campaigns')
    .select('id,title')
    .eq('user_id', userId);

  const campaigns = (campaignData ?? []) as CampaignIdTitle[];
  const cids = campaigns.map((c) => c.id);

  const campaignTitleMap = new Map<string, string>(
    campaigns.map((c) => [c.id, c.title])
  );

  // Step 2: get updates
  let updates: UpdateRow[] = [];
  if (cids.length > 0) {
    const { data: updateData } = await supabaseAdmin
      .from('campaign_updates')
      .select('id,campaign_id,title,body,created_at')
      .in('campaign_id', cids)
      .order('created_at', { ascending: false })
      .limit(100);
    updates = (updateData ?? []) as UpdateRow[];
  }

  // Metrics
  const now = new Date();
  const monthStart = startOfMonth();
  const thisMonth = updates.filter((u) => u.created_at >= monthStart).length;
  const campaignsWithUpdates = new Set(updates.map((u) => u.campaign_id)).size;
  const avgPerCampaign =
    campaignsWithUpdates > 0
      ? (updates.length / campaignsWithUpdates).toFixed(1)
      : '0';

  const metrics = [
    { label: 'Total Updates', value: String(updates.length), change: 'all time', icon: 'doc', tone: 'violet' as const },
    { label: 'This Month', value: String(thisMonth), change: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), icon: 'chart', tone: 'green' as const },
    { label: 'Campaigns w/ Updates', value: String(campaignsWithUpdates), change: `of ${campaigns.length} campaigns`, icon: 'stack', tone: 'blue' as const },
    { label: 'Avg per Campaign', value: avgPerCampaign, change: 'updates / campaign', icon: 'send', tone: 'orange' as const },
  ];

  // Tab filtering
  const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const filtered =
    activeTab === 'this-week'
      ? updates.filter((u) => u.created_at >= thisWeekStart)
      : activeTab === 'scheduled'
      ? [] // no scheduled status in schema — show empty
      : updates;

  const tabs = [
    { key: 'all', label: 'All Updates' },
    { key: 'this-week', label: 'This Week' },
    { key: 'scheduled', label: 'Scheduled' },
  ];

  return (
    <KindFundShell active="Updates">
      <TopBar
        title="Updates"
        subtitle="Share progress and stories with your supporters."
        actions={
          <Link href="/dashboard/updates/new" className="kf-primary">
            + Post Update
          </Link>
        }
      />

      <div className="kf-content-grid" style={{ gridTemplateColumns: '1fr' }}>
        <MetricGrid metrics={metrics} />

        <section className="kf-card kf-table-card">
          <div className="kf-card-head">
            <h2>Campaign Updates</h2>
          </div>

          {/* Tabs */}
          <div className="kf-tabs">
            {tabs.map(({ key, label }) => (
              <Link
                key={key}
                href={`?tab=${key}`}
                className={activeTab === key ? 'active' : ''}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '48px 32px',
                textAlign: 'center',
                color: 'var(--t3)',
              }}
            >
              <KFIcon name="doc" className="kf-empty-icon" />
              <p style={{ marginTop: 12, fontWeight: 600 }}>
                No updates yet. Post your first update to keep donors engaged.
              </p>
              <Link
                href="/dashboard/updates/new"
                className="kf-primary"
                style={{ display: 'inline-block', marginTop: 16 }}
              >
                + Post Update
              </Link>
            </div>
          ) : (
            <div className="kf-rows">
              {filtered.map((update) => (
                <div key={update.id} className="kf-row">
                  <div className="kf-square violet">
                    <KFIcon name="doc" />
                  </div>
                  <div className="kf-row-main">
                    <div>
                      <strong>{update.title}</strong>
                    </div>
                    <p>{truncate(update.body)}</p>
                    <small>
                      {campaignTitleMap.get(update.campaign_id) ?? 'Unknown Campaign'}
                      {' · '}
                      {fmtDate(update.created_at)}
                    </small>
                  </div>
                  <Link href={`/dashboard/campaigns/${update.campaign_id}`} className="kf-row-action">View Campaign</Link>
                </div>
              ))}
            </div>
          )}

          <div className="kf-table-footer">
            {filtered.length} update{filtered.length !== 1 ? 's' : ''}
          </div>
        </section>
      </div>
    </KindFundShell>
  );
}
