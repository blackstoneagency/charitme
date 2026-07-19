import Link from 'next/link';
import type React from 'react';
import { safeJsonLd } from '../lib/json-ld';
import { getHomeData, getCategoryStats, getRecentDonations, profileName } from '../lib/home-data';
import { getCoverForCategory } from '../lib/photo-catalog';
import { formatMoneyCompact } from '@shared/currencies';
import type { StoryFilters } from '../lib/home-types';
import { AiSearch, CountUp, Reveal } from './home-parts';

export const dynamic = 'force-dynamic';

const BASE = 'https://www.charitme.com';

// ── Icon set ─────────────────────────────────────────────────────────────────
function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<string, React.ReactNode> = {
    sparkle: <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="M20 6L9 17l-5-5" />,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="M9 12l2 2 4-4" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    chart: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-7" /></>,
    rocket: <><path d="M4.5 16.5c-1.1 1.1-1.5 3-1.5 3s1.9-.4 3-1.5c.6-.6.7-1.5.2-2.1-.5-.5-1.4-.4-1.7.6Z" /><path d="M9 15l-2-2a16 16 0 0 1 8-9 5 5 0 0 1 5 5 16 16 0 0 1-9 8l-2-2Z" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    gift: <><path d="M20 12v9H4v-9" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7S9.5 2 7 3.5 8 7 12 7Zm0 0s2.5-5 5-3.5S16 7 12 7Z" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 4v4h-4" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 20v-4h4" /></>,
    book: <><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2Z" /><path d="M18 3v18" /></>,
    paw: <><circle cx="7" cy="10" r="1.6" /><circle cx="12" cy="8" r="1.6" /><circle cx="17" cy="10" r="1.6" /><path d="M12 13c-2.5 0-4.5 2-4.5 4A2 2 0 0 0 9.5 19c1 0 1.5-.6 2.5-.6s1.5.6 2.5.6A2 2 0 0 0 16.5 17c0-2-2-4-4.5-4Z" /></>,
    leaf: <><path d="M11 20A7 7 0 0 1 4 13c0-6 8-9 16-9 0 8-3 16-9 16Z" /><path d="M11 20c0-4 2-8 6-11" /></>,
    flag: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1Z" /><path d="M4 22v-7" /></>,
    home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
    cross: <><path d="M12 4v16M4 12h16" /></>,
    star: <path d="M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18l-5.9 3 1.2-6.5L2.5 9.9 9 9Z" />,
    play: <path d="M9 7l8 5-8 5V7Z" />,
    palette: <><circle cx="12" cy="12" r="9" /><circle cx="8" cy="10" r="1" /><circle cx="12" cy="8" r="1" /><circle cx="16" cy="10" r="1" /><path d="M12 21a3 3 0 0 0 0-6c-1 0-1.5-1-1-2" /></>,
    building: <><path d="M4 21V5a2 2 0 0 1 2-2h8v18" /><path d="M14 8h4a2 2 0 0 1 2 2v11" /><path d="M8 7h2M8 11h2M8 15h2" /></>,
  };
  return <svg {...common} aria-hidden="true">{paths[name] ?? paths.heart}</svg>;
}

// ── Static content (real routes, no fake buttons) ────────────────────────────
const FEATURES: { icon: string; tone: string; title: string; body: string; href: string }[] = [
  { icon: 'rocket', tone: 'violet', title: 'Start a fundraiser', body: 'Launch a trusted campaign in minutes with AI writing your story, goal, and plan.', href: '/create' },
  { icon: 'heart', tone: 'pink', title: 'Donate securely', body: 'Give with confidence through encrypted, PCI-compliant Stripe payments.', href: '/campaigns' },
  { icon: 'globe', tone: 'blue', title: 'Find causes you love', body: 'Search verified fundraisers and nonprofits by cause, location, or need.', href: '/campaigns' },
  { icon: 'users', tone: 'teal', title: 'Volunteer & rally', body: 'Bring a community together and grow support with peer-to-peer fundraising.', href: '/campaigns?category=Volunteer' },
  { icon: 'building', tone: 'indigo', title: 'Corporate giving', body: 'Match employee donations and sponsor causes with measurable impact reporting.', href: '/for-nonprofits' },
  { icon: 'refresh', tone: 'green', title: 'Recurring giving', body: 'Turn a single gift into lasting change with flexible monthly support.', href: '/campaigns' },
  { icon: 'flag', tone: 'orange', title: 'Emergency relief', body: 'Respond fast to medical crises, disasters, and urgent family needs.', href: '/campaigns?category=Emergency' },
  { icon: 'sparkle', tone: 'violet', title: 'AI charity copilot', body: 'Describe who you want to help — AI finds the right causes and next steps.', href: '/ai-campaign' },
  { icon: 'chart', tone: 'teal', title: 'Transparent reporting', body: 'Every dollar is tracked with verified updates and an open impact ledger.', href: '/trust-safety' },
];

