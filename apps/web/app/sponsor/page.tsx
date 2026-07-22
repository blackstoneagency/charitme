import type { Metadata } from 'next';
import { listOpenOpportunities } from '../../lib/sponsorships';
import { SPONSORSHIP_CATEGORIES } from '../../lib/sponsorships-core';
import { safeJsonLd } from '../../lib/json-ld';
import { CHARITME_ORIGIN } from '../../lib/public-routes';
import SponsorMarketplace from './SponsorMarketplace';

export const metadata: Metadata = {
  title: 'Sponsorship Marketplace — Sponsor a Cause',
  description:
    'Businesses and individuals: discover campaigns and community projects seeking sponsors on CharitMe, and send a sponsorship offer in minutes.',
  alternates: { canonical: 'https://www.charitme.com/sponsor' },
};
export const dynamic = 'force-dynamic';

export default async function SponsorPage() {
  const opportunities = await listOpenOpportunities({ limit: 60 });
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Open campaign sponsorship opportunities on CharitMe',
    url: `${CHARITME_ORIGIN}/sponsor`,
    itemListElement: opportunities.map((opportunity, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${CHARITME_ORIGIN}/sponsor/${opportunity.id}`,
      name: opportunity.title,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }} />
      <div className="container" style={{ padding: '40px 24px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>🤝 Sponsor a Cause</h1>
        <p style={{ color: 'var(--t3)', fontSize: '15px', maxWidth: 640 }}>
          Discover campaigns and community projects looking for sponsors. Offer support, get
          recognition, and make measurable impact. Organizers can post a sponsorship opportunity
          from their dashboard.
        </p>
      </div>

      <SponsorMarketplace
        initialOpportunities={opportunities}
        categories={[...SPONSORSHIP_CATEGORIES]}
      />
      </div>
    </>
  );
}
