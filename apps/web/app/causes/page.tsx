import Link from 'next/link';
import type { Metadata } from 'next';
import { CAUSES, POPULAR_CAUSES } from '../../lib/causes';
import { getTranslator } from '../../lib/locale-server';
import { getCausesIndexData } from '../../lib/causes-index';
import { getCoverForCategory } from '../../lib/photo-catalog';
import CampaignImage from '../../components/CampaignImage';
import CausesBrowser, { type BrowseCause } from './CausesBrowser';
import StayInformed from './StayInformed';

export const metadata: Metadata = {
  title: 'Browse Causes',
  description:
    'Explore every cause on CharitMe — from medical and education to animals, the environment, disaster relief, and more. Find a campaign to support today.',
  alternates: { canonical: 'https://www.charitme.com/causes' },
};

export const revalidate = 300;

/** `—` for a figure we could not measure. Never "0": those are different facts. */
function stat(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  return value.toLocaleString('en-US');
}
function money(cents: number | null): string {
  if (cents === null) return '—';
  const d = Math.round(cents / 100);
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  return `$${d.toLocaleString('en-US')}`;
}

const TILE_ICONS = [
  <svg key="a" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>,
  <svg key="b" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  <svg key="c" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9" /></svg>,
  <svg key="d" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" /></svg>,
];

export default async function CausesPage() {
  const [data, t] = await Promise.all([getCausesIndexData(), getTranslator()]);

  const ordered = [...POPULAR_CAUSES, ...CAUSES.filter((c) => !POPULAR_CAUSES.some((p) => p.slug === c.slug))];
  const browse: BrowseCause[] = ordered.map((cause, rank) => {
    const label = t(`nav.cause.${cause.slug}`);
    const figures = data.perCause.get(cause.slug);
    return {
      slug: cause.slug,
      // Same key the mega-menu renders, so the twenty names cannot drift apart.
      label: label === `nav.cause.${cause.slug}` ? cause.label : label,
      blurb: cause.blurb,
      photo: getCoverForCategory(cause.categories[0]),
      campaigns: figures?.campaigns,
      raisedCents: figures?.raisedCents,
      rank,
    };
  });

  const tiles = [
    { value: stat(data.activeCampaigns), label: 'Active campaigns' },
    { value: money(data.raisedTotalCents), label: 'Raised on CharitMe' },
    { value: stat(data.gifts), label: 'Gifts given' },
    { value: stat(data.countries), label: 'Countries supported' },
  ];

  return (
    <div className="cx-page">
      <section className="cx-hero" aria-labelledby="cx-hero-title">
        <div className="cx-hero-photo" aria-hidden="true">
          <CampaignImage
            src={getCoverForCategory('Environment')}
            category="Environment"
            campaignKey="causes-index"
            alt=""
            width={900}
            height={620}
            loading="eager"
            fetchPriority="high"
          />
        </div>
        <div className="cx-hero-inner">
          <nav aria-label="Breadcrumb" className="cx-crumbs">
            <ol>
              <li><Link href="/">{t('nav.home')}</Link></li>
              <li aria-hidden="true">›</li>
              <li aria-current="page">{t('nav.group.causes')}</li>
            </ol>
          </nav>
          <div className="cx-hero-copy">
            <h1 id="cx-hero-title">{t('causes.page_title')}</h1>
            <p>{t('causes.page_intro')}</p>
            <div className="cx-hero-actions">
              <Link href="/campaigns" className="cta-primary" style={{ display: 'inline-flex' }}>
                {t('cl.donate_now')}
              </Link>
              <Link href="/how-it-works" className="cx-btn-secondary">{t('footer.link.how_it_works')}</Link>
            </div>
          </div>
          <aside className="cx-hero-card">
            <h2>Together, we can make a difference.</h2>
            <p>Every campaign here is run by a real person or organisation, and every figure on this page is
              counted from live data.</p>
          </aside>
        </div>
      </section>

      {/* Measured, not the reference's figures — see lib/causes-index.ts. */}
      <section className="cx-stats" aria-label="CharitMe at a glance">
        {/* A dl may group its pairs with a div, but that div has to contain the
            dt and dd DIRECTLY. An extra wrapper around them breaks the grouping
            and axe flags it twice over (definition-list + dlitem). The icon sits
            inside the dd and is placed with CSS rather than adding a level. */}
        <dl>
          {tiles.map((tile, i) => (
            <div className="cx-stat" key={tile.label}>
              <dd>
                <span className={`cx-stat-ic cx-stat-ic--${i}`} aria-hidden="true">{TILE_ICONS[i]}</span>
                <span className="cx-stat-value">{tile.value}</span>
              </dd>
              <dt>{tile.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <div className="container cx-main">
        <h2 id="browse-by-cause" className="cx-browse-title">Browse by cause</h2>
        <CausesBrowser causes={browse} />

        <div className="cx-missing">
          <h2>{t('causes.missing_title')}</h2>
          <p>{t('causes.missing_body')}</p>
          <Link href="/create" className="cta-primary" style={{ display: 'inline-flex' }}>
            {t('nav.start_fundraiser')}
          </Link>
        </div>

        <StayInformed />
      </div>
    </div>
  );
}
