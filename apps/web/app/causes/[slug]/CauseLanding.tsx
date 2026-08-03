import Link from 'next/link';
import { getTranslator } from '../../../lib/locale-server';
import CampaignImage from '../../../components/CampaignImage';
import { causeBrowseHref, type Cause } from '../../../lib/causes';
import { formatStat, formatMoneyStat, type CauseStats } from '../../../lib/cause-landing';
import { getCoverForCategory } from '../../../lib/photo-catalog';

/**
 * The cause landing hero and stats sheet.
 *
 * A server component with no client JS: everything above the campaign grid is
 * content and links. Shipping a client bundle for a hero would cost LCP on the
 * page most likely to be a visitor's entry point from a shared link.
 *
 * ── Three deliberate departures from the reference ──────────────────────────
 *
 * 1. **The four stat figures are measured, not the mock's.** The reference shows
 *    a four-digit campaign count, an eight-figure raised total, a six-figure
 *    "lives impacted" and a three-digit country count. Reality for a cause here
 *    is two orders of magnitude smaller, and `supported_countries` holds 69 rows.
 *    That country claim is *already* recorded in docs/ as a fabricated statistic
 *    this repo shipped once and had to retract. A visitor deciding whether to
 *    give money is exactly the person who must not be handed invented numbers.
 *    `__tests__/cause-landing.test.ts` fails if a mock literal appears here.
 *
 * 2. **The stats sheet uses surface tokens, not the mock's literal white.** In
 *    the reference it is a white card. Shipping that renders a white slab in dark
 *    mode — the exact defect `theme-tokens.test.ts` exists to block. This keeps
 *    the design's structure (an elevated sheet lifting over the hero) while
 *    following the visitor's theme.
 *
 * 3. **The hero IS committed to a dark treatment in both themes**, which is not
 *    the same mistake: it is white text over a photographic scrim, the standard
 *    treatment for a photo hero, and the scrim guarantees the contrast rather
 *    than the theme doing it.
 */
/** One icon per stat tile, in tile order. Inline SVG so the band ships no font
 *  or image request for four small glyphs. */
const STAT_ICONS = [
  <svg key="a" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  <svg key="b" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  <svg key="c" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>,
  <svg key="d" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" /></svg>,
];