const CATEGORY_META: Record<string, { icon: string; label: string }> = {
  Medical: { icon: 'cross', label: 'Medical' },
  Memorial: { icon: 'heart', label: 'Memorial' },
  Emergency: { icon: 'flag', label: 'Emergency' },
  Nonprofit: { icon: 'shield', label: 'Nonprofits' },
  Education: { icon: 'book', label: 'Education' },
  Animal: { icon: 'paw', label: 'Animals' },
  Environment: { icon: 'leaf', label: 'Environment' },
  Business: { icon: 'building', label: 'Small business' },
  Community: { icon: 'users', label: 'Community' },
  Competition: { icon: 'star', label: 'Competition' },
  Creative: { icon: 'palette', label: 'Creative' },
  Event: { icon: 'star', label: 'Events' },
  Faith: { icon: 'heart', label: 'Faith' },
  Family: { icon: 'home', label: 'Family' },
  Sports: { icon: 'flag', label: 'Sports' },
  Travel: { icon: 'globe', label: 'Travel' },
  Volunteer: { icon: 'users', label: 'Volunteer' },
  Wishes: { icon: 'gift', label: 'Wishes' },
};

const TRUST_SIGNALS: { icon: string; label: string }[] = [
  { icon: 'shield', label: 'Verified charities' },
  { icon: 'sparkle', label: 'AI fraud detection' },
  { icon: 'lock', label: 'Encrypted Stripe payments' },
  { icon: 'check', label: 'PCI-DSS compliant' },
  { icon: 'users', label: 'Identity verification' },
  { icon: 'chart', label: 'Transparent 0% platform fee' },
];

const STEPS: { n: string; icon: string; title: string; body: string }[] = [
  { n: '1', icon: 'globe', title: 'Choose a cause', body: 'Search or let AI recommend verified fundraisers and nonprofits that match what you care about.' },
  { n: '2', icon: 'heart', title: 'Give or start a fundraiser', body: 'Donate securely in seconds, or launch your own campaign with an AI-written story and goal.' },
  { n: '3', icon: 'chart', title: 'See your impact', body: 'Follow verified updates, photos, and an open ledger showing exactly where every dollar goes.' },
];

const GIVING_TIERS: { amount: string; body: string }[] = [
  { amount: '$25', body: 'Helps provide meals and essentials for a family in need.' },
  { amount: '$100', body: 'Supports emergency relief and medical care for someone in crisis.' },
  { amount: '$500', body: 'Funds education, shelter, or recovery that changes a life.' },
];

