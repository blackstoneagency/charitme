import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicIcon } from '../../components/PublicIcon';
import { supabaseAdmin } from '../../lib/supabase';
import { formatHomeCents } from '../../lib/home-utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'AI Fundraising',
  description: 'CharitMe AI tools help fundraisers create campaigns, connect with donors, and optimize results.',
};

// ── Live data from Supabase ───────────────────────────────────────────────────
async function getAIPageData() {
  const [
    { count: activeCampaigns },
    donationsResult,
    campaignShowcase,
  ] = await Promise.all([
    supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('donations').select('amount_cents').eq('status', 'completed'),
    supabaseAdmin
      .from('campaigns')
      .select('slug,title,tagline,cover_image_url,goal_amount,raised_amount,backer_count,category')
      .eq('status', 'active')
      .order('raised_amount', { ascending: false })
      .limit(3),
  ]);

  const totalRaised = (donationsResult.data ?? []).reduce((s, d) => s + (d.amount_cents ?? 0), 0);
  const donationCount = donationsResult.data?.length ?? 0;

  return {
    activeCampaigns: activeCampaigns ?? 0,
    totalRaised,
    donationCount,
    showcase: campaignShowcase.data ?? [],
  };
}

const TOOLS = [
  { icon: 'edit',  color: 'var(--violet, #6c35ff)', bg: 'rgba(108,53,255,.10)', title: 'AI Story Writer',       body: 'Create heartfelt, compelling campaign stories that move donors to act — in seconds.',        cta: 'Try it now'   },
  { icon: 'users', color: '#0ea5e9',                bg: 'rgba(14,165,233,.10)',  title: 'Smart Donor Insights',  body: 'Find the right donors with AI-powered recommendations and predictive match scoring.',        cta: 'Learn more'   },
  { icon: 'mail',  color: '#f59e0b',                bg: 'rgba(245,158,11,.10)',  title: 'AI Email Generator',    body: 'Generate personalized, high-converting emails that get more opens, clicks, and replies.',    cta: 'Try it now'   },
  { icon: 'chart', color: 'var(--green, #10b981)',  bg: 'rgba(16,185,129,.10)',  title: 'Campaign Optimizer',    body: 'Get AI-powered suggestions to improve performance and reach your goal faster.',               cta: 'Learn more'   },
  { icon: 'bot',   color: 'var(--red, #f43f5e)',    bg: 'rgba(244,63,94,.10)',   title: 'AI Fundraising Coach',  body: 'Get instant answers, ideas, and guidance from your personal AI fundraising coach, 24/7.',    cta: 'Ask anything' },
  { icon: 'shield',color: 'var(--violet, #8b5cf6)', bg: 'rgba(139,92,246,.10)',  title: 'CharitScore™ Trust',    body: 'Every campaign gets an AI-powered 0–100 CharitScore so donors give with total confidence.', cta: 'Learn more'   },
];

const STEPS = [
  ['Tell Us Your Cause',      'Share a few details about your mission, goals, and fundraising target.'],
  ['AI Analyzes & Suggests',  'Our AI models your campaign against thousands of successful fundraisers.'],
  ['Create & Connect',        'Use AI tools to write your story, build emails, and reach the right donors.'],
  ['Launch & Engage',         'Go live in minutes with an AI-optimized page ready to convert visitors.'],
  ['Optimize & Grow',         'AI continuously learns from your results and improves your campaigns over time.'],
];

const POPULAR = [
  ['heart',  'Medical fundraiser',    'for a loved one'],
  ['shield', 'Emergency relief',      'fund right now'],
  ['users',  'Memorial fund',         'for my community'],
  ['globe',  'Nonprofit campaign',    'for my cause'],
  ['dollar', 'Education fundraiser',  'for tuition or school'],
] as const;

function pct(raised: number, goal: number) {
  return goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
}