export default async function CauseLanding({
  cause,
  stats,
}: {
  cause: Cause;
  stats: CauseStats;
}) {
  const t = await getTranslator();
  const heroPhoto = getCoverForCategory(cause.categories[0]);

  return (
    <>
      <section className="cl-hero" aria-labelledby="cl-hero-title">
        {/* Decorative: the H1 beside it already names the cause, so a screen
            reader announcing the photo would only repeat it. */}
        <div className="cl-hero-photo" aria-hidden="true">
          <CampaignImage
            src={heroPhoto}
            category={cause.categories[0]}
            campaignKey={cause.slug}
            alt=""
            width={900}
            height={700}
            loading="eager"
            fetchPriority="high"
            className="cl-hero-img"
          />
        </div>

        <div className="cl-hero-inner">
          <nav aria-label="Breadcrumb" className="cl-crumbs">
            <ol>
              <li><Link href="/">{t('nav.home')}</Link></li>
              <li aria-hidden="true">›</li>
              <li><Link href="/causes">{t('nav.group.causes')}</Link></li>
              <li aria-hidden="true">›</li>
              <li aria-current="page">{cause.label}</li>
            </ol>
          </nav>

          <div className="cl-hero-copy">
            <h1 id="cl-hero-title" className="cl-hero-title">
              {cause.label}
              <span className="cl-hero-heart" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
                </svg>
              </span>
            </h1>
            <p className="cl-tagline">{cause.tagline}</p>
            <p className="cl-hero-lede">{cause.intro}</p>

            <div className="cl-hero-actions">
              <Link href={causeBrowseHref(cause)} className="cta-primary" style={{ display: 'inline-flex' }}>
                {t('cl.donate_now')}
              </Link>
              <Link href="/create" className="cl-btn-secondary">
                {t('cl.start_fundraiser')}
              </Link>
            </div>
          </div>

          {/* The reference's floating support card. Its CTA points at
              /success-stories, a page that exists — the mock's link had nowhere
              to go. */}
          <aside className="cl-support-card" aria-labelledby="cl-support-title">
            <span className="cl-support-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
              </svg>
            </span>
            <h2 id="cl-support-title">{t('cl.support_card_title')}</h2>
            <p>{t('cl.support_card_body')}</p>
            <Link href="/success-stories" className="cl-support-link">
              {t('cl.see_real_stories')}
            </Link>
          </aside>
        </div>
      </section>

      {/* ── "Real impact" band: copy on the left, the four MEASURED figures on
          the right. The reference asserts a six-figure "youth impacted", a
          five-figure "athletes supported", a four-figure programme count and a
          three-figure community count. None of those is an entity in this
          schema. These four are counted live, and the note under them says what
          each one is so a reader cannot mistake reach for spend. */}
      <section className="cl-sheet" aria-labelledby="cl-stats-title">
        <div className="cl-sheet-intro">
          <span className="cl-sheet-heart" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
            </svg>
          </span>
          <h2 id="cl-stats-title">{cause.impactTitle ?? t('cl.where_support_goes')}</h2>
          {cause.impactBlurb && <p>{cause.impactBlurb}</p>}
        </div>
        <dl className="cl-stat-row">
          {STAT_ICONS.map((icon, i) => {
            const tile = [
              { value: formatStat(stats.liveCampaigns), label: t('cl.stat_live') },
              { value: formatMoneyStat(stats.raisedCents), label: t('cl.stat_raised') },
              { value: formatStat(stats.supporters), label: t('cl.stat_gifts') },
              { value: formatStat(stats.countries), label: t('cl.stat_countries') },
            ][i];
            return (
              <div className="cl-stat" key={tile.label}>
                <span className={`cl-stat-ic cl-stat-ic--${i}`} aria-hidden="true">{icon}</span>
                <dd>{tile.value}</dd>
                <dt>{tile.label}</dt>
              </div>
            );
          })}
        </dl>
        <p className="cl-stats-note">{t('cl.stats_note', { categories: cause.categories.join(', ') })}</p>
      </section>

      {/* ── Two blocks that used to sit here are deliberately gone ────────────
          "Your support goes to" (a per-category count row) and "Ways to help"
          (a five-link grid) both sat between the stats band and the campaigns,
          and neither appears in the reference for any cause.

          Removing them loses no destination. Every link the ways grid carried
          is reachable from somewhere that outranks it:
            · /campaigns, /events, /volunteer  → the hub tab strip below the stats
            · /create                          → the hero AND the closing band
            · /partner                         → the main nav's Resources group
          The per-category counts were the same campaigns the grid underneath
          already lists, counted a second time.

          Asserted in `cause-landing.test.ts` rather than merely deleted, so a
          later copy-paste cannot quietly bring either back. */}
    </>
  );
}

/** The closing band. Separate so it can sit BELOW the campaign grid. */
export async function CauseCtaBand({ cause }: { cause: Cause }) {
  const t = await getTranslator();
  return (
    <section className="cl-cta" aria-labelledby="cl-cta-title">
      <div className="cl-cta-inner">
        {/* The reference's outline heart. Decorative — the heading beside it
            carries the message. */}
        <span className="cl-cta-heart" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
        </span>
        <div>
          {/* `ctaTitle` is authored English. Falling back to the translated
              default keeps the other 18 causes localised — see the note on
              `Cause.ctaTitle` for why this is not applied everywhere. */}
          <h2 id="cl-cta-title">{cause.ctaTitle ?? t('cl.cta_title')}</h2>
          <p>{cause.ctaBlurb ?? t('cl.cta_body', { cause: cause.label.toLowerCase() })}</p>
        </div>
        <div className="cl-cta-actions">
          <Link href={causeBrowseHref(cause)} className="cta-primary" style={{ display: 'inline-flex' }}>
            {t('cl.donate_now')}
          </Link>
          <Link href="/create" className="cl-btn-secondary">
            {t('cl.start_fundraiser')}
          </Link>
        </div>
      </div>
    </section>
  );
}