const FAQS: { q: string; a: string }[] = [
  { q: 'How do I start a fundraiser on CharitMe?', a: 'Click “Start a fundraiser,” describe your situation in a few sentences, and CharitMe AI writes your title, story, goal, and launch plan. You can publish a verified campaign in minutes — no fees to start.' },
  { q: 'How do donations work and how quickly do organizers receive funds?', a: 'Donations are processed securely through Stripe. Organizers connect a payout account and, once verified, funds are transferred on a rolling schedule — typically within a few business days of a completed donation.' },
  { q: 'How are charities and campaigns verified?', a: 'Every campaign receives an AI-generated trust score, and organizers and nonprofits go through identity and document verification. Suspicious activity is flagged by automated fraud detection and reviewed by our Trust & Safety team.' },
  { q: 'Is it safe to donate on CharitMe?', a: 'Yes. Payments are encrypted and PCI-DSS compliant, campaigns are continuously monitored for fraud, and every donation is recorded in a transparent ledger so you can see your impact.' },
  { q: 'Can I volunteer or fundraise as a team?', a: 'Absolutely. You can rally supporters with peer-to-peer and team fundraising, invite co-organizers, and share campaigns across social channels with one click.' },
  { q: 'Can businesses donate or match employee gifts?', a: 'Yes. Companies can sponsor campaigns, match employee donations, and access impact reporting for corporate giving and CSR programs.' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}
function pct(raised: number, goal: number): number {
  if (!goal || goal <= 0) return 0;
  return Math.min(100, Math.round((raised / goal) * 100));
}
function coverFor(url: string | null | undefined, category: string | null): string {
  return url && url.startsWith('http') ? url : getCoverForCategory(category);
}

export default async function HomePage({ searchParams }: { searchParams?: Promise<StoryFilters> }) {
  const filters = (await searchParams) ?? {};
  const [{ metrics, featuredCampaigns, carouselCampaigns }, categoryStats, recentDonations] = await Promise.all([
    getHomeData(filters),
    getCategoryStats(),
    getRecentDonations(6),
  ]);

  const heroCampaign = featuredCampaigns[0] ?? null;
  const featured = (carouselCampaigns.length ? carouselCampaigns : featuredCampaigns).slice(0, 6);
  const causes = categoryStats
    .filter((c) => CATEGORY_META[c.category])
    .slice(0, 8);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', name: 'CharitMe', url: BASE, logo: `${BASE}/icon.png`, description: 'AI-powered fundraising and charitable giving platform with 0% platform fees.' },
      {
        '@type': 'WebSite', name: 'CharitMe', url: BASE,
        potentialAction: { '@type': 'SearchAction', target: `${BASE}/campaigns?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  };

  return (
    <div className="home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-aura" aria-hidden="true" />
        <div className="home-wrap home-hero-grid">
          <div className="home-hero-copy">
            <p className="home-badge"><Icon name="sparkle" className="hi" /> The AI platform for good</p>
            <h1 id="home-hero-title">
              Together, we can<br />change a life <span>today.</span>
            </h1>
            <p className="home-hero-sub">
              Start a fundraiser, donate to a verified cause, or support a nonprofit —
              powered by AI, protected by trust, and built so <strong>every dollar</strong> reaches the people who need it.
            </p>

            <div className="home-hero-cta">
              <Link href="/create" className="home-btn home-btn-primary">Start a fundraiser</Link>
              <Link href="/campaigns" className="home-btn home-btn-ghost">Donate now <Icon name="arrow" className="hi" /></Link>
              <a href="#causes" className="home-btn home-btn-text">Explore causes</a>
            </div>

            <AiSearch />

            <p className="home-hero-trust">
              <Icon name="shield" className="hi" /> Verified campaigns · <Icon name="lock" className="hi" /> Secure payments · <strong>0% platform fee</strong>
            </p>
          </div>

          {/* Live featured campaign — real Supabase data */}
          {heroCampaign ? (
            <Reveal className="home-hero-card" as="article">
              <Link href={`/campaigns/${heroCampaign.slug}`} className="home-hc-link" aria-label={`Support ${heroCampaign.title}`}>
                <div className="home-hc-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverFor(heroCampaign.cover_image_url, heroCampaign.category)} alt={heroCampaign.title} loading="eager" decoding="async" width={640} height={420} />
                  <span className="home-hc-tag"><Icon name="shield" className="hi" /> Verified</span>
                </div>
                <div className="home-hc-body">
                  <span className="home-hc-cat">{heroCampaign.category ?? 'Fundraiser'}</span>
                  <h2 className="home-hc-title">{heroCampaign.title}</h2>
                  <div className="home-progress" role="progressbar" aria-valuenow={pct(heroCampaign.raised_amount, heroCampaign.goal_amount)} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${pct(heroCampaign.raised_amount, heroCampaign.goal_amount)}%` }} />
                  </div>
                  <div className="home-hc-meta">
                    <strong>{formatMoneyCompact(heroCampaign.raised_amount, heroCampaign.currency ?? 'usd')}</strong>
                    <span>raised · {heroCampaign.backer_count.toLocaleString()} supporters</span>
                  </div>
                  <span className="home-hc-cta">Support this cause <Icon name="arrow" className="hi" /></span>
                </div>
              </Link>
            </Reveal>
          ) : (
            <Reveal className="home-hero-card home-hero-card--empty" as="article">
              <div className="home-hc-body">
                <span className="home-hc-cat">Be the first</span>
                <h2 className="home-hc-title">Your story could change everything.</h2>
                <p>Launch a verified campaign in minutes and inspire a community to help.</p>
                <Link href="/create" className="home-hc-cta">Start your fundraiser <Icon name="arrow" className="hi" /></Link>
              </div>
            </Reveal>
          )}
        </div>

        {/* Animated impact metrics — real platform numbers */}
        <div className="home-wrap">
          <dl className="home-metrics" aria-label="Platform impact">
            <div><dt>Raised on CharitMe</dt><dd><CountUp value={metrics.raisedCents} kind="money" /></dd></div>
            <div><dt>Active campaigns</dt><dd><CountUp value={metrics.campaigns} kind="int" /></dd></div>
            <div><dt>Donations recorded</dt><dd><CountUp value={metrics.donations} kind="int" /></dd></div>
            <div><dt>Avg. trust score</dt><dd><CountUp value={metrics.trustAvg} kind="percent" /></dd></div>
          </dl>
        </div>
      </section>

      {/* ── TRUST BAR ────────────────────────────────────────────────────── */}
      <section className="home-trustbar" aria-label="Why CharitMe is trusted">
        <div className="home-wrap home-trustbar-row">
          {TRUST_SIGNALS.map((t) => (
            <span key={t.label} className="home-trust-chip"><Icon name={t.icon} className="hi" /> {t.label}</span>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section className="home-section" aria-labelledby="home-features-title">
        <div className="home-wrap">
          <Reveal className="home-head">
            <p className="home-eyebrow">Everything you need to do good</p>
            <h2 id="home-features-title">One platform for every act of kindness.</h2>
          </Reveal>
          <div className="home-feature-grid">
            {FEATURES.map((f, i) => (
              <Reveal as="article" key={f.title} className="home-feature" delay={(i % 3) * 70}>
                <Link href={f.href} className="home-feature-link">
                  <span className={`home-fi home-fi-${f.tone}`}><Icon name={f.icon} /></span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                  <span className="home-feature-more">Learn more <Icon name="arrow" className="hi" /></span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI COPILOT ───────────────────────────────────────────────────── */}
      <section className="home-section home-copilot" aria-labelledby="home-ai-title">
        <div className="home-wrap home-copilot-inner">
          <Reveal className="home-head home-head--center">
            <p className="home-eyebrow home-eyebrow--light"><Icon name="sparkle" className="hi" /> AI charity copilot</p>
            <h2 id="home-ai-title">Tell us who you want to help.</h2>
            <p className="home-copilot-sub">
              {`Describe it in your own words — "children in Africa," "animals," "I lost my home" — and AI instantly finds verified fundraisers, nonprofits, and ways to help.`}
            </p>
          </Reveal>
          <AiSearch />
        </div>
      </section>

      {/* ── DISCOVER CAUSES ──────────────────────────────────────────────── */}
      <section className="home-section" id="causes" aria-labelledby="home-causes-title">
        <div className="home-wrap">
          <Reveal className="home-head home-head--row">
            <div>
              <p className="home-eyebrow">Discover causes</p>
              <h2 id="home-causes-title">Find a cause close to your heart.</h2>
            </div>
            <Link href="/campaigns" className="home-btn home-btn-ghost home-head-cta">Browse all <Icon name="arrow" className="hi" /></Link>
          </Reveal>
          {causes.length > 0 ? (
            <div className="home-causes">
              {causes.map((c, i) => {
                const meta = CATEGORY_META[c.category];
                return (
                  <Reveal as="article" key={c.category} className="home-cause" delay={(i % 4) * 60}>
                    <Link href={`/campaigns?category=${encodeURIComponent(c.category)}`} className="home-cause-link">
                      <div className="home-cause-media">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getCoverForCategory(c.category)} alt={`${meta.label} fundraisers`} loading="lazy" decoding="async" width={360} height={240} />
                        <span className="home-cause-ic"><Icon name={meta.icon} className="hi" /></span>
                      </div>
                      <div className="home-cause-body">
                        <h3>{meta.label}</h3>
                        <p>{c.count.toLocaleString()} {c.count === 1 ? 'campaign' : 'campaigns'} · {c.supporters.toLocaleString()} supporters</p>
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          ) : (
            <p className="home-empty">New causes are launching now — <Link href="/create">be the first to start one</Link>.</p>
          )}
        </div>
      </section>

      {/* ── FEATURED FUNDRAISERS ─────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="home-section" aria-labelledby="home-featured-title">
          <div className="home-wrap">
            <Reveal className="home-head home-head--row">
              <div>
                <p className="home-eyebrow">Featured fundraisers</p>
                <h2 id="home-featured-title">Real people. Real impact. Right now.</h2>
              </div>
              <Link href="/campaigns" className="home-btn home-btn-ghost home-head-cta">See all <Icon name="arrow" className="hi" /></Link>
            </Reveal>
            <div className="home-cards">
              {featured.map((c, i) => (
                <Reveal as="article" key={c.slug} className="home-card" delay={(i % 3) * 70}>
                  <Link href={`/campaigns/${c.slug}`} className="home-card-link">
                    <div className="home-card-media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverFor(c.cover_image_url, c.category)} alt={c.title} loading="lazy" decoding="async" width={420} height={264} />
                      {c.category && <span className="home-card-cat">{c.category}</span>}
                    </div>
                    <div className="home-card-body">
                      <h3>{c.title}</h3>
                      <p className="home-card-org">by {profileName(c.profiles)}</p>
                      <div className="home-progress" role="progressbar" aria-valuenow={pct(c.raised_amount, c.goal_amount)} aria-valuemin={0} aria-valuemax={100}>
                        <span style={{ width: `${pct(c.raised_amount, c.goal_amount)}%` }} />
                      </div>
                      <div className="home-card-meta">
                        <strong>{formatMoneyCompact(c.raised_amount, c.currency ?? 'usd')}</strong>
                        <span>{pct(c.raised_amount, c.goal_amount)}% · {c.backer_count.toLocaleString()} donors</span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── LIVE IMPACT + SOCIAL PROOF ───────────────────────────────────── */}
      <section className="home-section home-impact" aria-labelledby="home-impact-title">
        <div className="home-wrap home-impact-grid">
          <Reveal className="home-impact-copy">
            <p className="home-eyebrow">Live impact</p>
            <h2 id="home-impact-title">See kindness happen in real time.</h2>
            <p className="home-impact-sub">Every gift is recorded, verified, and shown transparently. Here is what your generosity can do:</p>
            <ul className="home-tiers">
              {GIVING_TIERS.map((t) => (
                <li key={t.amount}><span className="home-tier-amt">{t.amount}</span><span className="home-tier-body">{t.body}</span></li>
              ))}
            </ul>
            <Link href="/campaigns" className="home-btn home-btn-primary">Give now</Link>
          </Reveal>

          <Reveal className="home-feed" delay={80}>
            <div className="home-feed-head"><span className="home-live-dot" aria-hidden="true" /> Recent donations</div>
            {recentDonations.length > 0 ? (
              <ul>
                {recentDonations.map((d) => (
                  <li key={d.id}>
                    <span className="home-feed-avatar" aria-hidden="true"><Icon name="heart" className="hi" /></span>
                    <span className="home-feed-text">
                      <strong>{d.name}</strong> gave <strong>{formatMoneyCompact(d.amountCents, 'usd')}</strong>
                      <span className="home-feed-sub">to <Link href={`/campaigns/${d.campaignSlug}`}>{d.campaignTitle}</Link> · {timeAgo(d.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="home-empty home-empty--feed">Be the first to make a gift today.</p>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="home-section" aria-labelledby="home-how-title">
        <div className="home-wrap">
          <Reveal className="home-head home-head--center">
            <p className="home-eyebrow">How it works</p>
            <h2 id="home-how-title">Change a life in three simple steps.</h2>
          </Reveal>
          <ol className="home-steps">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.n} className="home-step" delay={i * 90}>
                <span className="home-step-ic"><Icon name={s.icon} /></span>
                <span className="home-step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── FAQ / AEO ────────────────────────────────────────────────────── */}
      <section className="home-section home-faq" aria-labelledby="home-faq-title">
        <div className="home-wrap home-faq-inner">
          <Reveal className="home-head home-head--center">
            <p className="home-eyebrow">Questions, answered</p>
            <h2 id="home-faq-title">Everything you need to feel confident.</h2>
          </Reveal>
          <div className="home-faq-list">
            {FAQS.map((f) => (
              <details key={f.q} className="home-faq-item">
                <summary>{f.q}<span className="home-faq-plus" aria-hidden="true"><Icon name="arrow" className="hi" /></span></summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="home-section">
        <div className="home-wrap">
          <Reveal className="home-final">
            <div className="home-final-aura" aria-hidden="true" />
            <h2>{`You have the power to change someone's life today.`}</h2>
            <p>Join a community of givers, organizers, and volunteers turning compassion into real, measurable impact.</p>
            <div className="home-final-cta">
              <Link href="/create" className="home-btn home-btn-white">Start a fundraiser</Link>
              <Link href="/campaigns" className="home-btn home-btn-outline-light">Donate now</Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
