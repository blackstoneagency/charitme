import Link from 'next/link';
import Image from 'next/image';
import type React from 'react';
import type { Metadata } from 'next';
import { formatMoneyCompact } from '@shared/currencies';
import CampaignImage from '../components/CampaignImage';
import JsonLd from '../components/JsonLd';
import { isRotatorEligible } from '../lib/featured';
import { getCoverForCategory, getCoverForCampaign } from '../lib/photo-catalog';
import { getCategoryStats, getHomeData, getRecentDonations } from '../lib/home-data';
import { campaignTimeLabel } from '../lib/campaign-lifecycle';
import { resolveCampaignCover } from '../lib/covers';
import { safeJsonLd } from '../lib/json-ld';
import { shouldShowPlatformMetrics } from '../lib/home-utils';
import { seoMetadata } from '../lib/seo';
import HeroSpotlightCarousel, { type HeroSpotItem } from './HeroSpotlightCarousel';
import { CountUp, Reveal } from './home-parts';

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('/');
}

const BASE = 'https://www.charitme.com';

function Icon({ name, className = 'hi' }: { name: string; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  const paths: Record<string, React.ReactNode> = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="M9 12l2 2 4-4" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" /></>,
    play: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4Z" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    leaf: <><path d="M11 20A7 7 0 0 1 4 13c0-6 8-9 16-9 0 8-3 16-9 16Z" /><path d="M11 20c0-4 2-8 6-11" /></>,
  };
  return <svg {...common}>{paths[name] ?? paths.heart}</svg>;
}

const CAUSES = [
  { category: 'Sports', title: 'Sports & Youth', body: 'Empowering young athletes and building confidence through opportunity.', action: 'Support Youth', icon: 'users' },
  { category: 'Emergency', title: 'People in Need', body: 'Providing food, shelter, and essentials to individuals and families facing hardship.', action: 'Help Now', icon: 'heart' },
  { category: 'Community', title: 'Community & Relief', body: 'Rebuilding communities and providing immediate relief when disaster strikes.', action: 'Give Relief', icon: 'globe' },
  { category: 'Medical', title: 'Health & Wellness', body: 'Supporting medical treatment, mental health, and wellness for people in crisis.', action: 'Support Health', icon: 'shield' },
  { category: 'Education', title: 'Education', body: 'Opening doors to learning and creating opportunities that last a lifetime.', action: 'Invest in Education', icon: 'check' },
  { category: 'Animal', title: 'Animals & Planet', body: 'Protecting animals and the planet for future generations.', action: 'Protect Our Planet', icon: 'leaf' },
] as const;

const TRUST_ITEMS = [
  { icon: 'shield', title: '100% Secure', body: 'Your donation is safe and always goes to the cause.' },
  { icon: 'check', title: 'Verified Causes', body: 'Every cause is carefully reviewed for trust and transparency.' },
  { icon: 'globe', title: 'No Hidden Fees', body: 'A 0% platform fee means more of your donation reaches the cause.' },
  { icon: 'users', title: 'Track Your Impact', body: 'See the real difference your kindness makes.' },
  { icon: 'heart', title: 'Global Community', body: 'Join a worldwide movement of kindness and compassion.' },
] as const;

const PROOF_POINTS = [
  { quote: 'Every donation includes a receipt and stays visible in your giving history.', name: 'Secure giving' },
  { quote: 'Verified campaign updates keep supporters close to the progress they helped make.', name: 'Transparent impact' },
] as const;

const NO_HOME_DATA = {
  stats: [] as string[][],
  metrics: { raisedCents: 0, campaigns: 0, donations: 0, trustAvg: 0 },
  heroCampaign: null,
  featuredCampaigns: [],
  carouselCampaigns: [],
  rotatorCampaigns: [],
  heroPercent: 0,
  daysLeft: 0,
} satisfies Awaited<ReturnType<typeof getHomeData>>;

async function loadOrDegrade<T>(work: Promise<T>, fallback: T): Promise<{ value: T; ok: boolean }> {
  try {
    return { value: await work, ok: true };
  } catch {
    return { value: fallback, ok: false };
  }
}

