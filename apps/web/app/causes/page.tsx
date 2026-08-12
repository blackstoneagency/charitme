import Link from 'next/link';
import type { Metadata } from 'next';
import { CAUSES, POPULAR_CAUSES } from '../../lib/causes';
import { getTranslator } from '../../lib/locale-server';
import { getCausesIndexData } from '../../lib/causes-index';
import { getDistinctPhotosForItems } from '../../lib/photo-catalog';
import { IndexHero, StatStrip, statValue, moneyValue } from '../../components/IndexHero';
import CausesBrowser, { type BrowseCause } from './CausesBrowser';
import StayInformed from '../../components/StayInformed';

export const metadata: Metadata = {
  title: 'Browse Causes',
  description:
    'Explore every cause on CharitMe — from medical and education to animals, the environment, disaster relief, and more. Find a campaign to support today.',
  alternates: { canonical: 'https://www.charitme.com/causes' },
};

export const revalidate = 300;

export default async function CausesPage() {
  const [data, t] = await Promise.all([getCausesIndexData(), getTranslator()]);

  const ordered = [...POPULAR_CAUSES, ...CAUSES.filter((c) => !POPULAR_CAUSES.some((p) => p.slug === c.slug))];
  const [heroPhoto, ...causePhotos] = getDistinctPhotosForItems([
    { category: 'Environment', key: 'causes-index-hero' },
    ...ordered.map((cause) => ({ category: cause.categories[0], key: `cause-card-${cause.slug}` })),
  ]);
  const browse: BrowseCause[] = ordered.map((cause, rank) => {
    const label = t(`nav.cause.${cause.slug}`);
    const figures = data.perCause.get(cause.slug);
    return {
      slug: cause.slug,
      // Same key the mega-menu renders, so the twenty names cannot drift apart.
      label: label === `nav.cause.${cause.slug}` ? cause.label : label,
      blurb: cause.blurb,
      photo: causePhotos[rank],
      campaigns: figures?.campaigns,
      raisedCents: figures?.raisedCents,
      rank,
    };
  });

  const tiles = [
    { value: statValue(data.activeCampaigns), label: 'Active campaigns' },
    { value: moneyValue(data.raisedTotalCents), label: 'Raised on CharitMe' },
    { value: statValue(data.gifts), label: 'Gifts given' },
    { value: statValue(data.countries), label: 'Countries supported' },
  ];

  return (
    <div className="cx-page">
      <IndexHero
        crumbs={[{ label: t('nav.home'), href: '/' }, { label: t('nav.group.causes') }]}
        title={t('causes.page_title')}
        lede={t('causes.page_intro')}
        photo={heroPhoto}
        photoCategory="Environment"
        photoKey="causes-index"
        card={{
          title: 'Together, we can make a difference.',
          body: 'Every campaign here is run by a real person or organisation, and every figure on this page is counted from live data.',
        }}
        actions={
          <>
            <Link href="/campaigns" className="cta-primary" style={{ display: 'inline-flex' }}>
              {t('cl.donate_now')}
            </Link>
            <Link href="/how-it-works" className="cx-btn-secondary">{t('footer.link.how_it_works')}</Link>
          </>
        }
      />

      {/* Measured, not the reference's figures — see lib/causes-index.ts. */}
      <StatStrip label="CharitMe at a glance" tiles={tiles} />

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
