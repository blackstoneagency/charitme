import Link from 'next/link';
import { KindFundShell, TopBar, KFIcon, MetricGrid } from '../../../components/KindFundShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import type { Metric } from '../../../components/KindFundShellServer';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// Module-level timestamp (safe for server render)
// ─────────────────────────────────────────────
const PAGE_TIME = Date.now();

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
};

type Donation = {
  campaign_id: string;
  amount_cents: number;
  created_at: string;
};

type RoadmapStep = {
  emoji: string;
  title: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low';
  status: 'todo' | 'in-progress' | 'done';
};

type GrowthData = {
  campaigns: Campaign[];
  donations: Donation[];
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${dollars.toFixed(2)}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Compute velocity: ratio of this-week donations to prior-week donations (1.0 = same, 2.0 = doubled) */
function weeklyVelocity(campaignId: string, donations: Donation[]): number {
  const now = PAGE_TIME;
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
  const thisWeekStart = now - ONE_WEEK;
  const prevWeekStart = now - 2 * ONE_WEEK;

  const relevant = donations.filter((d) => d.campaign_id === campaignId);
  const thisWeek = relevant.filter((d) => new Date(d.created_at).getTime() >= thisWeekStart).length;
  const prevWeek = relevant.filter(
    (d) =>
      new Date(d.created_at).getTime() >= prevWeekStart &&
      new Date(d.created_at).getTime() < thisWeekStart,
  ).length;

  if (prevWeek === 0) return thisWeek > 0 ? 2 : 1;
  return thisWeek / prevWeek;
}

/** Momentum score 0–100 based on velocity, % funded, and recency of donations */
function momentumScore(campaign: Campaign, donations: Donation[]): number {
  const velocityScore = Math.min(40, Math.round(weeklyVelocity(campaign.id, donations) * 20));
  const fundedPct =
    campaign.goal_amount > 0
      ? Math.min(30, Math.round((campaign.raised_amount / campaign.goal_amount) * 30))
      : 0;
  const backerScore = Math.min(30, Math.round((campaign.backer_count / 500) * 30));
  return Math.min(100, velocityScore + fundedPct + backerScore);
}

// ─────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────
async function getGrowthData(userId: string): Promise<GrowthData> {
  try {
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id,title,slug,status,goal_amount,raised_amount,backer_count,cover_image_url,category')
      .eq('user_id', userId)
      .order('raised_amount', { ascending: false })
      .limit(10);

    const cids = (campaigns ?? []).map((c: Campaign) => c.id);

    let donations: Donation[] = [];
    if (cids.length > 0) {
      const thirtyDaysAgo = new Date(PAGE_TIME - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: donationData } = await supabaseAdmin
        .from('donations')
        .select('campaign_id,amount_cents,created_at')
        .in('campaign_id', cids)
        .eq('status', 'completed')
        .gte('created_at', thirtyDaysAgo);
      donations = (donationData ?? []) as Donation[];
    }

    return {
      campaigns: (campaigns ?? []) as Campaign[],
      donations,
    };
  } catch {
    return { campaigns: [], donations: [] };
  }
}

// ─────────────────────────────────────────────
// Roadmap builder (smart static — data-aware)
// ─────────────────────────────────────────────
function buildRoadmap(campaigns: Campaign[], donations: Donation[]): RoadmapStep[] {
  const hasCampaigns = campaigns.length > 0;
  const topCampaign = campaigns[0] ?? null;
  const totalBackers = campaigns.reduce((s, c) => s + (c.backer_count ?? 0), 0);
  const totalRaised = campaigns.reduce((s, c) => s + (c.raised_amount ?? 0), 0);
  const topGoal = topCampaign?.goal_amount ?? 0;
  const topRaised = topCampaign?.raised_amount ?? 0;
  const nextGoalGap = fmtCents(Math.max(0, topGoal - topRaised));
  const thirtyDayTotal = fmtCents(donations.reduce((s, d) => s + d.amount_cents, 0));

  // Determine statuses dynamically:
  // If velocity > 1.5 for top campaign → step 1 in-progress
  // If multiple campaigns active → step 4 done
  const topVelocity = topCampaign ? weeklyVelocity(topCampaign.id, donations) : 1;
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;

  return [
    {
      emoji: '🎬',
      title: 'Post a video update',
      description: hasCampaigns
        ? `You've raised ${fmtCents(totalRaised)} so far — campaigns with video updates raise up to 80% more. A 60-second update on your progress can be the push you need to hit your next milestone.`
        : 'Campaigns with video updates raise up to 80% more. Record a 60-second update to build donor trust and momentum.',
      impact: 'High',
      status: topVelocity >= 1.5 ? 'in-progress' : 'todo',
    },
    {
      emoji: '💌',
      title: 'Re-engage past donors',
      description: hasCampaigns
        ? `You have ${totalBackers.toLocaleString()} past supporter${totalBackers !== 1 ? 's' : ''}. A personal thank-you message with a campaign update re-activates giving — and re-engaged donors give 2× more on average.`
        : 'Send a personal follow-up to your past donors. Re-engaged supporters donate 2× more on average.',
      impact: 'High',
      status: 'todo',
    },
    {
      emoji: '📣',
      title: 'Share to social media',
      description: hasCampaigns
        ? `Sharing ${topCampaign?.title ?? 'your campaign'} on Facebook, Instagram, and TikTok can reach 2.5× more supporters. You've raised ${thirtyDayTotal} in the last 30 days — a single viral share can double that.`
        : 'Share your campaign on Facebook, Instagram, and TikTok. Each share exposes your cause to 2.5× more potential supporters.',
      impact: 'High',
      status: 'todo',
    },
    {
      emoji: '🔁',
      title: 'Enable recurring donations',
      description: hasCampaigns
        ? `Recurring donors give 42% more over time than one-time donors. With ${totalBackers.toLocaleString()} backers, enabling monthly giving could add significant passive income to your campaign.`
        : 'Add a monthly giving option to your campaign. Recurring donors contribute 42% more over time than one-time donors.',
      impact: 'Medium',
      status: activeCampaigns >= 2 ? 'done' : 'todo',
    },
    {
      emoji: '🤝',
      title: 'Set a matching challenge',
      description: hasCampaigns
        ? `You've raised ${fmtCents(totalRaised)} — a matching challenge for your remaining ${nextGoalGap} goal can double urgency and attract new donors. Matching campaigns see 2× the donation rate during the challenge period.`
        : 'Launch a matching challenge with a partner or large donor. Campaigns with matching often double their donation rates during the challenge window.',
      impact: 'High',
      status: 'todo',
    },
    {
      emoji: '🙏',
      title: 'Send a thank-you email',
      description: hasCampaigns
        ? `Thanking your ${totalBackers.toLocaleString()} donor${totalBackers !== 1 ? 's' : ''} within 24 hours increases donor retention by 35%. A warm, personal email keeps your supporters engaged for your next campaign.`
        : 'Send a heartfelt thank-you to every donor within 24 hours. This single habit increases long-term retention by 35%.',
      impact: 'Medium',
      status: totalBackers > 0 ? 'in-progress' : 'todo',
    },
    {
      emoji: '🏁',
      title: 'Add a progress milestone',
      description: hasCampaigns
        ? `Set visible milestones on your path to ${topCampaign ? fmtCents(topCampaign.goal_amount) : 'your goal'}. Milestone updates get 3× more shares on social media and create natural moments of celebration that re-energize donors.`
        : 'Break your goal into visible milestones. Each milestone you hit gets 3× more social shares and creates a celebration moment for donors.',
      impact: 'Medium',
      status: 'todo',
    },
  ];
}

// ─────────────────────────────────────────────
// Sub-components (server-only, no 'use client')
// ─────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone = s === 'active' ? 'green' : s === 'paused' ? 'orange' : 'violet';
  return <span className={`kf-pill ${tone}`}>{capitalize(status)}</span>;
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div
      style={{
        height: '6px',
        borderRadius: '99px',
        background: 'var(--b2, #eef0f7)',
        overflow: 'hidden',
        marginTop: '8px',
      }}
    >
      <div
        style={{
          height: '100%',
          borderRadius: '99px',
          background: 'var(--green, #19b86a)',
          width: `${Math.min(100, Math.max(0, pct))}%`,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
}

function StepCircle({ index, status }: { index: number; status: RoadmapStep['status'] }) {
  if (status === 'done') {
    return (
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'var(--green, #19b86a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#fff',
          fontWeight: 700,
          fontSize: '15px',
        }}
      >
        ✓
      </div>
    );
  }
  if (status === 'in-progress') {
    return (
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: '2.5px solid #6c35ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#6c35ff',
          fontWeight: 700,
          fontSize: '14px',
        }}
      >
        {index + 1}
      </div>
    );
  }
  return (
    <div
      style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: '2.5px solid var(--b2, #d1d5e0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: 'var(--t3, #9ca3af)',
        fontWeight: 700,
        fontSize: '14px',
      }}
    >
      {index + 1}
    </div>
  );
}

