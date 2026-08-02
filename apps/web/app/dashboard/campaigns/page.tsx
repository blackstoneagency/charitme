import Link from 'next/link';
import { CharitMeShell, TopBar, MetricGrid, KFIcon } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { boundedQuery } from '../../../lib/query-timeout';
import { attachCampaignCurrencies } from '../../../lib/home-data';
import { formatMoneyCompact } from '@shared/currencies';
import { campaignTimeLabel } from '../../../lib/campaign-lifecycle';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Campaign = {
  id: string;
  title: string;
  slug: string;
  status: string;
  goal_amount: number;
  raised_amount: number;
  backer_count: number;
  cover_image_url: string | null;
  category: string | null;
  deadline: string | null;
  created_at: string;
  currency?: string | null;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtCents(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000)
    return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/**
 * Countdown in the fundraiser's campaign list. Takes `status` (already selected
 * for this query) because reading the deadline alone let a completed campaign
 * count down beside its own status badge. Shared with the public page via
 * lib/campaign-lifecycle. Keeps the compact "3d left" form this table uses.
 */
function daysLeft(deadline: string | null, status: string | null): string {
  if (!deadline && status === 'active') return '—';
  const label = campaignTimeLabel({ status, deadline });
  if (label === 'No deadline') return '—';
  if (label === 'Ended') return 'Ended';
  return label.replace(/^(\d+) days? left$/, '$1d left');
}

function categoryGradient(category: string | null): string {
  const map: Record<string, string> = {
    medical: 'linear-gradient(135deg,#e0f2fe,#7c3aed)',
    environment: 'linear-gradient(135deg,#c7e8ff,#48769f)',
    education: 'linear-gradient(135deg,#d1fae5,#0f766e)',
    emergency: 'linear-gradient(135deg,#dbeafe,#f9a8d4)',
    animals: 'linear-gradient(135deg,#fef3c7,#92400e)',
    community: 'linear-gradient(135deg,#ede9fe,#4c1d95)',
  };
  return map[(category ?? '').toLowerCase()] ?? 'linear-gradient(135deg,#f0f4ff,#c7d2fe)';
}

function pillTone(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
      return 'green';
    case 'paused':
      return 'orange';
    case 'completed':
      return 'violet';
    default:
      return 'red'; // draft, rejected
  }
}

// ─────────────────────────────────────────────
// Data fetch
// ─────────────────────────────────────────────
/**
 * Returning `[]` on failure told an organizer they had NO campaigns — and the
 * metrics above the list then rendered $0 raised / 0 donors, i.e. "your money is
 * gone". For an owner whose fundraiser is live that is alarming and wrong. The
 * load result now distinguishes "you have none" from "we could not load them",
 * and the query is bounded so a degraded database cannot hang the page either.
 */
