import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CharitMeShell, KFIcon } from '../../components/CharitMeShellServer';
import AccountMenu from './AccountMenu';
import CampaignSortableList from './CampaignSortableList';
import NotificationBell from '../../components/NotificationBell';
import { requireUser } from '../../lib/auth';
import { supabaseAdmin } from '../../lib/supabase';
import { isAdmin } from '../../lib/roles';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type CampaignRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  goal_amount: number;
  raised_amount: number;
  backer_count: number;
  cover_image_url: string | null;
};

type ActivityItem = {
  title: string;
  time: string;
  initials: string;
};

type ChartDay = {
  label: string;
  amount: number; // cents
};

type DashData = {
  firstName: string;
  userName: string | null;
  campaigns: CampaignRow[];
  totalRaised: number;
  totalDonations: number;
  totalSupporters: number;
  avgDonation: number;
  activity: ActivityItem[];
  chartDays: ChartDay[];
  donorBreakdown: {
    total: number;
    newCount: number;
    returningCount: number;
    anonymousCount: number;
  };
  growthCounts: {
    contentCreated: number;
    peopleReached: number;
    engagement: number;
    newDonors: number;
  };
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

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

function shortNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─────────────────────────────────────────────
// Chart helpers
// ─────────────────────────────────────────────
function buildChart(days: ChartDay[]): {
  linePath: string;
  areaPath: string;
  dots: { x: number; y: number }[];
  yLabels: string[];
} {
  const XS = [42, 124, 206, 288, 370, 452, 534] as const;
  const Y_BOT = 246;
  const Y_TOP = 18;
  const Y_RANGE = Y_BOT - Y_TOP;

  const maxAmt = Math.max(...days.map(d => d.amount), 100); // min 100 cents = $1

  // Round up to a clean label scale
  const dollarsMax = maxAmt / 100;
  const exp = Math.pow(10, Math.floor(Math.log10(dollarsMax)));
  const niceMaxDollars = Math.ceil(dollarsMax / exp) * exp;
  const niceMaxCents = niceMaxDollars * 100;

  const pts = days.map((d, i) => ({
    x: XS[i]!,
    y: Math.max(Y_TOP, Math.round(Y_BOT - (d.amount / niceMaxCents) * Y_RANGE)),
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  const areaPath = `${linePath} L ${last.x} ${Y_BOT} L ${first.x} ${Y_BOT} Z`;

  function cLabel(cents: number): string {
    const d = cents / 100;
    if (d >= 1000) return `$${(d / 1000).toFixed(1)}K`;
    return `$${Math.round(d)}`;
  }

  const yLabels = [
    cLabel(niceMaxCents),
    cLabel(Math.round(niceMaxCents * 0.75)),
    cLabel(Math.round(niceMaxCents * 0.5)),
    cLabel(Math.round(niceMaxCents * 0.25)),
    '$0',
  ];

  return { linePath, areaPath, dots: pts, yLabels };
}

// ─────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────
async function getDashboardData(userId: string): Promise<DashData> {
  const fallback: DashData = {
    firstName: 'there',
    userName: null,
    campaigns: [],
    totalRaised: 0,
    totalDonations: 0,
    totalSupporters: 0,
    avgDonation: 0,
    activity: [],
    chartDays: [],
    donorBreakdown: { total: 0, newCount: 0, returningCount: 0, anonymousCount: 0 },
    growthCounts: { contentCreated: 0, peopleReached: 0, engagement: 0, newDonors: 0 },
  };

  try {
    // ── Phase 1: profile + campaigns ─────────────────
    const [{ data: profile }, { data: campaignData }] = await Promise.all([
      supabaseAdmin.from('profiles').select('full_name').eq('id', userId).single(),
      supabaseAdmin
        .from('campaigns')
        .select('id, title, slug, status, goal_amount, raised_amount, backer_count, cover_image_url')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const campaigns = (campaignData ?? []) as CampaignRow[];
    const totalRaised = campaigns.reduce((s, c) => s + (c.raised_amount ?? 0), 0);
    const totalDonations = campaigns.reduce((s, c) => s + (c.backer_count ?? 0), 0);
    const avgDonation = totalDonations > 0 ? Math.round(totalRaised / totalDonations) : 0;

    const fullName: string | null =
      (profile as { full_name?: string | null } | null)?.full_name ?? null;
    const firstName = fullName ? fullName.split(' ')[0] ?? 'there' : 'there';

    const campaignIds = campaigns.map(c => c.id);
    const totalBackers = campaigns.reduce((s, c) => s + (c.backer_count ?? 0), 0);

    // ── Phase 2: activity + growth data (if user has campaigns) ──
    let activity: ActivityItem[] = [];
    let chartDays: ChartDay[] = [];
    let donorBreakdown = { total: 0, newCount: 0, returningCount: 0, anonymousCount: 0 };
    let growthCounts = { contentCreated: 0, peopleReached: 0, engagement: 0, newDonors: 0 };

    // Build 7-day date range
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]!;

    // Initialize chart days map (last 7 days including today)
    const dayMap = new Map<string, { amount: number; label: string }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0]!;
      const label = new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      dayMap.set(iso, { amount: 0, label });
    }

    if (campaignIds.length > 0) {
      // Parallel: recent donations (activity), chart donations, updates count,
      //           messages count, new donors last 7 days
      const [
        { data: activityDons },
        { data: chartDons },
        { data: breakdownDons },
        { count: updatesCount },
        { count: messagesCount },
        { data: newDonorData },
      ] = await Promise.all([
        supabaseAdmin
          .from('donations')
          .select('id, amount_cents, created_at, donor_id, anonymous')
          .in('campaign_id', campaignIds)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(5),
        supabaseAdmin
          .from('donations')
          .select('amount_cents, created_at')
          .in('campaign_id', campaignIds)
          .eq('status', 'completed')
          .gte('created_at', sevenDaysAgoStr),
        supabaseAdmin
          .from('donations')
          .select('donor_id, anonymous')
          .in('campaign_id', campaignIds)
          .eq('status', 'completed'),
        supabaseAdmin
          .from('campaign_updates')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabaseAdmin
          .from('donor_messages')
          .select('*', { count: 'exact', head: true })
          .in('campaign_id', campaignIds),
        supabaseAdmin
          .from('donations')
          .select('donor_id')
          .in('campaign_id', campaignIds)
          .eq('status', 'completed')
          .gte('created_at', sevenDaysAgoStr)
          .not('donor_id', 'is', null),
      ]);

      // Resolve donor profiles for activity items
      type RawDon = {
        id: string;
        amount_cents: number;
        created_at: string;
        donor_id: string | null;
        anonymous: boolean;
      };
      const activityList = (activityDons ?? []) as RawDon[];

      const activityDonorIds = [
        ...new Set(
          activityList
            .filter(d => d.donor_id && !d.anonymous)
            .map(d => d.donor_id as string),
        ),
      ];
      const activityProfileMap = new Map<string, string>();
      if (activityDonorIds.length > 0) {
        const { data: profileData } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name')
          .in('id', activityDonorIds);
        for (const p of (profileData ?? []) as { id: string; full_name: string | null }[]) {
          if (p.full_name) activityProfileMap.set(p.id, p.full_name);
        }
      }

      activity = activityList.map(d => {
        const donorName =
          d.anonymous || !d.donor_id
            ? 'Anonymous'
            : (activityProfileMap.get(d.donor_id!) ?? 'A donor');
        const ini =
          donorName === 'Anonymous'
            ? '?'
            : donorName
                .split(' ')
                .map((n: string) => n[0] ?? '')
                .join('')
                .slice(0, 2)
                .toUpperCase();
        return {
          title: `${donorName} donated ${fmtCents(d.amount_cents)}`,
          time: timeAgo(d.created_at),
          initials: ini,
        };
      });

      // Donor breakdown — new vs. returning vs. anonymous, computed from
      // every completed donation across the user's campaigns
      const breakdownRows = (breakdownDons ?? []) as { donor_id: string | null; anonymous: boolean }[];
      const donorCounts = new Map<string, number>();
      let anonymousCount = 0;
      for (const row of breakdownRows) {
        if (row.anonymous || !row.donor_id) { anonymousCount += 1; continue; }
        donorCounts.set(row.donor_id, (donorCounts.get(row.donor_id) ?? 0) + 1);
      }
      let newCount = 0;
      let returningCount = 0;
      for (const c of donorCounts.values()) {
        if (c === 1) newCount += 1;
        else returningCount += c;
      }
      donorBreakdown = { total: breakdownRows.length, newCount, returningCount, anonymousCount };

      // Build chart data
      for (const d of (chartDons ?? []) as { amount_cents: number; created_at: string }[]) {
        const key = d.created_at.split('T')[0]!;
        const entry = dayMap.get(key);
        if (entry) entry.amount += d.amount_cents;
      }

      // New donors (unique donor_ids in last 7 days)
      const newDonorIds = new Set(
        (newDonorData ?? []).map((d: { donor_id: string }) => d.donor_id),
      ).size;

      growthCounts = {
        contentCreated: updatesCount ?? 0,
        peopleReached: totalBackers,
        engagement: messagesCount ?? 0,
        newDonors: newDonorIds,
      };
    }

    chartDays = [...dayMap.values()].map(v => ({ label: v.label, amount: v.amount }));

    return {
      firstName,
      userName: fullName,
      campaigns,
      totalRaised,
      totalDonations,
      totalSupporters: totalDonations,
      avgDonation,
      activity,
      chartDays,
      donorBreakdown,
      growthCounts,
    };
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────
// Sample / fallback data (only shown to users with no campaigns)
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function DashboardPage() {
  const user = await requireUser();

  // Admins go directly to the admin panel
  if (await isAdmin(user.id, user.email)) {
    redirect('/admin');
  }

  const data = await getDashboardData(user.id);

  const hasRealCampaigns = data.campaigns.length > 0;

  const metrics = [
    { label: 'Total Raised',     value: fmtCents(data.totalRaised),    change: hasRealCampaigns ? 'all time' : 'no campaigns yet', icon: 'gift',  tone: 'violet' },
    { label: 'Total Donations',  value: String(data.totalDonations),   change: 'all campaigns', icon: 'users', tone: 'green' },
    { label: 'Total Supporters', value: String(data.totalSupporters),  change: 'unique donors', icon: 'team',  tone: 'blue' },
    { label: 'Avg. Donation',    value: fmtCents(data.avgDonation),    change: 'per transaction', icon: 'chart', tone: 'orange' },
  ];

  const displayCampaigns = data.campaigns.slice(0, 3).map(c => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        image: c.cover_image_url ?? 'medical',
        status: capitalize(c.status),
        rawStatus: c.status,
        raised: fmtCents(c.raised_amount),
        goal: fmtCents(c.goal_amount),
        progress: c.goal_amount > 0 ? Math.min(100, Math.round((c.raised_amount / c.goal_amount) * 100)) : 0,
        raisedAmount: c.raised_amount,
        backerCount: c.backer_count,
        donations: String(c.backer_count),
        views: '—',
        conversion: '—',
        href: `/campaigns/${c.slug}`,
      }))
    ;

  // Generate dynamic tasks based on real state
  const tasks: string[][] = [];
  if (hasRealCampaigns) {
    if (data.growthCounts.contentCreated === 0) tasks.push(['Post your first campaign update', 'Due today']);
    else tasks.push([`Post a campaign update`, 'Due today']);
    if (data.growthCounts.newDonors > 0)
      tasks.push([`Thank your ${data.growthCounts.newDonors} new donors`, 'Due today']);
    tasks.push(['Share your campaign on social media', 'Due tomorrow']);
    tasks.push(['Review AI recommendations', 'Due tomorrow']);
  } else {
    tasks.push(['Create your first campaign', 'Get started'], ['Add a cover image & story', 'Step 2'], ['Set your fundraising goal', 'Step 3'], ['Share with friends & family', 'Step 4']);
  }

  // Activity: real donations or empty state
  const displayActivity = data.activity.length > 0
    ? data.activity
    : hasRealCampaigns
      ? [{ title: 'No recent donations yet', time: '', initials: 'KF' }]
      : [];

  // Chart
  const hasChartData = data.chartDays.some(d => d.amount > 0);
  const chart = buildChart(
    data.chartDays.length === 7
      ? data.chartDays
      : Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return {
            label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            amount: 0,
          };
        }),
  );

  // 7-day raised total from chart data
  const weekRaised = data.chartDays.reduce((s, d) => s + d.amount, 0);

  // Donor breakdown — real percentages from completed donations
  const db = data.donorBreakdown;
  const pct = (n: number) => (db.total > 0 ? Math.round((n / db.total) * 100) : 0);
  const donorSegments = [
    { name: 'Returning Donors', count: db.returningCount, percent: pct(db.returningCount), color: '#6c35ff' },
    { name: 'New Donors',       count: db.newCount,       percent: pct(db.newCount),       color: '#ec3fb4' },
    { name: 'Anonymous',        count: db.anonymousCount, percent: pct(db.anonymousCount), color: '#a9afc2' },
  ];
  let cursor = 0;
  const donutStops = donorSegments
    .map((seg) => {
      const start = cursor;
      cursor += seg.percent;
      return `${seg.color} ${start}% ${cursor}%`;
    })
    .join(', ');
  const donutBackground = db.total > 0 ? `conic-gradient(${donutStops})` : '#eee9ff';

  // Growth strip values
  const g = data.growthCounts;

  return (
    <CharitMeShell active="Dashboard" userName={data.userName}>
      <div className="dash-home">
        <header className="dash-head">
          <div>
            <h1>
              Welcome back, {data.firstName}!{' '}
              <span aria-hidden="true">&#128075;</span>
            </h1>
            <p>Here&apos;s what&apos;s happening with your campaigns.</p>
          </div>
          <div className="dash-actions">
            <label className="dash-search">
              <KFIcon name="search" />
              <input placeholder="Search anything..." />
              <kbd>&#8984;K</kbd>
            </label>
            <NotificationBell />
            <AccountMenu name={data.userName ?? data.firstName} email={user.email ?? null} />
          </div>
        </header>

        <section className="dash-grid">
          <main className="dash-main">
            {/* ── Metric cards ── */}
            <div className="dash-metrics">
              {metrics.map(metric => (
                <article className="dash-card dash-metric" key={metric.label}>
                  <span className={`dash-icon ${metric.tone}`}>
                    <KFIcon name={metric.icon} />
                  </span>
                  <div>
                    <p>{metric.label}</p>
                    <strong>{metric.value}</strong>
                    <small>{metric.change}</small>
                  </div>
                </article>
              ))}
            </div>

            {/* ── Campaign panel ── */}
            <CampaignSortableList campaigns={displayCampaigns} hasRealCampaigns={hasRealCampaigns} />
            {/* ── Analytics row ── */}
            <div className="dash-analytics">
              {/* Performance chart */}
              <section className="dash-card performance-card">
                <div className="dash-card-title compact">
                  <h2>Performance Overview</h2>
                  <button>
                    Last 7 Days <span>v</span>
                  </button>
                </div>
                <div className="performance-body">
                  <div className="perf-chart">
                    {chart.yLabels.map(label => (
                      <span key={label}>{label}</span>
                    ))}
                    <svg
                      viewBox="0 0 560 270"
                      role="img"
                      aria-label="7-day donation performance chart"
                    >
                      <defs>
                        <linearGradient
                          id="dashPerf"
                          x1="0"
                          x2="0"
                          y1="0"
                          y2="1"
                        >
                          <stop stopColor="#6c35ff" stopOpacity=".18" />
                          <stop offset="1" stopColor="#6c35ff" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={chart.areaPath} fill="url(#dashPerf)" />
                      <path
                        d={chart.linePath}
                        fill="none"
                        stroke="#7035ff"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {chart.dots.map((pt, i) => (
                        <circle
                          key={i}
                          cx={pt.x}
                          cy={pt.y}
                          r="7"
                          fill="#7035ff"
                          stroke="#fff"
                          strokeWidth="4"
                        />
                      ))}
                    </svg>
                    {hasChartData ? (
                      <div className="perf-tip">
                        <small>{data.chartDays[6]?.label ?? ''}</small>
                        <b>{fmtCents(data.chartDays[6]?.amount ?? 0)}</b>
                      </div>
                    ) : null}
                    <div className="perf-days">
                      {data.chartDays.length === 7
                        ? data.chartDays.map(d => (
                            <span key={d.label}>{d.label}</span>
                          ))
                        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                            <span key={d}>{d}</span>
                          ))}
                    </div>
                  </div>
                  <div className="perf-summary">
                    <PerfNumber
                      value={hasRealCampaigns ? fmtCents(weekRaised) : '$0'}
                      label="Raised this week"
                      change={hasRealCampaigns ? 'last 7 days' : 'no data yet'}
                    />
                    <PerfNumber
                      value={String(data.totalDonations)}
                      label="All-time Donations"
                      change="all campaigns"
                    />
                    <PerfNumber
                      value={String(g.engagement)}
                      label="Donor Messages"
                      change="all time"
                    />
                    <PerfNumber
                      value={String(g.newDonors)}
                      label="New Donors"
                      change="last 7 days"
                    />
                  </div>
                </div>
              </section>

              {/* Donor breakdown donut */}
              <section className="dash-card source-card">
                <h2>Donor Breakdown</h2>
                <div className="source-body">
                  <div className="source-donut" style={{ background: donutBackground }}>
                    <span>
                      <b>{db.total || '—'}</b>
                      <small>Donations</small>
                    </span>
                  </div>
                  <div className="source-list">
                    {donorSegments.map((seg) => (
                      <p key={seg.name}>
                        <i style={{ background: seg.color }} />
                        {seg.name}
                        <b>{db.total > 0 ? `${seg.percent}%` : '—'}</b>
                      </p>
                    ))}
                    <p style={{ fontSize: 11, color: 'var(--t4)', marginTop: 6 }}>
                      {db.total > 0
                        ? 'Based on every completed donation across your campaigns.'
                        : 'Breakdown appears once your campaigns receive donations.'}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </main>

          {/* ── Sidebar ── */}
          <aside className="dash-side">
            <section className="dash-card ai-assistant">
              <div className="assistant-title">
                <h2>
                  <KFIcon name="send" /> AI Assistant <span>*</span>
                </h2>
                <em>Beta</em>
              </div>
              <h3>Good morning, {data.firstName}!</h3>
              <p>I&apos;ve analyzed your campaigns and found opportunities to grow.</p>
              <AssistantAction
                icon="doc"
                tone="grad-1"
                title="Post a video update"
                text="Review current campaign media and publish an update from live records."
              />
              <AssistantAction
                icon="users"
                tone="grad-2"
                title="Re-engage past donors"
                text={
                  data.totalSupporters > 0
                    ? `You have ${data.totalSupporters} past donors you haven’t contacted.`
                    : 'Grow your supporter base with a targeted message.'
                }
              />
              <AssistantAction
                icon="send"
                tone="grad-3"
                title="Boost on social media"
                text="Build the next growth plan from your live campaign analytics."
              />
              <Link href="/dashboard/ai-growth-plan">Ask AI Assistant</Link>
            </section>

            <section className="dash-card task-card">
              <div className="dash-card-title side-title">
                <h2>Your Tasks</h2>
                <Link href="/dashboard/campaigns">View all</Link>
              </div>
              {tasks.slice(0, 4).map(([title, due], index) => (
                <label key={title} className="task-row">
                  <input type="checkbox" />
                  <span>{title}</span>
                  <em className={index < 2 ? 'today' : ''}>{due}</em>
                </label>
              ))}
            </section>

            <section className="dash-card recent-card">
              <div className="dash-card-title side-title">
                <h2>Recent Activity</h2>
                <Link href="/dashboard/donations">View all</Link>
              </div>
              {displayActivity.length === 0 ? (
                <p style={{ padding: '12px 0', fontSize: 13, color: 'var(--t3)' }}>
                  No recent activity yet.
                </p>
              ) : (
                displayActivity.map((item, i) => (
                  <p className="recent-row" key={i}>
                    <span>{item.initials}</span>
                    <b>
                      {item.title}
                      {item.time ? <small>{item.time}</small> : null}
                    </b>
                  </p>
                ))
              )}
            </section>
          </aside>

          {/* ── Growth strip ── */}
          <section className="dash-card growth-strip">
            <div className="growth-brand">
              <span>
                <KFIcon name="send" />
              </span>
              <div>
                <h2>
                  AI Growth Engine <em>New</em>
                </h2>
                <p>Our AI is working to grow your campaigns 24/7</p>
              </div>
            </div>
            <GrowthMetric
              label="Content Created"
              value={shortNum(g.contentCreated)}
              sub="Posts & updates"
            />
            <GrowthMetric
              label="People Reached"
              value={shortNum(g.peopleReached)}
              sub="Total backers"
            />
            <GrowthMetric
              label="Engagement"
              value={shortNum(g.engagement)}
              sub="Donor messages"
            />
            <GrowthMetric
              label="New Donors"
              value={shortNum(g.newDonors)}
              sub="Last 7 days"
            />
            <Link href="/dashboard/analytics">
              View Full Report <span>-&gt;</span>
            </Link>
          </section>
        </section>
      </div>
    </CharitMeShell>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function PerfNumber({
  value,
  label,
  change,
}: {
  value: string;
  label: string;
  change: string;
}) {
  return (
    <p>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{change}</small>
    </p>
  );
}

function AssistantAction({
  icon,
  tone,
  title,
  text,
}: {
  icon: string;
  tone: string;
  title: string;
  text: string;
}) {
  return (
    <article>
      <span className={`assistant-icon ${tone}`}>
        <KFIcon name={icon} />
      </span>
      <div>
        <b>{title}</b>
        <small>{text}</small>
      </div>
    </article>
  );
}

function GrowthMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="growth-metric">
      <span>
        <KFIcon name="chart" />
      </span>
      <p>
        {label}
        <b>{value}</b>
        <small>{sub}</small>
      </p>
    </div>
  );
}
