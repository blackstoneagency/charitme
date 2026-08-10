import Link from 'next/link';
import { CharitMeShell, TopBar, MetricGrid, KFIcon } from '../../../components/CharitMeShellServer';
import DegradedReadNotice from '../../../components/DegradedReadNotice';
// Note: this page shows donations received by the organizer's campaigns.
// Donors can request refunds for their own donations at /dashboard/refund.
import { requireUser } from '../../../lib/auth';
import { createClient } from '../../../lib/supabase-server';
import { boundedQuery } from '../../../lib/query-timeout';
import { formatMoneyCompact } from '@shared/currencies';
import { decodeKeysetCursor, encodeKeysetCursor, type KeysetCursor } from '../../../lib/keyset-cursor';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Donation = {
  id: string;
  amount_cents: number;
  currency: string | null;
  status: string;
  created_at: string;
  anonymous: boolean;
  donor_id: string | null;
  campaign_id: string;
};

// Enriched for display
type EnrichedDonation = Donation & {
  donorName: string;
  campaignTitle: string;
};

type DonationSummary = {
  total_raised_cents: number;
  donation_count: number;
  unique_donor_count: number;
  average_donation_cents: number;
  one_time_donation_count: number;
};

const PAGE_SIZE = 50;

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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const AVATAR_COLORS = ['#6c35ff', '#19b86a', '#2f80ed', '#ec3fb4', '#f59e0b'];

function avatarStyle(index: number): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: AVATAR_COLORS[index % AVATAR_COLORS.length],
    color: '#fff',
    display: 'flex', minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
async function fetchDonationPage(
  userId: string,
  activeTab: string,
  cursor: KeysetCursor | null,
): Promise<{
  donations: EnrichedDonation[];
  summary: DonationSummary | null;
  hasMore: boolean;
  failed: boolean;
}> {
  try {
    const supabase = await createClient();
    const [summaryResult, pageResult] = await Promise.all([
      boundedQuery(() => supabase.rpc('organizer_donation_summary', { p_user_id: userId })),
      activeTab === 'top-donors'
        ? boundedQuery(() => supabase.rpc('organizer_top_donors', {
            p_user_id: userId,
            p_limit: 20,
          }))
        : boundedQuery(() => supabase.rpc('organizer_donation_page', {
            p_user_id: userId,
            p_before_created_at: cursor?.createdAt ?? null,
            p_before_id: cursor?.id ?? null,
            p_limit: PAGE_SIZE + 1,
            p_one_time_only: activeTab === 'one-time',
          })),
    ]);

    if (summaryResult.error || pageResult.error || !summaryResult.data || !pageResult.data) {
      return { donations: [], summary: null, hasMore: false, failed: true };
    }

    const summaryRows = summaryResult.data as unknown as DonationSummary[];
    const rows = pageResult.data as unknown as Array<Donation & {
      donor_name: string;
      campaign_title: string;
    }>;
    const hasMore = activeTab !== 'top-donors' && rows.length > PAGE_SIZE;
    const donations = rows.slice(0, PAGE_SIZE).map((donation) => ({
      ...donation,
      donorName: donation.donor_name,
      campaignTitle: donation.campaign_title,
    }));
    return { donations, summary: summaryRows[0] ?? null, hasMore, failed: false };
  } catch {
    return { donations: [], summary: null, hasMore: false, failed: true };
  }
}