async function fetchCampaigns(userId: string): Promise<{ campaigns: Campaign[]; failed: boolean }> {
  try {
    const { data, error } = await boundedQuery(
      supabaseAdmin
        .from('campaigns')
        .select(
          'id,title,slug,status,goal_amount,raised_amount,backer_count,cover_image_url,category,deadline,created_at',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
    );
    if (error) return { campaigns: [], failed: true };
    return { campaigns: await attachCampaignCurrencies((data ?? []) as Campaign[]), failed: false };
  } catch {
    return { campaigns: [], failed: true };
  }
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function MyCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const [{ campaigns, failed: loadFailed }, params] = await Promise.all([
    fetchCampaigns(user.id),
    searchParams,
  ]);

  const activeTab = String(params.tab ?? 'all').toLowerCase();

  // Metrics
  const totalRaised = campaigns.reduce((s, c) => s + (c.raised_amount ?? 0), 0);
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
  const totalDonors = campaigns.reduce((s, c) => s + (c.backer_count ?? 0), 0);
  const avgGift = totalDonors > 0 ? Math.round(totalRaised / totalDonors) : 0;

  // When the load failed these numbers are unknown, not zero.
  const unknown = loadFailed;
  const metrics = [
    {
      label: 'Total Raised',
      value: unknown ? '—' : fmtCents(totalRaised),
      change: unknown ? 'unavailable' : 'all campaigns',
      icon: 'gift',
      tone: 'violet' as const,
    },
    {
      label: 'Active Campaigns',
      value: unknown ? '—' : String(activeCampaigns),
      change: unknown ? 'unavailable' : `of ${campaigns.length} total`,
      icon: 'stack',
      tone: 'green' as const,
    },
    {
      label: 'Total Donors',
      value: unknown ? '—' : String(totalDonors),
      change: unknown ? 'unavailable' : 'all time',
      icon: 'users',
      tone: 'blue' as const,
    },
    {
      label: 'Avg. Gift Size',
      value: unknown || avgGift <= 0 ? '—' : fmtCents(avgGift),
      change: unknown ? 'unavailable' : avgGift > 0 ? 'per donor' : 'no donations yet',
      icon: 'chart',
      tone: 'orange' as const,
    },
  ];

  // Tab filtering
  const tabDefs = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'paused', label: 'Paused' },
    { key: 'completed', label: 'Completed' },
    { key: 'draft', label: 'Drafts' },
  ];

  const filtered =
    activeTab === 'all'
      ? campaigns
      : campaigns.filter((c) => c.status.toLowerCase() === activeTab);

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar
        title="My Campaigns"
        subtitle="Manage and grow all your fundraising campaigns."
        actions={
          <Link href="/create/choose-path" className="kf-primary" style={{ textDecoration: 'none' }}>
            + New Campaign
          </Link>
        }
      />

      <div className="kf-content-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div className="kf-content-main">
          {loadFailed && (
            <div
              role="alert"
              style={{
                marginBottom: 16, padding: '14px 16px', borderRadius: 12,
                background: 'var(--s2, #fffbeb)', border: '1px solid var(--b2, #fde68a)',
                color: 'var(--t1, #92400e)',
              }}
            >
              <strong style={{ display: 'block', marginBottom: 4 }}>
                We couldn&apos;t load your campaigns just now
              </strong>
              <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                This is a temporary problem on our side — nothing has happened to your
                campaigns or your funds. Reload the page to try again.
              </span>
            </div>
          )}
          <MetricGrid metrics={metrics} />

          <section className="kf-card" style={{ overflow: 'hidden' }}>
            {/* Card header */}
            <div className="kf-card-head">
              <h2>Campaigns</h2>
            </div>

            {/* Tab bar */}
            <div className="kf-tabs">
              {tabDefs.map(({ key, label }) => {
                const count =
                  key === 'all'
                    ? campaigns.length
                    : campaigns.filter((c) => c.status.toLowerCase() === key).length;
                return (
                  <Link
                    key={key}
                    href={`?tab=${key}`}
                    className={activeTab === key ? 'active' : ''}
                    style={{ textDecoration: 'none' }}
                  >
                    {label}
                    {count > 0 && (
                      <span
                        style={{
                          marginLeft: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          opacity: 0.65,
                        }}
                      >
                        ({count})
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            <div className="kf-table-scroll">
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '56px minmax(0, 1fr) minmax(0, 120px) minmax(0, 140px) 80px 90px minmax(0, 110px)',
                gap: 12,
                padding: '8px 20px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--t3)',
                borderBottom: '1px solid var(--b1)',
              }}
            >
              <span />
              <span>Campaign</span>
              <span style={{ textAlign: 'right' }}>Raised</span>
              <span>Progress</span>
              <span style={{ textAlign: 'right' }}>Donors</span>
              <span>Deadline</span>
              <span />
            </div>

            {/* Rows */}
            {filtered.length > 0 && (
              <div className="kf-rows">
                {filtered.map((c) => {
                  const progress =
                    c.goal_amount > 0
                      ? Math.min(100, Math.round((c.raised_amount / c.goal_amount) * 100))
                      : 0;
                  const thumb = c.cover_image_url
                    ? { backgroundImage: `url(${c.cover_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : { background: categoryGradient(c.category) };

                  return (
                    <div
                      key={c.id}
                      className="kf-row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '56px minmax(0, 1fr) minmax(0, 120px) minmax(0, 140px) 80px 90px minmax(0, 110px)',
                        gap: 12,
                        alignItems: 'center',
                      }}
                    >
                      {/* Thumbnail */}
                      <div
                        className="kf-thumb"
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          flexShrink: 0,
                          ...thumb,
                        }}
                      />

                      {/* Copy */}
                      <div className="kf-row-main" style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className={`kf-pill ${pillTone(c.status)}`} style={{ fontSize: 10 }}>
                            {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                          </span>
                          <strong
                            style={{
                              fontSize: 14,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {c.title}
                          </strong>
                        </div>
                        {c.category && (
                          <p style={{ fontSize: 12, color: 'var(--t3)', margin: '2px 0 0' }}>
                            {c.category.charAt(0).toUpperCase() + c.category.slice(1)}
                          </p>
                        )}
                      </div>

                      {/* Raised / Goal */}
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: 14 }}>{formatMoneyCompact(c.raised_amount, c.currency ?? 'usd')}</strong>
                        <p style={{ fontSize: 11, color: 'var(--t3)', margin: 0 }}>
                          of {formatMoneyCompact(c.goal_amount, c.currency ?? 'usd')}
                        </p>
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div
                          style={{
                            height: 6,
                            borderRadius: 4,
                            background: 'var(--b1)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${progress}%`,
                              background: 'var(--green)',
                              borderRadius: 4,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--t3)', margin: '3px 0 0' }}>
                          {progress}%
                        </p>
                      </div>

                      {/* Donors */}
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: 14 }}>{c.backer_count.toLocaleString()}</strong>
                      </div>

                      {/* Deadline */}
                      <div>
                        <span
                          style={{
                            fontSize: 12,
                            color: daysLeft(c.deadline, c.status) === 'Ended' ? 'var(--t3)' : 'var(--t2)',
                            fontWeight: 600,
                          }}
                        >
                          {daysLeft(c.deadline, c.status)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="kf-row-action" style={{ display: 'flex', minWidth: 0, gap: 8, justifyContent: 'flex-end' }}>
                        <Link
                          href={`/dashboard/campaigns/${c.id}`}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--green-text)',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: 'var(--t3)',
                }}
              >
                <KFIcon name="stack" />
                <p style={{ marginTop: 12, fontWeight: 600 }}>No campaigns here yet.</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>
                  {activeTab === 'all' ? (
                    <>
                      <Link href="/create/choose-path" style={{ color: 'var(--green-text)' }}>
                        Create your first campaign
                      </Link>{' '}
                      to get started.
                    </>
                  ) : (
                    `No ${activeTab} campaigns.`
                  )}
                </p>
              </div>
            )}

            {/* Footer */}
            {filtered.length > 0 && (
              <div className="kf-table-footer" style={{ padding: '12px 20px', fontSize: 13, color: 'var(--t3)' }}>
                Showing {filtered.length} of {campaigns.length} campaigns
              </div>
            )}
          </section>
        </div>
      </div>
    </CharitMeShell>
  );
}
