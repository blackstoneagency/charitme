import Link from 'next/link';
import Image from 'next/image';
import type React from 'react';
import type { Metadata } from 'next';
import { formatMoneyCompact } from '@shared/currencies';
import JsonLd from '../components/JsonLd';
import { isRotatorEligible } from '../lib/featured';
import { withQueryTimeout } from '../lib/query-timeout';
import { getCoverForCampaign, getDisplayCover, getDistinctPhotosForItems } from '../lib/photo-catalog';
import { getCause } from '../lib/causes';
import { getCategoryStats, getHomeData, getRecentDonations } from '../lib/home-data';
import { getHomeStories } from '../lib/home-stories';
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

/**
 * The six cards in "Causes That Change Lives".
 *
 * ⚠️ `slug` is a REAL cause in `lib/causes.ts`, and it is the only thing here
 * that decides where a card goes. The rest is presentation the cause definition
 * does not carry — the design's action wording and its icon.
 *
 * This list previously carried a `category` instead, and each card linked to
 * `/campaigns?category=<one category>`. Measured against `lib/causes.ts`, that
 * was wrong in four of six cases and outright misdirecting in one:
 *
 *   Sports & Youth      → dropped Competition
 *   Community & Relief  → dropped Emergency
 *   Animals & Planet    → dropped Environment
 *   People in Need      → linked to **Emergency**, which is not one of its
 *                         categories at all (it is Family + Wishes + Memorial),
 *                         so "Help Now" showed a completely different set of
 *                         campaigns from the cause it named.
 *
 * A cause spans several categories; `?category=` can express exactly one. That
 * is why the cause pages exist, and why these link to them.
 */
