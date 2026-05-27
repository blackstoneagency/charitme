import Link from 'next/link';
import { KindFundShell, KFIcon } from '../../components/KindFundShellServer';
import { requireUser } from '../../lib/auth';
import { supabaseAdmin } from '../../lib/supabase';

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

type DashData = {
  firstName: string;
  userName: string | null;
  campaigns: CampaignRow[];
  totalRaised: number;
  totalDonations: number;
  totalSupporters: number;
  avgDonation: number;
};

// ─────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────
async function getDashboardData(userId: string): Promise<DashData> {
  try {
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

    const fullName: string | null = (profile as { full_name?: string | null } | null)?.full_name ?? null;
    const firstName = fullName ? fullName.split(' ')[0] : 'there';

    return {
      firstName,
      userName: fullName,
      campaigns,
      totalRaised,
      totalDonations,
      totalSupporters: totalDonations, // backer_count ≈ supporter count
      avgDonation,
    };
  } catch {
    return {
      firstName: 'there',
      userName: null,
      campaigns: [],
      totalRaised: 0,
      totalDonations: 0,
      totalSupporters: 0,
      avgDonation: 0,
    };
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${dollars.toFixed(2)}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ─────────────────────────────────────────────
// Sample / fallback data for empty-state users
// ─────────────────────────────────────────────
const SAMPLE_CAMPAIGNS = [
  {
    title: 'Help Mia Get Life-Saving Heart Surgery',
    image: '/hero-child-crop.png',
    status: 'Active',
    raised: '$24,350',
    goal: '$50,000',
    progress: 49,
    donations: '487',
    views: '12,450',
    conversion: '3.9%',
    href: '/create',
  },
  {
    title: 'Support Our Family After House Fire',
    image: 'family',
    status: 'Active',
    raised: '$8,420',
    goal: '$15,000',
    progress: 56,
    donations: '162',
    views: '5,230',
    conversion: '3.1%',
    href: '/create',
  },
  {
    title: 'Emergency Vet Care for Max',
    image: 'dog',
    status: 'Paused',
    raised: '$1,580',
    goal: '$3,000',
    progress: 53,
    donations: '38',
    views: '1,120',
    conversion: '3.4%',
    href: '/create',
  },
];

const SAMPLE_METRICS = [
  { label: 'Total Raised',      value: '$24,350', change: '+ 28% vs last 7 days', icon: 'gift',  tone: 'violet' },
  { label: 'Total Donations',   value: '487',     change: '+ 18% vs last 7 days', icon: 'users', tone: 'green' },
  { label: 'Total Supporters',  value: '563',     change: '+ 22% vs last 7 days', icon: 'team',  tone: 'blue' },
  { label: 'Avg. Donation',     value: '$52.84',  change: '+ 9% vs last 7 days',  icon: 'chart', tone: 'orange' },
];

const TASKS = [
  ['Post campaign update', 'Due today'],
  ['Thank new donors (12)', 'Due today'],
  ['Send update email', 'Due tomorrow'],
  ['Review AI recommendations', 'Due tomorrow'],
];

const ACTIVITY = [
  ['James Miller donated $100', '2 min ago', 'JM'],
  ['Sophia Chen shared your campaign', '15 min ago', 'SC'],
  ['You received a new message', '1 hr ago', 'KF'],
];

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user.id);

  const hasRealCampaigns = data.campaigns.length > 0;

  // Build metrics from real data (or show zeros with a "start fundraising" nudge)
  const metrics = hasRealCampaigns
    ? [
        { label: 'Total Raised',     value: fmtCents(data.totalRaised),    change: 'all time',          icon: 'gift',  tone: 'violet' },
        { label: 'Total Donations',  value: String(data.totalDonations),   change: 'all campaigns',     icon: 'users', tone: 'green' },
        { label: 'Total Supporters', value: String(data.totalSupporters),  change: 'unique donors',     icon: 'team',  tone: 'blue' },
        { label: 'Avg. Donation',    value: fmtCents(data.avgDonation),    change: 'per transaction',   icon: 'chart', tone: 'orange' },
      ]
    : SAMPLE_METRICS;

  // Map real campaigns to display shape
  const displayCampaigns = hasRealCampaigns
    ? data.campaigns.slice(0, 3).map((c) => ({
        title: c.title,
        image: c.cover_image_url ?? 'medical',
        status: capitalize(c.status),
        raised: fmtCents(c.raised_amount),
        goal: fmtCents(c.goal_amount),
        progress: c.goal_amount > 0 ? Math.min(100, Math.round((c.raised_amount / c.goal_amount) * 100)) : 0,
        donations: String(c.backer_count),
        views: '—',
        conversion: '—',
        href: `/dashboard/campaigns`,
      }))
    : SAMPLE_CAMPAIGNS;

  return (
    <KindFundShell active="Dashboard" userName={data.userName}>
      <div className="dash-home">
        <header className="dash-head">
          <div>
            <h1>Welcome back, {data.firstName}! <span aria-hidden="true">&#128075;</span></h1>
            <p>Here&apos;s what&apos;s happening with your campaigns.</p>
          </div>
          <div className="dash-actions">
            <label className="dash-search">
              <KFIcon name="search" />
              <input placeholder="Search anything..." />
              <kbd>&#8984;K</kbd>
            </label>
            <button className="dash-bell" aria-label="Notifications"><KFIcon name="bell" /><span>8</span></button>
            <div className="dash-photo" />
          </div>
        </header>

        <section className="dash-grid">
          <main className="dash-main">
            <div className="dash-metrics">
              {metrics.map((metric) => (
                <article className="dash-card dash-metric" key={metric.label}>
                  <span className={`dash-icon ${metric.tone}`}><KFIcon name={metric.icon} /></span>
                  <div>
                    <p>{metric.label}</p>
                    <strong>{metric.value}</strong>
                    <small>{metric.change}</small>
                  </div>
                </article>
              ))}
            </div>

            <section className="dash-card campaign-panel">
              <div className="dash-card-title">
                <h2>Your Campaigns</h2>
                <button>Sort by: Performance <span>v</span></button>
              </div>

              {!hasRealCampaigns && (
                <div style={{ padding: '12px 20px 4px' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', borderRadius: '10px',
                    background: 'rgba(108,53,255,0.07)', border: '1px solid rgba(108,53,255,0.15)',
                    fontSize: '13px', fontWeight: 700, color: '#4e16f5',
                  }}>
                    <KFIcon name="send" />
                    <span>These are example campaigns — <Link href="/create" style={{ textDecoration: 'underline' }}>create your first campaign</Link> to see real data here.</span>
                  </div>
                </div>
              )}

              <div className="campaign-list">
                {displayCampaigns.map((campaign) => (
                  <article className="campaign-item" key={campaign.title}>
                    <CampaignImage image={campaign.image} />
                    <div className="campaign-copy">
                      <span className={`campaign-status ${campaign.status.toLowerCase()}`}>{campaign.status}</span>
                      <h3>{campaign.title}</h3>
                      <p><b>{campaign.raised}</b> raised of {campaign.goal} goal</p>
                      <div className="campaign-progress"><span style={{ width: `${campaign.progress}%` }} /></div>
                    </div>
                    <CampaignStat value={campaign.donations} label="Donations" />
                    <CampaignStat value={campaign.views} label="Views" />
                    <CampaignStat value={campaign.conversion} label="Conversion" />
                    <Link className="campaign-detail" href={campaign.href}>View Details <span>&gt;</span></Link>
                    <button className="campaign-menu" aria-label={`More options for ${campaign.title}`}>...</button>
                  </article>
                ))}
              </div>
              <Link href="/dashboard/campaigns" className="campaign-footer">View All Campaigns <span>-&gt;</span></Link>
            </section>

            <div className="dash-analytics">
              <section className="dash-card performance-card">
                <div className="dash-card-title compact">
                  <h2>Performance Overview</h2>
                  <button>Last 7 Days <span>v</span></button>
                </div>
                <div className="performance-body">
                  <div className="perf-chart">
                    <span>$2K</span><span>$1.5K</span><span>$1K</span><span>$500</span><span>$0</span>
                    <svg viewBox="0 0 560 270" role="img" aria-label="Performance line chart">
                      <defs><linearGradient id="dashPerf" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#6c35ff" stopOpacity=".18" /><stop offset="1" stopColor="#6c35ff" stopOpacity="0" /></linearGradient></defs>
                      <path d="M42 220 L102 190 L160 188 L220 130 L278 112 L338 138 L388 116 L436 78 L486 58 L534 18 L534 246 L42 246Z" fill="url(#dashPerf)" />
                      <path d="M42 220 L102 190 L160 188 L220 130 L278 112 L338 138 L388 116 L436 78 L486 58 L534 18" fill="none" stroke="#7035ff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                      {[42,102,160,220,278,338,388,436,486,534].map((x, i) => <circle key={x} cx={x} cy={[220,190,188,130,112,138,116,78,58,18][i]} r="7" fill="#7035ff" stroke="#fff" strokeWidth="4" />)}
                    </svg>
                    <div className="perf-tip"><small>May 17, 2024</small><b>$1,240</b></div>
                    <div className="perf-days"><span>May 14</span><span>May 15</span><span>May 16</span><span>May 17</span><span>May 18</span><span>May 19</span><span>May 20</span></div>
                  </div>
                  <div className="perf-summary">
                    <PerfNumber value={fmtCents(data.totalRaised) || '$3,420'} label="Raised this week" change="+ 28%" />
                    <PerfNumber value={String(data.totalDonations) || '487'} label="Donations" change="+ 18%" />
                    <PerfNumber value="12,450" label="Views" change="+ 36%" />
                    <PerfNumber value="3.9%" label="Conversion Rate" change="+ 12%" />
                  </div>
                </div>
              </section>

              <section className="dash-card source-card">
                <h2>Donations by Source</h2>
                <div className="source-body">
                  <div className="source-donut"><span><b>{data.totalDonations || 487}</b><small>Total</small></span></div>
                  <div className="source-list">
                    {[
                      ['Facebook', '32%', '#6c35ff'],
                      ['Instagram', '24%', '#ec3fb4'],
                      ['Direct / Email', '18%', '#2f80ed'],
                      ['Google', '12%', '#19b86a'],
                      ['TikTok', '7%', '#f59e0b'],
                      ['Other', '7%', '#a9afc2'],
                    ].map(([name, percent, color]) => <p key={name}><i style={{ background: color }} />{name}<b>{percent}</b></p>)}
                  </div>
                </div>
              </section>
            </div>
          </main>

          <aside className="dash-side">
            <section className="dash-card ai-assistant">
              <div className="assistant-title"><h2><KFIcon name="send" /> AI Assistant <span>*</span></h2><em>Beta</em></div>
              <h3>Good morning, {data.firstName}!</h3>
              <p>I&apos;ve analyzed your campaigns and found opportunities to grow.</p>
              <AssistantAction icon="doc" tone="violet" title="Post a video update" text="Campaigns with video get 3x more donations." />
              <AssistantAction icon="users" tone="green" title="Re-engage past donors" text="You have 78 past donors you haven&apos;t contacted." />
              <AssistantAction icon="send" tone="orange" title="Boost on social media" text="Your campaign could reach 2.5x more people with a boost." />
              <button>Ask AI Assistant</button>
            </section>

            <section className="dash-card task-card">
              <div className="dash-card-title side-title"><h2>Your Tasks</h2><Link href="#">View all</Link></div>
              {TASKS.map(([title, due], index) => (
                <label key={title} className="task-row">
                  <input type="checkbox" />
                  <span>{title}</span>
                  <em className={index < 2 ? 'today' : ''}>{due}</em>
                </label>
              ))}
            </section>

            <section className="dash-card recent-card">
              <div className="dash-card-title side-title"><h2>Recent Activity</h2><Link href="#">View all</Link></div>
              {ACTIVITY.map(([title, time, initials]) => (
                <p className="recent-row" key={title}><span>{initials}</span><b>{title}<small>{time}</small></b></p>
              ))}
            </section>
          </aside>

          <section className="dash-card growth-strip">
            <div className="growth-brand"><span><KFIcon name="send" /></span><div><h2>AI Growth Engine <em>New</em></h2><p>Our AI is working to grow your campaigns 24/7</p></div></div>
            <GrowthMetric label="Content Created" value="24" sub="Posts &amp; updates" />
            <GrowthMetric label="People Reached" value="18,450" sub="+ 32% this week" />
            <GrowthMetric label="Engagement" value="2,340" sub="+ 28% this week" />
            <GrowthMetric label="New Donors" value="78" sub="+ 22% this week" />
            <Link href="/dashboard/analytics">View Full Report <span>-&gt;</span></Link>
          </section>
        </section>
      </div>
    </KindFundShell>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function CampaignImage({ image }: { image: string }) {
  if (image.startsWith('/')) return <div className="campaign-img" style={{ backgroundImage: `url(${image})` }} />;
  return <div className={`campaign-img ${image}`} />;
}

function CampaignStat({ value, label }: { value: string; label: string }) {
  return <div className="campaign-stat"><strong>{value}</strong><span>{label}</span></div>;
}

function PerfNumber({ value, label, change }: { value: string; label: string; change: string }) {
  return <p><strong>{value}</strong><span>{label}</span><small>{change} vs last week</small></p>;
}

function AssistantAction({ icon, tone, title, text }: { icon: string; tone: string; title: string; text: string }) {
  return <article><span className={`dash-icon ${tone}`}><KFIcon name={icon} /></span><div><b>{title}</b><small>{text}</small></div></article>;
}

function GrowthMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="growth-metric"><span><KFIcon name="chart" /></span><p>{label}<b>{value}</b><small>{sub}</small></p></div>;
}