export default async function HomePage() {
  const [home, categoryResult, donationsResult] = await Promise.all([
    loadOrDegrade(getHomeData({}), NO_HOME_DATA),
    loadOrDegrade(getCategoryStats(), [] as Awaited<ReturnType<typeof getCategoryStats>>),
    loadOrDegrade(getRecentDonations(4), [] as Awaited<ReturnType<typeof getRecentDonations>>),
  ]);

  const { metrics, rotatorCampaigns } = home.value;
  const metricsAvailable = shouldShowPlatformMetrics(metrics, home.ok);
  const categoryStats = new Map(categoryResult.value.map((row) => [row.category, row]));
  const recentDonations = donationsResult.value;

  const eligibleCampaigns = rotatorCampaigns.filter((campaign) => isRotatorEligible(campaign));
  const heroItems: HeroSpotItem[] = await Promise.all(eligibleCampaigns.map(async (c) => ({
    slug: c.slug,
    title: c.title,
    organizer: c.organizer_name ?? 'CharitMe Organizer',
    cover: await resolveCampaignCover(c.cover_image_url, c.category, c.slug),
    fallbackCover: getCoverForCampaign(c.category, c.slug),
    currency: c.currency ?? 'usd',
    trust: c.campaign_health_score ?? 0,
    funded: Math.min(100, Math.round((c.raised_amount / Math.max(1, c.goal_amount)) * 100)),
    raised: c.raised_amount,
    goal: c.goal_amount,
    backers: c.backer_count,
    deadlineLabel: campaignTimeLabel({ status: 'active', deadline: c.deadline }),
    verified: c.trust_status === 'verified',
    href: `/campaigns/${c.slug}`,
  })));

  const impactCampaign = heroItems[0] ?? null;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'CharitMe',
        url: BASE,
        logo: `${BASE}/icon.png`,
        description: 'AI-powered fundraising and charitable giving platform with 0% platform fees.',
      },
      {
        '@type': 'WebSite',
        name: 'CharitMe',
        url: BASE,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${BASE}/campaigns?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <div className="mirror-home">
      <JsonLd json={safeJsonLd(jsonLd)} />

      <section className="mirror-hero" aria-labelledby="mirror-hero-title">
        <Image
          className="mirror-hero-bg"
          src="/images/charitme-community-hero.png"
          alt="A diverse community celebrating what they can accomplish together"
          fill
          priority
          sizes="100vw"
          quality={86}
        />
        <div className="mirror-hero-shade" aria-hidden="true" />
        <div className="mirror-wrap mirror-hero-inner">
          <div className="mirror-hero-copy">
            <p className="mirror-kicker">Together, we create hope &amp; opportunity</p>
            <h1 id="mirror-hero-title">Good People.<br />Great Causes.<br /><span>Stronger Together.</span></h1>
            <p className="mirror-hero-body">
              CharitMe is where compassion meets action. Your support today uplifts lives,
              strengthens communities, and builds a brighter tomorrow.
            </p>
            <div className="mirror-actions">
              <Link href="/create/choose-path" className="mirror-btn mirror-btn-primary">Create My Fundraiser Now!</Link>
              <Link href="/campaigns" className="mirror-btn mirror-btn-secondary">Donate Now <Icon name="heart" /></Link>
            </div>
            <div className="mirror-quick-links">
              <Link href="#causes">Explore Causes <Icon name="arrow" /></Link>
              <Link href="#impact"><Icon name="play" /> Watch Our Impact</Link>
            </div>
          </div>
          <HeroSpotlightCarousel items={heroItems} variant="mirror" />
        </div>
      </section>

      <section id="causes" className="mirror-band mirror-causes" aria-labelledby="mirror-causes-title">
        <div className="mirror-wrap">
          <h2 id="mirror-causes-title">Causes That Change Lives</h2>
          <div className="mirror-cause-grid">
            {CAUSES.map((cause, index) => {
              const stats = categoryStats.get(cause.category);
              return (
                <Reveal as="article" className="mirror-cause" key={cause.category} delay={index * 45}>
                  <Link href={`/campaigns?category=${encodeURIComponent(cause.category)}`}>
                    <div className="mirror-cause-media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getCoverForCategory(cause.category)} alt="" width={360} height={250} loading="lazy" decoding="async" />
                      <span><Icon name={cause.icon} /></span>
                    </div>
                    <div className="mirror-cause-copy">
                      <h3>{cause.title}</h3>
                      <p>{cause.body}</p>
                      {stats ? <small>{stats.count.toLocaleString()} active causes · {stats.supporters.toLocaleString()} supporters</small> : null}
                      <strong>{cause.action} <Icon name="arrow" /></strong>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {metricsAvailable && (
        <section className="mirror-band mirror-metrics" aria-label="Our community impact">
          <div className="mirror-wrap mirror-metric-grid">
            <div className="mirror-metric-intro"><Icon name="heart" /><p><strong>Our Community.<br />Our Impact.</strong><span>Because together, we can do amazing things.</span></p></div>
            <dl><div><dt>Raised for causes</dt><dd><CountUp value={metrics.raisedCents} kind="money" /></dd></div></dl>
            <dl><div><dt>Lives impacted</dt><dd><CountUp value={metrics.donations} kind="int" /></dd></div></dl>
            <dl><div><dt>Active causes</dt><dd><CountUp value={metrics.campaigns} kind="int" /></dd></div></dl>
            <dl><div><dt>Average trust score</dt><dd><CountUp value={metrics.trustAvg} kind="percent" /></dd></div></dl>
          </div>
        </section>
      )}

      <section id="impact" className="mirror-band mirror-proof" aria-labelledby="mirror-proof-title">
        <div className="mirror-wrap mirror-proof-grid">
          <Reveal className="mirror-impact-card">
            {impactCampaign ? (
              <Link href={impactCampaign.href}>
                <div className="mirror-impact-media">
                  <CampaignImage src={impactCampaign.cover} category={null} campaignKey={impactCampaign.slug} alt={impactCampaign.title} width={620} height={390} />
                  <span>Active campaign</span>
                </div>
                <div className="mirror-impact-copy">
                  <h2>{impactCampaign.title}</h2>
                  <p>{formatMoneyCompact(impactCampaign.raised, impactCampaign.currency)} raised · {impactCampaign.backers.toLocaleString()} donors</p>
                  <div className="mirror-impact-progress" role="progressbar" aria-label={`${impactCampaign.funded}% funded`} aria-valuenow={impactCampaign.funded} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${impactCampaign.funded}%` }} />
                  </div>
                  <strong>Donate Now <Icon name="heart" /></strong>
                </div>
              </Link>
            ) : (
              <div className="mirror-impact-empty">
                <Icon name="heart" />
                <h2>Make your impact visible.</h2>
                <p>Launch a trusted campaign and bring your community together.</p>
                <Link href="/create/choose-path" className="mirror-btn mirror-btn-primary">Start a fundraiser</Link>
              </div>
            )}
          </Reveal>

          <div className="mirror-proof-copy">
            <div className="mirror-testimonials">
              {recentDonations.length > 0
                ? recentDonations.slice(0, 2).map((donation) => (
                    <article key={donation.id}>
                      <span aria-hidden="true">“</span>
                      <p>Supported <strong>{donation.campaignTitle}</strong> with {formatMoneyCompact(donation.amountCents, 'usd')}.</p>
                      <small>{donation.name}<br />CharitMe supporter</small>
                    </article>
                  ))
                : PROOF_POINTS.map((point) => (
                    <article key={point.name}>
                      <span aria-hidden="true">“</span>
                      <p>{point.quote}</p>
                      <small>{point.name}<br />Built into CharitMe</small>
                    </article>
                  ))}
            </div>
            <div className="mirror-proof-cta">
              <h2 id="mirror-proof-title">Make an Impact Today <Icon name="heart" /></h2>
              <p>Small acts. Big change. Be part of something beautiful.</p>
              <div className="mirror-actions">
                <Link href="/create/choose-path" className="mirror-btn mirror-btn-primary">Create My Fundraiser Now!</Link>
                <Link href="/campaigns" className="mirror-btn mirror-btn-secondary">Donate Now <Icon name="heart" /></Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mirror-trust" aria-label="Why people trust CharitMe">
        <div className="mirror-wrap mirror-trust-grid">
          {TRUST_ITEMS.map((item) => (
            <article key={item.title}>
              <Icon name={item.icon} />
              <p><strong>{item.title}</strong><span>{item.body}</span></p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
