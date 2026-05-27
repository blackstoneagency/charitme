import Link from 'next/link';
import { KindFundShell, TopBar, MetricGrid, KFIcon } from '../../../components/KindFundShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

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
  const { data: campaignData } = await supabaseAdmin
    .from('campaigns')
    .select('id,title,slug,raised_amount,backer_count,goal_amount,status')
    .eq('user_id', userId);

  const campaigns = (campaignData ?? []) as CampaignRow[];
  const cids = campaigns.map((c) => c.id);

  // Step 2: get completed donations for these campaigns
  let donations: DonationRow[] = [];
  if (cids.length > 0) {
    const { data: donationData } = await supabaseAdmin
      .from('donations')
      .select('amount_cents,created_at,campaign_id')
      .in('campaign_id', cids)
      .eq('status', 'completed');
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
  // Placeholder: 12,450 views (no view tracking in schema)
  const PLACEHOLDER_VIEWS = 12450;
  const conversionRate = ((totalBackers / PLACEHOLDER_VIEWS) * 100).toFixed(1);

  // Best performing campaign
  const bestCampaign =
    campaigns.length > 0
      ? campaigns.reduce((best, c) =>
          c.raised_amount > best.raised_amount ? c : best
        )
      : null;

  const metrics = [
    { label: 'Raised This Week', value: fmtCents(weeklyRaised), change: 'last 7 days', icon: 'gift', tone: 'violet' as const },
    { label: 'Raised This Month', value: fmtCents(monthlyRaised), change: 'last 30 days', icon: 'chart', tone: 'green' as const },
    { label: 'Conversion Rate', value: `${conversionRate}%`, change: 'est. from backers / views', icon: 'filter', tone: 'orange' as const },
    { label: 'Top Campaign', value: bestCampaign ? fmtCents(bestCampaign.raised_amount) : '$0', change: bestCampaign ? bestCampaign.title.slice(0, 28) + (bestCampaign.title.length > 28 ? '…' : '') : 'No campaigns yet', icon: 'send', tone: 'blue' as const },
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
    <KindFundShell active="Analytics">
      <TopBar
        title="Analytics"
        subtitle="Track your performance and grow your impact."
        actions={
          <button className="kf-outline">
            <KFIcon name="upload" /> Export
          </button>
        }
      />

      <div style={{ padding: '0 32px 32px' }}>
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
                  <stop stopColor="#6c35ff" stopOpacity="0.2" />
                  <stop offset="1" stopColor="#6c35ff" stopOpacity="0" />
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
                    stroke="#eef0f7"
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
                stroke="#6c35ff"
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
                  fill="#6c35ff"
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
                  fill="#a9afc2"
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
              <Link href="/dashboard/campaigns" style={{ fontSize: 13, color: 'var(--green)' }}>
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
                        <td style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600, color: 'var(--green)' }}>
                          {fmtCents(c.raised_amount)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--t3)' }}>
                          {fmtCents(c.goal_amount)}
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
            )}
          </section>
        </div>

        {/* Bottom row: Donations by Source donut + Top Performing Days sparklines */}
        <div className="kf-two-col" style={{ marginTop: 24 }}>
          {/* Donations by Source (static donut) */}
          <section className="kf-card kf-donut-card">
            <div className="kf-card-head">
              <h2>Donations by Source</h2>
              <Link href="#" style={{ fontSize: 13, color: 'var(--green)' }}>
                View details
              </Link>
            </div>
            <div className="kf-donut-wrap">
              <div className="kf-donut">
                <span>
                  <strong>{totalBackers}</strong>
                  <small>Donors</small>
                </span>
              </div>
              <div>
                {(
                  [
                    ['Facebook', '32%', '#6c35ff'],
                    ['Instagram', '24%', '#ec3fb4'],
                    ['Direct / Email', '18%', '#2f80ed'],
                    ['Google', '12%', '#19b86a'],
                    ['Other', '14%', '#f59e0b'],
                  ] as [string, string, string][]
                ).map(([label, pct, color]) => (
                  <p key={label}>
                    <i style={{ background: color }} /> {label}
                    <b>{pct}</b>
                  </p>
                ))}
              </div>
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
                  const colors = ['#6c35ff', '#19b86a', '#2f80ed', '#f59e0b', '#ec3fb4'];
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
                            background: colors[idx] ?? '#6c35ff',
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
    </KindFundShell>
  );
}