const CAUSE_CARDS = [
  { slug: 'sports-youth',     action: 'Support Youth',       icon: 'users' },
  { slug: 'people-in-need',   action: 'Help Now',            icon: 'heart' },
  { slug: 'community-relief', action: 'Give Relief',         icon: 'globe' },
  { slug: 'health-wellness',  action: 'Support Health',      icon: 'shield' },
  { slug: 'education',        action: 'Invest in Education', icon: 'check' },
  { slug: 'animals-planet',   action: 'Protect Our Planet',  icon: 'leaf' },
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

/**
 * Degrade on failure OR on a deadline.
 *
 * This caught rejections but had no timeout, so a stalled database held the
 * homepage indefinitely — measured at ~7.05s against an unreachable host, with
 * no ceiling. `ok: false` already means "do not present this as fact"
 * (`shouldShowPlatformMetrics` suppresses the metrics band on it), so a timeout
 * lands on exactly the right behaviour: fewer numbers, never wrong ones.
 */
async function loadOrDegrade<T>(work: Promise<T>, fallback: T): Promise<{ value: T; ok: boolean }> {
  const { data, degraded } = await withQueryTimeout(work, fallback);
  return { value: data, ok: !degraded };
}

export default async function HomePage() {
  const [home, categoryResult, donationsResult, storiesResult] = await Promise.all([
    loadOrDegrade(getHomeData({}), NO_HOME_DATA),
    loadOrDegrade(getCategoryStats(), [] as Awaited<ReturnType<typeof getCategoryStats>>),
    loadOrDegrade(getRecentDonations(4), [] as Awaited<ReturnType<typeof getRecentDonations>>),
    loadOrDegrade(getHomeStories(3), null as Awaited<ReturnType<typeof getHomeStories>>),
  ]);

  const { metrics, rotatorCampaigns } = home.value;
  const metricsAvailable = shouldShowPlatformMetrics(metrics, home.ok);
  const categoryStats = new Map(categoryResult.value.map((row) => [row.category, row]));
  const homeCausePhotos = getDistinctPhotosForItems(CAUSE_CARDS.map((card) => {
    const cause = getCause(card.slug);
    return { category: cause?.categories[0], key: `home-cause-${card.slug}` };
  }));
  const recentDonations = donationsResult.value;
  const stories = storiesResult.value ?? [];
  const [leadStory, ...sideStories] = stories;
  // The "Make an Impact Today" band's photo.
  //
  // ⚠️ NOT `getCoverForCategory` — `cover-uniqueness.test.ts` allows exactly one
  // such call on this page, for the category tiles, and it is right to: a
  // category cover is one image standing for a whole category, so reusing it as
  // decoration puts the same photo on the page twice. This is a real campaign's
  // cover, and it prefers the SECOND story so it does not duplicate the lead
  // story card directly above it. With no completed campaign at all the band
  // renders without a photo rather than inventing one.
  const impactStory = sideStories[0] ?? leadStory ?? null;

  const eligibleCampaigns = rotatorCampaigns.filter((campaign) => isRotatorEligible(campaign));
  const heroItems: HeroSpotItem[] = await Promise.all(eligibleCampaigns.map(async (c) => ({
    slug: c.slug,
    title: c.title,
    organizer: c.organizer_name ?? 'Campaign organizer',
    cover: await resolveCampaignCover(c.cover_image_url, c.category, c.slug, 'home-hero'),
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

      {/* ── HERO ──────────────────────────────────────────────────────────────
          Two columns, as the reference draws it: copy left, a contained photo
          panel right carrying the floating "Real People. Real Impact." card.
          The photo used to be a full-bleed background behind the copy. */}
      <section className="mirror-hero" aria-labelledby="mirror-hero-title">
        <div className="mirror-wrap mirror-hero-inner">
          <div className="mirror-hero-copy">
            <p className="mirror-kicker">
              <span>Together,</span> we create <span>hope</span> &amp; <span>opportunity</span>
            </p>
            <h1 id="mirror-hero-title">Good People.<br />Great Causes.<br /><span>Stronger Together.</span> <Icon name="heart" className="mirror-h1-heart" /></h1>
            <p className="mirror-hero-body">
              CharitMe is where compassion meets action. Your support today uplifts lives,
              strengthens communities, and builds a brighter tomorrow.
            </p>
            <div className="mirror-actions">
              {/* ⚠️ "Donate Now" is the FIRST action, and it was missing entirely.
                  The hero offered "Explore Causes" (an in-page anchor) and
                  "See Our Impact" — so a visitor who arrived ready to give had
                  no direct path to do it from the top of the homepage. It goes
                  to /campaigns, which is where a donor picks who to give to;
                  there is no single "donate" endpoint to send them to, because a
                  donation is always to a specific campaign. */}
              <Link href="/campaigns" className="mirror-btn mirror-btn-primary">Donate Now <Icon name="heart" /></Link>
              <Link href="#causes" className="mirror-btn mirror-btn-secondary">Explore Causes <Icon name="arrow" /></Link>
              {/* The third hero action is for the OTHER visitor — the one who
                  came to raise money rather than to give it. The first two both
                  serve donors ("Donate Now", "Explore Causes"), so before this
                  the top of the homepage offered a fundraiser no entry point at
                  all.

                  ⚠️ It used to go to /create/choose-path, on the reasoning that
                  the chooser offers both the AI-guided build and the manual
                  wizard and sending everyone down one decides for them. That
                  reasoning no longer holds: the builder's FIRST screen carries
                  both "✨ Write with AI" beside the story field and a link to
                  /ai-campaign, so nothing is decided by going there — the choice
                  is simply made one screen later, in context, next to the field
                  it affects. What the chooser did add was a whole screen between
                  a visitor and the thing they clicked to do.

                  The chooser is still a page and still reachable; it is just no
                  longer in the way. /ai-campaign keeps its own links from the
                  footer, /ai-fundraising and the builder itself, so the AI path
                  did not lose a route in.

                  ⚠️ This replaced "See Our Impact" → /impact. /impact is still
                  reachable from the header nav ("Our Impact") and the footer, so
                  the page did not lose its only route in. */}
              <Link href="/create" className="mirror-btn mirror-btn-create">Create Campaign <Icon name="arrow" /></Link>
            </div>

            {/* ⚠️ The reference puts a five-face avatar cluster here with
                "4.9 ★★★★★ from 25,000+ reviews". Neither is renderable:
                  • There is no reviews or ratings table in this schema, so the
                    score and the review count would both be invented.
                  • The only real faces available are `profiles.avatar_url` —
                    identifiable users who did not agree to be the homepage's
                    marketing.
                What IS measured takes the slot instead, with labels that say
                exactly what was counted. */}
            {metricsAvailable && (
              <dl className="mirror-hero-proof">
                <div>
                  <dt>Average trust score</dt>
                  <dd><CountUp value={metrics.trustAvg} kind="percent" /></dd>
                </div>
                <div>
                  <dt>Gifts given</dt>
                  <dd><CountUp value={metrics.donations} kind="int" /></dd>
                </div>
              </dl>
            )}
          </div>

          <div className="mirror-hero-media">
            <Image
              src="/images/charitme-community-hero.png"
              alt="A diverse community celebrating what they can accomplish together"
              width={760}
              height={560}
              priority
              sizes="(max-width: 900px) 100vw, 46vw"
              quality={86}
            />
            <Link href="/success-stories" className="mirror-hero-card">
              <span className="mirror-hero-card-ic" aria-hidden="true"><Icon name="heart" /></span>
              <strong>Real People.<br />Real Impact.</strong>
              <span className="mirror-hero-card-body">
                Every act of kindness creates a story worth sharing.
              </span>
              <em>View Stories <Icon name="arrow" /></em>
            </Link>
          </div>
        </div>
      </section>

      <section id="causes" className="mirror-band mirror-causes" aria-labelledby="mirror-causes-title">
        <div className="mirror-wrap">
          <h2 id="mirror-causes-title">Causes That Change Lives</h2>
          <div className="mirror-cause-grid">
            {CAUSE_CARDS.map((card, index) => {
              // `getCause` rather than a second hand-written list: a renamed slug
              // drops the card instead of linking to a 404. Same rule
              // /success-stories already uses for its chips.
              const cause = getCause(card.slug);
              if (!cause) return null;
              // Summed across ALL the cause's categories. Reading one category's
              // row understated every multi-category cause — and the count sat
              // directly above a link that now goes to the cause page, where the
              // visitor can count the cards themselves.
              const stats = cause.categories.reduce(
                (acc: { count: number; supporters: number }, cat: string) => {
                  const row = categoryStats.get(cat);
                  return row ? { count: acc.count + row.count, supporters: acc.supporters + row.supporters } : acc;
                },
                { count: 0, supporters: 0 },
              );
              const measured = cause.categories.some((cat) => categoryStats.has(cat));
              return (
                <Reveal as="article" className="mirror-cause" key={cause.slug} delay={index * 45}>
                  <Link href={`/causes/${cause.slug}`}>
                    <div className="mirror-cause-media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={homeCausePhotos[index]} alt="" width={360} height={250} loading="lazy" decoding="async" />
                      <span><Icon name={card.icon} /></span>
                    </div>
                    <div className="mirror-cause-copy">
                      <h3>{cause.label}</h3>
                      <p>{cause.blurb}</p>
                      {measured ? <small>{stats.count.toLocaleString()} active campaigns · {stats.supporters.toLocaleString()} supporters</small> : null}
                      <strong>{card.action} <Icon name="arrow" /></strong>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Live campaign spotlight — moved out of the hero's right column to its
          own band here, on the LEFT.

          It is the same component, same props, same data (`heroItems`): the
          rotator, the Trust Score / Donors / Funded chips, the ACTIVE or
          VERIFIED badge, organiser, raised-of-goal with its progress bar,
          donation count, days left, the Donate Now link and the dot pagination
          all move together. Nothing was re-implemented, so nothing can drift
          from what the hero was rendering.

          The copy sits on the right, mirroring the hero above (copy left, card
          right) so the two bands read as a pair rather than a repeat. */}
      {metricsAvailable && (
        <section className="mirror-band mirror-metrics" aria-label="Our community impact">
          <div className="mirror-wrap mirror-metric-grid">
            <div className="mirror-metric-intro"><Icon name="heart" /><p><strong>Our Community.<br />Our Impact.</strong><span>Because together, we can do amazing things.</span></p></div>
            {/* Every figure MEASURED. The reference shows $48.7M+ raised, 265K+
                lives impacted, 128 countries and 58K+ supporters; none of those
                is a number this platform has, and publishing them would be the
                fabricated-statistic failure this repo keeps removing. The icons,
                the layout and the labels follow the design; the values come from
                `getHomeData`, and the whole band is suppressed rather than shown
                as zeroes when the read degrades (`shouldShowPlatformMetrics`). */}
            <dl className="mirror-metric-0"><div><dt><Icon name="heart" /> Raised for causes</dt><dd><CountUp value={metrics.raisedCents} kind="money" /></dd></div></dl>
            {/* ⚠️ "Donations", not "Lives impacted". `metrics.donations` is the count of
                completed donations — a payment count, not a human outcome — and it
                rendered the same 268 as the "Gifts given" tile above. Restating a
                payment as a life changed is the kind of unearned claim this file's
                own rule forbids: "labels that say exactly what was counted." */}
            <dl className="mirror-metric-1"><div><dt><Icon name="users" /> Donations</dt><dd><CountUp value={metrics.donations} kind="int" /></dd></div></dl>
            <dl className="mirror-metric-2"><div><dt><Icon name="globe" /> Active causes</dt><dd><CountUp value={metrics.campaigns} kind="int" /></dd></div></dl>
            {/* ⚠️ A fourth tile, "Average trust score", was removed here on the
                owner's instruction. The band is now three metrics wide and the
                grid track count in `globals.css` was cut to match — a stale
                `repeat(4, …)` would leave an empty column with a divider in it.
                `metrics.trustAvg` is still read and still rendered, in the hero
                proof slot above; this removed the tile, not the figure. */}
          </div>
        </section>
      )}

      {/* ── Live Right Now ────────────────────────────────────────────────
          The rotator keeps the `#impact` id the removed section owned, because
          the header and footer both link it. */}
      <section id="impact" className="mirror-band mirror-spotlight" aria-labelledby="mirror-spotlight-title">
        <div className="mirror-wrap mirror-spotlight-inner">
          <HeroSpotlightCarousel items={heroItems} variant="card" />
          <div className="mirror-spotlight-copy">
            <h2 id="mirror-spotlight-title">Live Right Now</h2>
            <p>
              Real campaigns, updating as donations arrive. Every one shows its
              CharitScore trust rating, how much it has raised, and how long is
              left — so you can see exactly what you are supporting before you give.
            </p>
            <div className="mirror-actions">
              <Link href="/campaigns" className="mirror-btn mirror-btn-primary">
                Browse All Campaigns <Icon name="arrow" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stories that inspire hope ─────────────────────────────────────
          A lead story beside two supporter quotes, as the reference draws it.

          ⚠️ The reference's lead card is a video with a start-media control,
          and its two quotes are attributed to named people with photographs
          ("Maria S., Single Mom"). Neither is real: there is no playable video
          in `campaign_media`, and inventing a testimonial with a face attached
          is a fabricated endorsement, not a design detail. The lead is a real
          COMPLETED campaign and the quotes are real recorded donations — with
          the anonymity rules `mapRecentDonations` already enforces.

          Renders nothing at all when there is no completed campaign to lead
          with: a stories band with no story is worse than no band. */}
      {leadStory && (
        <section className="mirror-band mirror-stories" aria-labelledby="mirror-stories-title">
          <div className="mirror-wrap">
            <header className="mirror-stories-head">
              <h2 id="mirror-stories-title">Stories That Inspire Hope</h2>
              <Link href="/success-stories">View All Stories <Icon name="arrow" /></Link>
            </header>
            <div className="mirror-stories-grid">
              <Link href={`/campaigns/${leadStory.slug}`} className="mirror-story-lead">
                <span className="mirror-story-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getDisplayCover(leadStory.cover, leadStory.category, leadStory.slug, 'home-lead-story')}
                    alt=""
                    width={560}
                    height={340}
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span className="mirror-story-body">
                  {leadStory.category && <span className="mirror-story-chip">{leadStory.category}</span>}
                  <strong>{leadStory.title}</strong>
                  {leadStory.blurb && <span className="mirror-story-blurb">{leadStory.blurb}</span>}
                  <span className="mirror-story-meta">
                    Funded — {formatMoneyCompact(leadStory.raisedCents, 'usd')} from{' '}
                    {leadStory.backers.toLocaleString()}{' '}
                    {leadStory.backers === 1 ? 'supporter' : 'supporters'}
                  </span>
                  {/* "Read", not "Watch": this opens a campaign page. */}
                  <em>Read the story <Icon name="arrow" /></em>
                </span>
              </Link>

              <div className="mirror-story-quotes">
                {recentDonations.length > 0
                  ? recentDonations.slice(0, 2).map((donation) => (
                      <article key={donation.id}>
                        <span aria-hidden="true">“</span>
                        <p>Supported <strong>{donation.campaignTitle}</strong> with {formatMoneyCompact(donation.amountCents, 'usd')}.</p>
                        <small>{donation.name}<br />CharitMe supporter</small>
                      </article>
                    ))
                  : sideStories.length > 0
                    ? sideStories.slice(0, 2).map((story) => (
                        <article key={story.id}>
                          <span aria-hidden="true">“</span>
                          <p>
                            <strong>{story.title}</strong> reached its goal with{' '}
                            {story.backers.toLocaleString()}{' '}
                            {story.backers === 1 ? 'supporter' : 'supporters'} behind it.
                          </p>
                          <small>Funded on CharitMe<br />{formatMoneyCompact(story.raisedCents, 'usd')} raised</small>
                        </article>
                      ))
                    // Last resort, so the column is never empty: statements
                    // about how the product works, attributed to the product —
                    // not quotes attributed to invented people.
                    : PROOF_POINTS.map((point) => (
                        <article key={point.name}>
                          <span aria-hidden="true">“</span>
                          <p>{point.quote}</p>
                          <small>{point.name}<br />Built into CharitMe</small>
                        </article>
                      ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Make an Impact Today ──────────────────────────────────────────
          Its own band with a photo beside it, as the reference draws it. It
          used to be nested at the bottom of the rotator's copy column. */}
      <section className="mirror-band mirror-impact-cta" aria-labelledby="mirror-proof-title">
        <div className={`mirror-wrap mirror-impact-inner${impactStory ? '' : ' is-copy-only'}`}>
          {impactStory && (
            <div className="mirror-impact-media" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getDisplayCover(impactStory.cover, impactStory.category, impactStory.slug, 'home-impact-story')}
                alt=""
                width={560}
                height={300}
                loading="lazy"
                decoding="async"
              />
            </div>
          )}
          <div className="mirror-impact-copy">
            <h2 id="mirror-proof-title">Make an Impact Today <Icon name="heart" /></h2>
            <p>Small acts. Big change. Be part of something beautiful.</p>
            <div className="mirror-actions">
              <Link href="/create" className="mirror-btn mirror-btn-primary">Start a Fundraiser</Link>
              <Link href="/campaigns" className="mirror-btn mirror-btn-secondary">Donate Now <Icon name="heart" /></Link>
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