export default async function DonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const requestedTab = String(params.tab ?? 'all').toLowerCase();
  const activeTab = ['all', 'one-time', 'top-donors'].includes(requestedTab) ? requestedTab : 'all';
  const cursor = decodeKeysetCursor(params.cursor);
  const { donations, summary, hasMore, failed: unavailable } = await fetchDonationPage(
    user.id,
    activeTab,
    cursor,
  );

  // Metrics
  const totalRaised = summary?.total_raised_cents ?? 0;
  const donationCount = summary?.donation_count ?? 0;
  const uniqueDonors = summary?.unique_donor_count ?? 0;
  const avgDonation = summary?.average_donation_cents ?? 0;

  const metrics = [
    {
      label: 'Total Raised',
      value: unavailable ? '—' : fmtCents(totalRaised),
      change: unavailable ? 'unavailable' : 'all time',
      icon: 'gift',
      tone: 'violet' as const,
    },
    {
      label: 'Donations',
      value: unavailable ? '—' : donationCount.toLocaleString(),
      change: unavailable ? 'unavailable' : 'all completed gifts',
      icon: 'stack',
      tone: 'green' as const,
    },
    {
      label: 'Unique Donors',
      value: unavailable ? '—' : uniqueDonors.toLocaleString(),
      change: unavailable ? 'unavailable' : 'identified donors',
      icon: 'users',
      tone: 'blue' as const,
    },
    {
      label: 'Avg. Donation',
      value: unavailable ? '—' : fmtCents(avgDonation),
      change: unavailable ? 'unavailable' : 'per transaction',
      icon: 'chart',
      tone: 'orange' as const,
    },
  ];

  // Tab logic
  const tabDefs = [
    { key: 'all', label: 'All' },
    { key: 'one-time', label: 'One-time' },
    { key: 'top-donors', label: 'Top Donors' },
  ];

  // Build per-donor donation totals for "one-time" (donors who donated only once)
  const donorDonationCount = new Map<string, number>();
  for (const d of donations) {
    const key = d.donor_id ?? `anon-${d.id}`;
    donorDonationCount.set(key, (donorDonationCount.get(key) ?? 0) + 1);
  }

  let filtered: EnrichedDonation[];
  if (activeTab === 'one-time') {
    filtered = donations.filter((d) => {
      const key = d.donor_id ?? `anon-${d.id}`;
      return (donorDonationCount.get(key) ?? 0) === 1;
    });
  } else if (activeTab === 'top-donors') {
    // Aggregate by donor, sort desc, keep top 20
    const donorTotals = new Map<string, { total: number; name: string; latestDonation: EnrichedDonation }>();
    for (const d of donations) {
      const key = d.donorName + '|' + (d.donor_id ?? d.id);
      const existing = donorTotals.get(key);
      if (existing) {
        existing.total += d.amount_cents;
      } else {
        donorTotals.set(key, { total: d.amount_cents, name: d.donorName, latestDonation: d });
      }
    }
    filtered = [...donorTotals.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
      .map(({ latestDonation, total }) => ({ ...latestDonation, amount_cents: total }));
  } else {
    filtered = donations;
  }

  const lastDonation = donations.at(-1);
  const nextCursor = hasMore && lastDonation
    ? encodeKeysetCursor({ createdAt: lastDonation.created_at, id: lastDonation.id })
    : null;

  return (
    <CharitMeShell active="Donations">
      <TopBar
        title="Donations"
        subtitle="Track every donation across all your campaigns."
        actions={
          // Wraps: two 154px buttons in a nowrap row measure 401px, wider than any
          // phone, and the root clips rather than scrolls — so "Export" was cut
          // off and unreachable.
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
            <Link
              href="/dashboard/refund"
              className="kf-outline"
              style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 6, textDecoration: 'none' }}
            >
              Request Refund
            </Link>
            <a
              href="/api/exports/donations"
              download
              className="kf-outline"
              style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 6, textDecoration: 'none' }}
            >
              <KFIcon name="upload" /> Export CSV
            </a>
            <Link
              href="/dashboard/tax"
              className="kf-outline"
              style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 6, textDecoration: 'none' }}
            >
              <KFIcon name="doc" /> Tax Documents
            </Link>
          </div>
        }
      />

      <div className="kf-content-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div className="kf-content-main">
          {/* title is an expression, not "&apos;" — entities are not decoded
              inside a JSX string attribute, they would render literally. */}
          {unavailable && (
            <DegradedReadNotice title={"We couldn't load your donations"} />
          )}
          <MetricGrid metrics={metrics} />

          <section className="kf-card" style={{ overflow: 'hidden' }}>
            {/* Card header */}
            <div className="kf-card-head">
              <h2>Donation History</h2>
            </div>

            {/* Tab bar */}
            <div className="kf-tabs">
              {tabDefs.map(({ key, label }) => {
                let count = 0;
                if (key === 'all') count = donationCount;
                else if (key === 'one-time') count = summary?.one_time_donation_count ?? 0;
                else if (key === 'top-donors') count = Math.min(20, uniqueDonors);

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

            {/* Scrolls horizontally on narrow screens and contains no focusable content, so
                without tabIndex its off-screen columns cannot be reached by keyboard (WCAG
                2.1.1 / axe scrollable-region-focusable). Sibling tables whose rows already
                hold buttons or links are deliberately NOT given one — that would add a dead
                tab stop. Kept on one line: ESLint reports the tabIndex attribute's own line,
                so a disable above a multi-line element misses it. */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
            <div className="kf-table-scroll" tabIndex={0} role="region" aria-label="Donations">
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 120px) minmax(0, 100px) 90px',
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
              <span>Donor</span>
              <span>Campaign</span>
              <span>Date</span>
              <span style={{ textAlign: 'right' }}>Amount</span>
              <span>Status</span>
            </div>

            {/* Rows */}
            {filtered.length > 0 && (
              <div className="kf-rows">
                {filtered.map((d, i) => (
                  <div
                    key={d.id}
                    className="kf-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 120px) minmax(0, 100px) 90px',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    {/* Donor */}
                    <div
                      className="kf-row-main"
                      style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 10 }}
                    >
                      <div style={avatarStyle(i)}>
                        {initials(d.donorName)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong
                          style={{
                            fontSize: 14,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                          }}
                        >
                          {d.donorName}
                        </strong>
                      </div>
                    </div>

                    {/* Campaign */}
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--t2)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.campaignTitle}
                    </div>

                    {/* Date */}
                    <div style={{ fontSize: 13, color: 'var(--t3)' }}>{fmtDate(d.created_at)}</div>

                    {/* Amount */}
                    <div style={{ textAlign: 'right' }}>
                      <strong
                        style={{
                          fontSize: 15,
                          color: 'var(--green-text)',
                          fontWeight: 700,
                        }}
                      >
                        {formatMoneyCompact(d.amount_cents, d.currency ?? 'usd')}
                      </strong>
                    </div>

                    {/* Status pill */}
                    <div>
                      <span
                        className={`kf-pill ${
                          d.status === 'refunded' ? 'orange' :
                          d.status === 'failed'   ? 'red'    : 'green'
                        }`}
                        style={{ fontSize: 11, textTransform: 'capitalize' }}
                      >
                        {d.status}
                      </span>
                    </div>
                  </div>
                ))}
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
                <KFIcon name="gift" />
                <p style={{ marginTop: 12, fontWeight: 600 }}>No donations yet.</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>
                  Donations will appear here once your campaigns receive contributions.
                </p>
              </div>
            )}

            {/* Footer */}
            {filtered.length > 0 && (
              <div
                className="kf-table-footer"
                style={{ padding: '12px 20px', fontSize: 13, color: 'var(--t3)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}
              >
                <span>
                  Showing {filtered.length}{' '}
                  {activeTab === 'top-donors'
                    ? 'top donors'
                    : `of ${(activeTab === 'one-time' ? summary?.one_time_donation_count : summary?.donation_count) ?? filtered.length} donations`}
                </span>
                <span style={{ display: 'flex', gap: 8 }}>
                  {cursor && (
                    <Link href={`?tab=${activeTab}`} className="kf-outline" style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center', textDecoration: 'none' }}>
                      First page
                    </Link>
                  )}
                  {nextCursor && (
                    <Link href={`?tab=${activeTab}&cursor=${encodeURIComponent(nextCursor)}`} className="kf-outline" style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center', textDecoration: 'none' }}>
                      Next page
                    </Link>
                  )}
                </span>
              </div>
            )}
          </section>
        </div>
      </div>
    </CharitMeShell>
  );
}
