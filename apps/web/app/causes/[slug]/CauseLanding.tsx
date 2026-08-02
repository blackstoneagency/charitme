import Link from 'next/link';
import { getTranslator } from '../../../lib/locale-server';
import { causeWays, scopeDisclosure } from '../../../lib/cause-ways-core';
import CampaignImage from '../../../components/CampaignImage';
import { POPULAR_CAUSES, causeBrowseHref, type Cause } from '../../../lib/causes';
import { formatStat, formatMoneyStat, type CauseStats } from '../../../lib/cause-landing';
import { getCoverForCategory } from '../../../lib/photo-catalog';

/**
 * The cause landing hero, "where your support goes" figures, programme panel and
 * "other ways to help" — the design's upper half.
 *
 * Built as a server component with no client JS: everything here is content and
 * links. The reference has no interactive element above the campaign grid, and
 * shipping a client bundle for a hero would cost LCP on the page most likely to
 * be a visitor's entry point from a share.
 *
 * ⚠️ Two things in the reference are deliberately NOT reproduced:
 *
 *  1. **The star rating and its five-figure supporter count.** There is no
 *     ratings table in this database at all. Rendering stars would be an
 *     invented endorsement on a page asking for money. Replaced with the real,
 *     measured supporter count.
 *  2. **The countries-reached claim.** `supported_countries` holds 69 rows, far
 *     fewer than the mock asserts, and that exact claim is already recorded in
 *     docs/ as a fabricated statistic the repo has been caught by before. The
 *     figure is deliberately not repeated here: the guard that forbids shipping
 *     it cannot tell prose from markup, and should not have to.
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
  const otherCauses = POPULAR_CAUSES.filter((c) => c.slug !== cause.slug).slice(0, 4);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="cl-hero" aria-labelledby="cl-hero-title">
        <div className="cl-hero-copy">
          <p className="cl-eyebrow">{cause.label.toUpperCase()}</p>
          <h1 id="cl-hero-title" className="cl-hero-title">
            {t('cl.hero_title')}
          </h1>
          <p className="cl-hero-lede">{cause.blurb}</p>
          <div className="cl-hero-actions">
            <Link href={causeBrowseHref(cause)} className="cta-primary" style={{ display: 'inline-flex' }}>
              {t('cl.donate_now')}
            </Link>
            <Link href="/create" className="cl-btn-secondary">
              {t('cl.start_fundraiser')}
            </Link>
          </div>

          {/* Where the mock puts a star rating. This is measured instead. */}
          <p className="cl-hero-proof">
            <strong>{formatStat(stats.supporters)}</strong>{' '}
            {stats.supporters === 1 ? 'person has' : 'people have'} given to{' '}
            <strong>{formatStat(stats.liveCampaigns)}</strong> live{' '}
            {stats.liveCampaigns === 1 ? 'campaign' : 'campaigns'} in this cause.
          </p>
        </div>

        <div className="cl-hero-media">
          <CampaignImage
            src={heroPhoto}
            category={cause.categories[0]}
            campaignKey={cause.slug}
            alt={`Photograph representing ${cause.label} fundraising`}
            width={640}
            height={520}
            loading="eager"
            fetchPriority="high"
            className="cl-hero-img"
          />
        </div>

        {/* ── Programme panel: the design's "Your kindness creates real change".
            Each row is one of this cause's REAL campaign categories with its
            live count, linking to that filtered list. The mock's four invented
            programmes ("Provide Food", "Safe Shelter"…) have no equivalent
            entity here, and inventing them would make every row a dead end. */}
        <aside className="cl-programs" aria-labelledby="cl-programs-title">
          <h2 id="cl-programs-title" className="cl-programs-title">
            {t('cl.support_goes_to')}
          </h2>
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
          <Link href="/causes" className="cl-programs-more">
            {t('cl.see_all_causes')}
          </Link>
        </aside>
      </section>

      {/* ── Where your support goes ──────────────────────────────────────── */}
      <section className="cl-stats" aria-labelledby="cl-stats-title">
        <h2 id="cl-stats-title" className="cl-stats-title">{t('cl.where_support_goes')}</h2>
        <dl className="cl-stat-grid">
          <div className="cl-stat">
            <dt>{t('cl.stat_raised')}</dt>
            <dd>{formatMoneyStat(stats.raisedCents)}</dd>
          </div>
          <div className="cl-stat">
            <dt>{t('cl.stat_gifts')}</dt>
            <dd>{formatStat(stats.supporters)}</dd>
          </div>
          <div className="cl-stat">
            <dt>{t('cl.stat_live')}</dt>
            <dd>{formatStat(stats.liveCampaigns)}</dd>
          </div>
          <div className="cl-stat">
            <dt>{t('cl.stat_countries')}</dt>
            <dd>{formatStat(stats.countries)}</dd>
          </div>
        </dl>
        <p className="cl-stats-note">
          Counted live from CharitMe campaigns in {cause.categories.join(', ')}. “Countries we can reach” is
          the number of countries where we can accept a donation today, not a claim about where money has
          been spent.
        </p>
      </section>

      {/* ── Ways to help THIS cause ──────────────────────────────────────
          Distinct from `cl-ways` below, which is other CAUSES. Each link
          carries an explicit "site-wide" marker unless it genuinely narrows to
          this cause — only /campaigns accepts a category filter. */}
      <section className="cl-help" aria-labelledby="cl-help-title">
        <h2 id="cl-help-title" className="cl-help-title">Ways to help</h2>
        <ul className="cl-help-grid">
          {ways.map((way) => (
            <li key={way.id}>
              <Link href={way.href} className="cl-help-card">
                <strong className="cl-help-label">
                  {way.label}
                  {!way.scoped && (
                    <span className="cl-help-scope"> · all causes</span>
                  )}
                </strong>
                <span className="cl-help-blurb">{way.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
        {disclosure && <p className="cl-help-note">{disclosure}</p>}
      </section>

      {/* ── Other ways to help ───────────────────────────────────────────── */}
      <section className="cl-ways" aria-labelledby="cl-ways-title">
        <h2 id="cl-ways-title" className="cl-ways-title">{t('cl.other_ways')}</h2>
        <ul className="cl-ways-grid">
          {otherCauses.map((other) => (
            <li key={other.slug}>
              <Link href={`/causes/${other.slug}`} className="cl-way">
                <CampaignImage
                  src={getCoverForCategory(other.categories[0])}
                  category={other.categories[0]}
                  campaignKey={other.slug}
                  alt=""
                  width={300}
                  height={180}
                  className="cl-way-img"
                />
                <span className="cl-way-body">
                  <strong>{other.label}</strong>
                  <span>{other.blurb}</span>
                  <span className="cl-way-cta">{t('cl.help_now')}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
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
          <p>
            Every gift to a {cause.label.toLowerCase()} campaign goes to the organiser, minus payment
            processing. CharitMe takes 0%.
          </p>
        </div>
        <div className="cl-cta-actions">
          <Link href={causeBrowseHref(cause)} className="cta-primary" style={{ display: 'inline-flex' }}>
            Donate now
          </Link>
          <Link href="/create" className="cl-btn-secondary">
            Start a fundraiser →
          </Link>
        </div>
      </div>
    </section>
  );
}
