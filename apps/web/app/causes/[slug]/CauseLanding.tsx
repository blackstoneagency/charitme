import Link from 'next/link';
import { getTranslator } from '../../../lib/locale-server';
import { causeWays, scopeDisclosure } from '../../../lib/cause-ways-core';
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
export default async function CauseLanding({
  cause,
  stats,
}: {
  cause: Cause;
  stats: CauseStats;
}) {
  const t = await getTranslator();
  const ways = causeWays(cause);
  const disclosure = scopeDisclosure(ways, cause.label);
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

      {/* ── Stats sheet, lifting over the hero as in the reference ────────── */}
      <section className="cl-sheet" aria-labelledby="cl-stats-title">
        <h2 id="cl-stats-title" className="cl-visually-hidden">
          {t('cl.where_support_goes')}
        </h2>
        <dl className="cl-stat-row">
          <div className="cl-stat">
            <dd>{formatStat(stats.liveCampaigns)}</dd>
            <dt>{t('cl.stat_live')}</dt>
          </div>
          <div className="cl-stat">
            <dd>{formatMoneyStat(stats.raisedCents)}</dd>
            <dt>{t('cl.stat_raised')}</dt>
          </div>
          <div className="cl-stat">
            <dd>{formatStat(stats.supporters)}</dd>
            <dt>{t('cl.stat_gifts')}</dt>
          </div>
          <div className="cl-stat">
            <dd>{formatStat(stats.countries)}</dd>
            <dt>{t('cl.stat_countries')}</dt>
          </div>
        </dl>
        <p className="cl-stats-note">{t('cl.stats_note', { categories: cause.categories.join(', ') })}</p>
      </section>

      {/* ── What this cause's money actually goes to ──────────────────────── */}
      <section className="cl-programs-band" aria-labelledby="cl-programs-title">
        <h2 id="cl-programs-title" className="cl-programs-title">{t('cl.support_goes_to')}</h2>
        <ul className="cl-programs-list">
          {cause.categories.map((category) => {
            const n = stats.perCategory[category];
            return (
              <li key={category}>
                <Link href={`/campaigns?category=${encodeURIComponent(category)}`} className="cl-program">
                  <span className="cl-program-name">{category}</span>
                  <span className="cl-program-count">
                    {n === undefined ? '—' : `${n} ${t('cl.live_suffix')}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Ways to help THIS cause. Each link carries an explicit "all causes"
          marker unless it genuinely narrows — only /campaigns takes a category
          filter. (Owned by the cause-ways lane; left intact.) */}
      <section className="cl-help" aria-labelledby="cl-help-title">
        <h2 id="cl-help-title" className="cl-help-title">Ways to help</h2>
        <ul className="cl-help-grid">
          {ways.map((way) => (
            <li key={way.id}>
              <Link href={way.href} className="cl-help-card">
                <strong className="cl-help-label">
                  {way.label}
                  {!way.scoped && <span className="cl-help-scope"> · all causes</span>}
                </strong>
                <span className="cl-help-blurb">{way.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
        {disclosure && <p className="cl-help-note">{disclosure}</p>}
      </section>
    </>
  );
}

/** The closing band. Separate so it can sit BELOW the campaign grid. */
export async function CauseCtaBand({ cause }: { cause: Cause }) {
  const t = await getTranslator();
  return (
    <section className="cl-cta" aria-labelledby="cl-cta-title">
      <div className="cl-cta-inner">
        <div>
          <h2 id="cl-cta-title">{t('cl.cta_title')}</h2>
          <p>{t('cl.cta_body', { cause: cause.label.toLowerCase() })}</p>
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
