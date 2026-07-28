import Link from 'next/link';
import { CharitMeShell, TopBar, MetricGrid, KFIcon } from '../../../components/CharitMeShellServer';
import DegradedReadNotice from '../../../components/DegradedReadNotice';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { boundedQuery } from '../../../lib/query-timeout';
import { attachCampaignCurrencies } from '../../../lib/home-data';
import { formatMoneyCompact } from '@shared/currencies';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type CampaignRow = {
  id: string;
  title: string;
  slug: string;
  raised_amount: number;
  backer_count: number;
  goal_amount: number;
  status: string;
  currency?: string | null;
};

type DonationRow = {
  amount_cents: number;
  created_at: string;
  campaign_id: string;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000)
    return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${dollars.toFixed(2)}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

/** Returns ISO date string YYYY-MM-DD for a Date */
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Format a date label like "May 20" */
function fmtDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Group donations by day and return 7 buckets (day → total cents) */
function buildDailyBuckets(donations: DonationRow[]): { day: string; label: string; total: number }[] {
  const buckets: { day: string; label: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i);
    const day = isoDay(d);
    buckets.push({ day, label: fmtDay(day), total: 0 });
  }
  for (const donation of donations) {
    const day = donation.created_at.slice(0, 10);
    const bucket = buckets.find((b) => b.day === day);
    if (bucket) bucket.total += donation.amount_cents;
  }
  return buckets;
}