export default async function AiFundraisingPage() {
  const { activeCampaigns, totalRaised, donationCount, showcase } = await getAIPageData();

  return (
    <div className="pub-page aif-page">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="pub-hero aif-hero">
        <div className="pub-breadcrumb">
          <Link href="/">Home</Link> <span>&gt;</span> <b>AI Fundraising</b>
        </div>

        <div className="pub-hero-grid aif-hero-grid">

          {/* Left copy */}
          <div className="pub-hero-copy">
            <div className="pub-badge">
              <PublicIcon name="ai" /> <span>AI-Powered Fundraising</span>
            </div>
            <h1>Raise More. Save Time.<br />Powered by <em>AI.</em></h1>
            <p>
              CharitMe&apos;s AI tools help you create compelling campaigns, connect with
              the right donors, and optimize results so you can focus on making a bigger impact.
            </p>

            {/* Live stats strip */}
            <div className="aif-live-stats">
              <div className="aif-stat-icon" style={{ background: 'rgba(108,53,255,.10)', color: 'var(--violet, #6c35ff)' }}>
                <PublicIcon name="chart" />
              </div>
              <div>
                <strong>{activeCampaigns.toLocaleString()}</strong>
                <span>Active Campaigns</span>
              </div>
              <div className="aif-stat-icon" style={{ background: 'rgba(16,185,129,.10)', color: 'var(--green, #10b981)' }}>
                <PublicIcon name="dollar" />
              </div>
              <div>
                <strong>{formatHomeCents(totalRaised)}</strong>
                <span>Total Raised</span>
              </div>
              <div className="aif-stat-icon" style={{ background: 'rgba(244,63,94,.10)', color: 'var(--red, #f43f5e)' }}>
                <PublicIcon name="heart" />
              </div>
              <div>
                <strong>{donationCount.toLocaleString()}</strong>
                <span>Donations Recorded</span>
              </div>
            </div>

            <div className="pub-actions">
              <Link href="/ai-campaign" className="pub-btn primary aif-btn-primary">
                Start with AI <PublicIcon name="ai" />
              </Link>
              <Link href="/how-it-works" className="pub-btn secondary">
                See How It Works <PublicIcon name="play" />
              </Link>
            </div>
          </div>

          {/* Right — AI Concierge card */}
          <div className="aif-concierge-card">
            {/* Orb */}
            <div className="ai-builder-orb" style={{ marginBottom: 6 }}>
              <span className="ai-builder-spark s1" /><span className="ai-builder-spark s2" />
              <span className="ai-builder-spark s3" /><span className="ai-builder-spark s4" />
              <span className="ai-builder-spark s5" />
              <div className="ai-builder-orb-circle"><PublicIcon name="ai" /></div>
            </div>

            <h2 className="ai-builder-greeting">Hi! I&apos;m your <em>AI Concierge.</em></h2>
            <p className="ai-builder-sub">I&apos;ll help you build the perfect fundraising campaign for your cause.</p>

            <div className="ai-builder-divider"><span><PublicIcon name="ai" /></span></div>

            <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: 18, letterSpacing: '-.015em' }}>What are you looking for today?</p>
            <p className="ai-builder-lede">Tell me about your cause and I&apos;ll recommend the best campaign setup for you.</p>

            {/* Prompt area — navigates to /ai-campaign */}
            <Link href="/ai-campaign" className="aif-prompt-link">
              <span>Describe what you&apos;re looking for…</span>
              <span className="aif-prompt-btn"><PublicIcon name="arrow" /></span>
            </Link>

            <p className="aif-prompt-hint">
              Examples: &ldquo;Medical fundraiser for my mom&apos;s surgery&rdquo;, &ldquo;Emergency relief after a house fire&rdquo;,
              &ldquo;Memorial fund for my brother&rdquo;, &ldquo;Scholarship fund for my school&rdquo;
            </p>

            {/* Popular request chips */}
            <p className="ai-builder-popular" style={{ marginTop: 22, fontSize: 14 }}>Popular requests</p>
            <div className="ai-builder-chips aif-chips">
              {POPULAR.map(([icon, title, sub]) => (
                <Link key={title} href={`/ai-campaign?q=${encodeURIComponent(title + ' ' + sub)}`} className="aif-chip">
                  <PublicIcon name={icon} />
                  <span>{title}<br />{sub}</span>
                </Link>
              ))}
            </div>

            <p className="ai-builder-secure"><PublicIcon name="lock" /> Your information is secure and never shared.</p>
          </div>
        </div>
      </section>

      {/* ── LIVE CAMPAIGNS SHOWCASE ──────────────────────────────────────── */}
      {showcase.length > 0 && (
        <section className="pub-section aif-showcase-section">
          <div className="aif-section-label"><PublicIcon name="ai" /> Live on CharitMe right now</div>
          <h2>Real Campaigns. Real Results.</h2>
          <p className="aif-section-sub">These fundraisers are live today — each powered by CharitMe AI.</p>
          <div className="aif-showcase-grid">
            {showcase.map(c => (
              <Link key={c.slug} href={`/campaigns/${c.slug}`} className="aif-showcase-card">
                {c.cover_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover_image_url} alt={c.title} />
                )}
                <div className="aif-showcase-body">
                  <span className="aif-showcase-cat">{c.category}</span>
                  <h3>{c.title}</h3>
                  {c.tagline && <p>{c.tagline}</p>}
                  <div className="aif-showcase-bar">
                    <div style={{ width: `${pct(c.raised_amount, c.goal_amount)}%` }} />
                  </div>
                  <div className="aif-showcase-meta">
                    <strong>{formatHomeCents(c.raised_amount)}</strong>
                    <span>raised · {c.backer_count} donors</span>
                    <b>{pct(c.raised_amount, c.goal_amount)}%</b>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <Link href="/campaigns" className="pub-btn secondary">Browse All Campaigns <PublicIcon name="arrow" /></Link>
          </div>
        </section>
      )}

      {/* ── AI TOOLS GRID ────────────────────────────────────────────────── */}
      <section className="pub-section aif-tools-section">
        <div className="aif-section-label"><PublicIcon name="ai" /> Your AI toolkit</div>
        <h2>AI Tools Built for Fundraisers</h2>
        <p className="aif-section-sub">Everything you need to create, grow, and win — powered by AI built specifically for fundraising.</p>
        <div className="aif-tools-grid">
          {TOOLS.map(t => (
            <article key={t.title} className="aif-tool-card">
              <div className="aif-tool-icon" style={{ color: t.color, background: t.bg }}>
                <PublicIcon name={t.icon} />
              </div>
              <h3>{t.title}</h3>
              <p>{t.body}</p>
              <Link href="/ai-campaign" style={{ color: t.color }}>
                {t.cta} <PublicIcon name="arrow" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="aif-steps-section">
        <div className="aif-section-label" style={{ justifyContent: 'center' }}><PublicIcon name="ai" /> Simple 5-step process</div>
        <h2>How AI Fundraising Works</h2>
        <div className="aif-steps-grid">
          {STEPS.map(([title, body], i) => (
            <article key={title} className="aif-step">
              <div className="aif-step-num">{i + 1}</div>
              <div className="aif-step-connector" />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── CTA BAND ─────────────────────────────────────────────────────── */}
      <section className="aif-cta-band">
        <div className="aif-cta-glow" />
        <div className="aif-cta-inner">
          <h2>Ready to raise more with AI?</h2>
          <p>Join {activeCampaigns > 0 ? `${activeCampaigns.toLocaleString()} active fundraisers` : 'thousands of fundraisers'} already using CharitMe AI to exceed their goals.</p>
          <div className="pub-actions" style={{ justifyContent: 'center' }}>
            <Link href="/ai-campaign" className="pub-btn primary aif-btn-primary">
              Start with AI <PublicIcon name="ai" />
            </Link>
            <Link href="/create" className="pub-btn" style={{ background: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.3)' }}>
              Create Manually <PublicIcon name="arrow" />
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