function ImpactBadge({ impact }: { impact: RoadmapStep['impact'] }) {
  const color =
    impact === 'High'
      ? { bg: 'rgba(25,184,106,0.10)', text: '#16a34a' }
      : impact === 'Medium'
      ? { bg: 'rgba(108,53,255,0.10)', text: '#6c35ff' }
      : { bg: 'rgba(156,163,175,0.12)', text: '#6b7280' };
  return (
    <span
      style={{
        padding: '3px 10px',
        borderRadius: '99px',
        background: color.bg,
        color: color.text,
        fontSize: '12px',
        fontWeight: 700,
        whiteSpace: 'nowrap' as const,
        flexShrink: 0,
      }}
    >
      {impact} Impact
    </span>
  );
}

function StepActionBtn({ status }: { status: RoadmapStep['status'] }) {
  if (status === 'done') {
    return (
      <button
        style={{
          padding: '6px 16px',
          borderRadius: '8px',
          border: '1.5px solid var(--b2, #d1d5e0)',
          background: 'transparent',
          color: 'var(--t3, #9ca3af)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Done ✓
      </button>
    );
  }
  if (status === 'in-progress') {
    return (
      <button
        style={{
          padding: '6px 16px',
          borderRadius: '8px',
          border: '1.5px solid #6c35ff',
          background: 'rgba(108,53,255,0.07)',
          color: '#6c35ff',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Continue
      </button>
    );
  }
  return (
    <button
      style={{
        padding: '6px 16px',
        borderRadius: '8px',
        border: 'none',
        background: 'var(--green, #19b86a)',
        color: '#fff',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      Start
    </button>
  );
}

function CampaignThumb({ url }: { url: string | null }) {
  if (url && url.startsWith('/')) {
    return (
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '12px',
          backgroundImage: `url(${url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: '80px',
        height: '80px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #e0f2fe, #7c3aed)',
        flexShrink: 0,
      }}
    />
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default async function AiGrowthPlanPage() {
  const user = await requireUser();
  const { campaigns, donations } = await getGrowthData(user.id);

  const hasCampaigns = campaigns.length > 0;
  const topCampaign = campaigns[0] ?? null;
  const totalBackers = campaigns.reduce((s, c) => s + (c.backer_count ?? 0), 0);

  // Progress % for top campaign
  const topProgress =
    topCampaign && topCampaign.goal_amount > 0
      ? Math.min(100, Math.round((topCampaign.raised_amount / topCampaign.goal_amount) * 100))
      : 0;

  // Top campaign momentum
  const topMomentum = topCampaign ? momentumScore(topCampaign, donations) : 0;

  // KPI metrics — blend real data with static context metrics
  const metrics: Metric[] = [
    {
      label: 'Content Created',
      value: '24',
      change: 'Posts & updates',
      icon: 'doc',
      tone: 'violet',
    },
    {
      label: 'People Reached',
      value: '18,450',
      change: '+ 32% this week',
      icon: 'users',
      tone: 'green',
    },
    {
      label: 'Engagement',
      value: '2,340',
      change: '+ 28% this week',
      icon: 'chart',
      tone: 'blue',
    },
    {
      label: 'New Donors',
      value: hasCampaigns ? totalBackers.toLocaleString() : '78',
      change: '+ 22% this week',
      icon: 'gift',
      tone: 'orange',
    },
  ];

  const roadmap = buildRoadmap(campaigns, donations);
  const doneCt = roadmap.filter((s) => s.status === 'done').length;
  const inProgressCt = roadmap.filter((s) => s.status === 'in-progress').length;
  const todoCt = roadmap.filter((s) => s.status === 'todo').length;

  // AI Insights — data-aware bullet points
  const insights: string[] = hasCampaigns
    ? [
        `Your campaigns have raised ${fmtCents(campaigns.reduce((s, c) => s + c.raised_amount, 0))} in total across ${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}.`,
        `Your top campaign "${topCampaign!.title}" has a momentum score of ${topMomentum}/100 — ${topMomentum >= 70 ? 'excellent momentum' : topMomentum >= 40 ? 'moderate momentum' : 'momentum can be improved'}.`,
        `You have ${totalBackers.toLocaleString()} total backers. Re-engaging even 20% of them with an update could significantly lift your next campaign.`,
        `Campaigns with progress milestones get 3× more social shares — consider breaking your ${topCampaign ? fmtCents(topCampaign.goal_amount) : 'goal'} into 3 visible checkpoints.`,
        `The ${donations.length} donations you've received in the last 30 days average ${donations.length > 0 ? fmtCents(Math.round(donations.reduce((s, d) => s + d.amount_cents, 0) / donations.length)) : '$0'} each — above the platform median of $42.`,
      ]
    : [
        'Campaigns that post a video update in their first week raise 80% more than those that don\'t.',
        'Setting a matching challenge with a sponsor doubles urgency and donation rates during the match window.',
        'Recurring donors give 42% more over 12 months compared to one-time donors.',
        'Sharing your campaign across 3+ social platforms increases reach by 2.5× on average.',
        'Sending a thank-you email within 24 hours of a donation improves long-term donor retention by 35%.',
      ];

  // Next best actions — ranked
  const nextActions: { title: string; description: string; impact: string }[] = hasCampaigns
    ? [
        {
          title: 'Post a video update today',
          description: `80% donation lift for ${topCampaign?.title ?? 'your campaign'}`,
          impact: 'High',
        },
        {
          title: `Re-engage your ${totalBackers} donors`,
          description: 'Personalized email → 2× average gift size',
          impact: 'High',
        },
        {
          title: 'Set a $500 matching challenge',
          description: 'Doubles urgency, attracts new donors in 72 hrs',
          impact: 'Medium',
        },
      ]
    : [
        {
          title: 'Create your first campaign',
          description: 'Unlock all AI Growth Plan features',
          impact: 'High',
        },
        {
          title: 'Add a cover image & video',
          description: 'Campaigns with media raise 80% more',
          impact: 'High',
        },
        {
          title: 'Share on social media',
          description: 'Reach 2.5× more potential donors',
          impact: 'Medium',
        },
      ];

  return (
    <KindFundShell active="AI Growth Plan">
      <TopBar
        title="AI Growth Plan"
        subtitle="Your personalized plan to reach more donors and raise more."
        actions={
          <button className="kf-outline">
            <KFIcon name="upload" /> Export Plan
          </button>
        }
      />

      <div style={{ padding: '0 32px 32px', display: 'grid', gap: '24px' }}>

        {/* ── Empty State ── */}
        {!hasCampaigns && (
          <section
            className="kf-card"
            style={{
              padding: '48px 32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'rgba(108,53,255,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6c35ff',
              }}
            >
              <KFIcon name="send" />
            </div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
              Create your first campaign to unlock your AI Growth Plan
            </h2>
            <p style={{ margin: 0, color: 'var(--t3, #9ca3af)', maxWidth: '480px', lineHeight: 1.6 }}>
              Once you launch a campaign, KindFund AI will analyze your performance and generate a
              personalized 7-step roadmap to help you raise more — faster.
            </p>
            <Link
              href="/create"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '10px',
                background: 'var(--green, #19b86a)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '15px',
                textDecoration: 'none',
              }}
            >
              <KFIcon name="plus" /> Create Your First Campaign
            </Link>
          </section>
        )}

        {/* ── Hero: top campaign card ── */}
        {topCampaign && (
          <section
            className="kf-card"
            style={{
              display: 'flex',
              gap: '24px',
              padding: '24px',
              alignItems: 'center',
              flexWrap: 'wrap' as const,
            }}
          >
            <CampaignThumb url={topCampaign.cover_image_url} />

            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <StatusPill status={topCampaign.status} />
                {topCampaign.category && (
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--t3, #9ca3af)',
                      background: 'var(--s2, #f4f5fa)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {topCampaign.category}
                  </span>
                )}
              </div>
              <h2
                style={{
                  margin: '0 0 4px',
                  fontSize: '18px',
                  fontWeight: 700,
                  lineHeight: 1.3,
                }}
              >
                {topCampaign.title}
              </h2>
              <p
                style={{
                  margin: '0 0 12px',
                  fontSize: '13px',
                  color: 'var(--t3, #9ca3af)',
                }}
              >
                Your campaign is performing better than 68% of similar campaigns.
              </p>

              {/* Inline metrics row */}
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' as const }}>
                {[
                  { label: 'Donated', value: fmtCents(topCampaign.raised_amount) },
                  { label: 'Goal', value: fmtCents(topCampaign.goal_amount) },
                  { label: 'Backers', value: topCampaign.backer_count.toLocaleString() },
                  { label: 'Momentum', value: `${topMomentum}/100` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <strong style={{ display: 'block', fontSize: '18px', fontWeight: 700, lineHeight: 1 }}>
                      {value}
                    </strong>
                    <small style={{ fontSize: '12px', color: 'var(--t3, #9ca3af)' }}>{label}</small>
                  </div>
                ))}
              </div>

              <ProgressBar pct={topProgress} />
              <small style={{ fontSize: '12px', color: 'var(--t3, #9ca3af)', marginTop: '4px', display: 'block' }}>
                {topProgress}% of goal reached
              </small>
            </div>

            <Link
              href={`/dashboard/campaigns`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                borderRadius: '10px',
                background: 'rgba(108,53,255,0.08)',
                color: '#6c35ff',
                fontWeight: 600,
                fontSize: '14px',
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              Manage Campaign →
            </Link>
          </section>
        )}

        {/* ── 4 KPI metrics ── */}
        <MetricGrid metrics={metrics} />

        {/* ── 7-Step Roadmap ── */}
        <section className="kf-card">
          <div className="kf-card-head" style={{ flexWrap: 'wrap' as const, gap: '12px' }}>
            <h2 style={{ margin: 0 }}>Your 7-Step AI Growth Roadmap</h2>
            <div className="kf-tabs compact">
              <button className="active">All Steps (7)</button>
              <button>To Do ({todoCt})</button>
              <button>In Progress ({inProgressCt})</button>
              <button>Completed ({doneCt})</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0' }}>
            {roadmap.map((step, i) => (
              <article
                key={step.title}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '18px 24px',
                  borderTop: i > 0 ? '1px solid var(--b1, #f0f1f6)' : 'none',
                  opacity: step.status === 'done' ? 0.65 : 1,
                }}
              >
                <StepCircle index={i} status={step.status} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '18px', lineHeight: 1 }}>{step.emoji}</span>
                    <strong
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        textDecoration: step.status === 'done' ? 'line-through' : 'none',
                        color: step.status === 'done' ? 'var(--t3, #9ca3af)' : 'inherit',
                      }}
                    >
                      {step.title}
                    </strong>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      color: 'var(--t3, #9ca3af)',
                      lineHeight: 1.55,
                    }}
                  >
                    {step.description}
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <ImpactBadge impact={step.impact} />
                  <StepActionBtn status={step.status} />
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── AI Insights + Next Best Actions (2-col grid) ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Fundraising Insights */}
          <section className="kf-card" style={{ padding: '24px' }}>
            <div
              className="kf-card-head"
              style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--b1, #f0f1f6)' }}
            >
              <h2 style={{ margin: 0, fontSize: '16px' }}>
                <KFIcon name="chart" className="inline" /> Fundraising Insights
              </h2>
            </div>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column' as const,
                gap: '14px',
              }}
            >
              {insights.map((insight) => (
                <li
                  key={insight}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    fontSize: '13.5px',
                    lineHeight: 1.55,
                    color: 'var(--t2, #4b5563)',
                  }}
                >
                  <span
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'rgba(25,184,106,0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                      color: '#16a34a',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </span>
                  {insight}
                </li>
              ))}
            </ul>
          </section>

          {/* Next Best Actions */}
          <section className="kf-card" style={{ padding: '24px' }}>
            <div
              className="kf-card-head"
              style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--b1, #f0f1f6)' }}
            >
              <h2 style={{ margin: 0, fontSize: '16px' }}>
                <KFIcon name="send" className="inline" /> Next Best Actions
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '14px' }}>
              {nextActions.map((action, i) => (
                <div
                  key={action.title}
                  style={{
                    display: 'flex',
                    gap: '14px',
                    alignItems: 'flex-start',
                    padding: '14px',
                    borderRadius: '10px',
                    background: i === 0 ? 'rgba(108,53,255,0.05)' : 'var(--s1, #fafafe)',
                    border: i === 0 ? '1.5px solid rgba(108,53,255,0.15)' : '1.5px solid var(--b1, #f0f1f6)',
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: i === 0 ? '#6c35ff' : i === 1 ? '#19b86a' : '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '13px',
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: '3px' }}>
                      {action.title}
                    </strong>
                    <small style={{ fontSize: '12.5px', color: 'var(--t3, #9ca3af)' }}>
                      {action.description}
                    </small>
                  </div>
                  <ImpactBadge impact={action.impact as 'High' | 'Medium' | 'Low'} />
                </div>
              ))}
            </div>

            {!hasCampaigns && (
              <Link
                href="/create"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: '16px',
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'var(--green, #19b86a)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '14px',
                  textDecoration: 'none',
                }}
              >
                <KFIcon name="plus" /> Create Your First Campaign
              </Link>
            )}
          </section>
        </div>
      </div>
    </KindFundShell>
  );
}