/** Map daily cent totals to SVG Y coordinates (top = 0, bottom = HEIGHT) */
function scaleY(value: number, max: number, HEIGHT: number): number {
  if (max === 0) return HEIGHT;
  return HEIGHT - Math.round((value / max) * HEIGHT);
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // searchParams required by Next.js 15 signature; not used for tab on this page
  await searchParams;

  const user = await requireUser();
  const userId = user.id;

  // Step 1: get campaigns
  // supabase-js resolves on a query error, so an unchecked read turns a timeout
  // into `data: null` → an empty list → "$0 raised" stated as fact.
  const { data: campaignData, error: campaignError } = await boundedQuery(
    supabaseAdmin
      .from('campaigns')
      .select('id,title,slug,raised_amount,backer_count,goal_amount,status')
      .eq('user_id', userId),
  );
  let unavailable = Boolean(campaignError) || campaignData == null;

  const campaigns = await attachCampaignCurrencies((campaignData ?? []) as CampaignRow[]);
  const cids = campaigns.map((c) => c.id);

  // Step 2: get completed donations for these campaigns
  let donations: DonationRow[] = [];
  if (cids.length > 0) {
    const { data: donationData, error: donationError } = await boundedQuery(
      supabaseAdmin
        .from('donations')
        .select('amount_cents,created_at,campaign_id')
        .in('campaign_id', cids)
        .eq('status', 'completed'),
    );
    if (donationError || donationData == null) unavailable = true;
    donations = (donationData ?? []) as DonationRow[];
  }

  // Computed metrics
  const sevenDaysAgo = daysAgo(7).toISOString();
  const thirtyDaysAgo = daysAgo(30).toISOString();

  const weeklyRaised = donations
    .filter((d) => d.created_at >= sevenDaysAgo)
    .reduce((sum, d) => sum + d.amount_cents, 0);

  const monthlyRaised = donations
    .filter((d) => d.created_at >= thirtyDaysAgo)
    .reduce((sum, d) => sum + d.amount_cents, 0);

  const totalBackers = campaigns.reduce((sum, c) => sum + c.backer_count, 0);
  const totalRaised = donations.reduce((sum, d) => sum + d.amount_cents, 0);
  const avgDonation = donations.length > 0 ? Math.round(totalRaised / donations.length) : 0;

  // Best performing campaign
  const bestCampaign =
    campaigns.length > 0
      ? campaigns.reduce((best, c) =>
          c.raised_amount > best.raised_amount ? c : best
        )
      : null;

  const metrics = [
    { label: 'Raised This Week', value: unavailable ? '—' : fmtCents(weeklyRaised), change: unavailable ? 'unavailable' : 'last 7 days', icon: 'gift', tone: 'violet' as const },
    { label: 'Raised This Month', value: unavailable ? '—' : fmtCents(monthlyRaised), change: unavailable ? 'unavailable' : 'last 30 days', icon: 'chart', tone: 'green' as const },
    { label: 'Total Backers', value: unavailable ? '—' : totalBackers.toLocaleString(), change: unavailable ? 'unavailable' : `avg ${fmtCents(avgDonation)} / donation`, icon: 'users', tone: 'orange' as const },
    { label: 'Top Campaign', value: unavailable ? '—' : bestCampaign ? formatMoneyCompact(bestCampaign.raised_amount, bestCampaign.currency ?? 'usd') : '$0', change: unavailable ? 'unavailable' : bestCampaign ? bestCampaign.title.slice(0, 28) + (bestCampaign.title.length > 28 ? '…' : '') : 'No campaigns yet', icon: 'send', tone: 'blue' as const },
  ];

  // SVG line chart: 7-day rolling donations
  const SVG_W = 520;
  const SVG_H = 180;
  const CHART_PADDING_X = 16;
  const buckets = buildDailyBuckets(
    donations.filter((d) => d.created_at >= sevenDaysAgo)
  );
  const maxVal = Math.max(...buckets.map((b) => b.total), 1);

  const points = buckets.map((b, i) => {
    const x =
      CHART_PADDING_X +
      (i / (buckets.length - 1)) * (SVG_W - CHART_PADDING_X * 2);
    const y = SVG_H - 20 + scaleY(b.total, maxVal, SVG_H - 40);
    return { x, y, ...b };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPath = [
    `M${points[0].x},${points[0].y}`,
    ...points.slice(1).map((p) => `L${p.x},${p.y}`),
    `L${points[points.length - 1].x},${SVG_H + 20}`,
    `L${points[0].x},${SVG_H + 20}`,
    'Z',
  ].join(' ');

  return (
    <CharitMeShell active="Analytics">
      <TopBar
        title="Analytics"
        subtitle="Track your performance and grow your impact."
        actions={
          <Link
            href={`/api/analytics/export?userId=${encodeURIComponent(userId)}`}
            className="kf-outline"
            download
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
          >
            <KFIcon name="upload" /> Export CSV
          </Link>
        }
      />

      <div className="kf-admin-dash">
        {unavailable && (
          <DegradedReadNotice title={"We couldn't load your analytics"} />
        )}
        <MetricGrid metrics={metrics} />

        {/* Two-column: chart + campaign table */}
        <div className="kf-two-col" style={{ marginTop: 24 }}>
          {/* Left: SVG line chart */}
          <section className="kf-card kf-chart">
            <div className="kf-card-head">
              <h2>Daily Donations (7 days)</h2>
              <span className="kf-pill violet">Live</span>
            </div>
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H + 40}`}
              role="img"
              aria-label="Daily donations over the last 7 days"
              style={{ width: '100%', display: 'block' }}
            >
              <defs>
                <linearGradient id="analyticsFill" x1="0" x2="0" y1="0" y2="1">
                  <stop stopColor="var(--violet)" stopOpacity="0.2" />
                  <stop offset="1" stopColor="var(--violet)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              {[0.25, 0.5, 0.75, 1].map((frac) => {
                const y = SVG_H - 20 + scaleY(maxVal * (1 - frac), maxVal, SVG_H - 40);
                return (
                  <line
                    key={frac}
                    x1={CHART_PADDING_X}
                    y1={y}
                    x2={SVG_W - CHART_PADDING_X}
                    y2={y}
                    stroke="var(--b1)"
                    strokeWidth="1"
                  />
                );
              })}
              {/* Area fill */}
              <path d={areaPath} fill="url(#analyticsFill)" />
              {/* Line */}
              <polyline
                points={polylinePoints}
                fill="none"
                stroke="var(--violet)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Dots */}
              {points.map((p) => (
                <circle
                  key={p.day}
                  cx={p.x}
                  cy={p.y}
                  r="6"
                  fill="var(--violet)"
                  stroke="#fff"
                  strokeWidth="3"
                />
              ))}
              {/* X-axis day labels */}
              {points.map((p) => (
                <text
                  key={`label-${p.day}`}
                  x={p.x}
                  y={SVG_H + 32}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--t3)"
                >
                  {p.label}
                </text>
              ))}
            </svg>
          </section>

          {/* Right: campaign performance table */}
          <section className="kf-card">
            <div className="kf-card-head">
              <h2>Campaign Performance</h2>
              <Link href="/dashboard/campaigns" style={{ fontSize: 13, color: 'var(--green-text)' }}>
                View all
              </Link>
            </div>
            {campaigns.length === 0 ? (
              <div
                style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--t3)' }}
              >
                <p>No campaigns yet.</p>
              </div>
            ) : (
              /* Scrolls horizontally and contains no focusable content, so without tabIndex its
                 off-screen columns cannot be reached by keyboard (axe scrollable-region-focusable).
                 A JS comment, not {/* … *\/}: this sits in a JSX *expression* position. */
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              <div className="kf-table-scroll" tabIndex={0} role="region" aria-label="Campaign performance">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--b2)', color: 'var(--t3)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600 }}>Campaign</th>
                    <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600 }}>Raised</th>
                    <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600 }}>Goal</th>
                    <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600 }}>Donors</th>
                    <th style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 600 }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const pct =
                      c.goal_amount > 0
                        ? Math.min(100, Math.round((c.raised_amount / c.goal_amount) * 100))
                        : 0;
                    return (
                      <tr
                        key={c.id}
                        style={{ borderBottom: '1px solid var(--b1)' }}
                      >
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.title}
                          </div>
                          {/* Progress bar */}
                          <div
                            style={{
                              marginTop: 4,
                              height: 4,
                              borderRadius: 2,
                              background: 'var(--b2)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${pct}%`,
                                background: 'var(--green)',
                                borderRadius: 2,
                              }}
                            />
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600, color: 'var(--green-text)' }}>
                          {formatMoneyCompact(c.raised_amount, c.currency ?? 'usd')}
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--t3)' }}>
                          {formatMoneyCompact(c.goal_amount, c.currency ?? 'usd')}
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 8px' }}>
                          {c.backer_count.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 16px' }}>
                          <span className={`kf-pill ${pct >= 75 ? 'green' : pct >= 40 ? 'orange' : 'red'}`}>
                            {pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </section>
        </div>

        {/* Bottom row: Donations by Source donut + Top Performing Days sparklines */}
        <div className="kf-two-col" style={{ marginTop: 24 }}>
          {/* Donations by Campaign */}
          <section className="kf-card">
            <div className="kf-card-head">
              <h2>Donations by Campaign</h2>
              <Link href="/dashboard/campaigns" style={{ fontSize: 13, color: 'var(--green-text)' }}>
                View all
              </Link>
            </div>
            <div style={{ padding: '8px 20px 16px' }}>
              {campaigns.length === 0 ? (
                <p style={{ color: 'var(--t3)', fontSize: 13, paddingTop: 8 }}>No campaigns yet.</p>
              ) : (
                (() => {
                  const bycamp = campaigns
                    .map(c => ({
                      id: c.id,
                      title: c.title,
                      currency: c.currency,
                      total: donations.filter(d => d.campaign_id === c.id).reduce((s, d) => s + d.amount_cents, 0),
                    }))
                    .sort((a, b) => b.total - a.total);
                  const maxTotal = Math.max(...bycamp.map(c => c.total), 1);
                  const colors = ['var(--violet)', 'var(--green)', 'var(--blue)', '#f59e0b', '#ec3fb4'];
                  return bycamp.slice(0, 5).map((c, idx) => {
                    const barPct = (c.total / maxTotal) * 100;
                    return (
                      <div key={c.id} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: 'var(--t2)', fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                          <span style={{ color: 'var(--green-text)', fontWeight: 700 }}>{formatMoneyCompact(c.total, c.currency ?? 'usd')}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: 'var(--b2)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${barPct}%`, background: colors[idx % colors.length], borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </section>

          {/* Top Performing Days sparklines */}
          <section className="kf-card">
            <div className="kf-card-head">
              <h2>Top Performing Days</h2>
            </div>
            <div style={{ padding: '8px 20px 16px' }}>
              {buckets
                .slice()
                .sort((a, b) => b.total - a.total)
                .slice(0, 5)
                .map((b, idx) => {
                  const barPct = maxVal > 0 ? (b.total / maxVal) * 100 : 0;
                  const colors = ['var(--violet)', 'var(--green)', 'var(--blue)', '#f59e0b', '#ec3fb4'];
                  return (
                    <div
                      key={b.day}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}
                    >
                      <span style={{ width: 64, fontSize: 12, color: 'var(--t3)', flexShrink: 0 }}>
                        {b.label}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          background: 'var(--b2)',
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${barPct}%`,
                            background: colors[idx] ?? 'var(--violet)',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <span style={{ width: 72, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                        {fmtCents(b.total)}
                      </span>
                    </div>
                  );
                })}
              {buckets.every((b) => b.total === 0) && (
                <p style={{ color: 'var(--t3)', fontSize: 13, textAlign: 'center', paddingTop: 16 }}>
                  No donations in the last 7 days.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </CharitMeShell>
  );
}
