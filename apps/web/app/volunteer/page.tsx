import type { Metadata } from 'next';
import { getPublicOpportunities, getVolunteerCategories } from '../../lib/volunteers-server';
import { safeJsonLd } from '../../lib/json-ld';
import { CHARITME_ORIGIN } from '../../lib/public-routes';
import { seoMetadata } from '../../lib/seo';
import AeoContent from '../../components/AeoContent';
import VolunteerClient from './VolunteerClient';

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('/volunteer', {
  title: 'Volunteer Opportunities — Give Your Time',
  description:
    'Find volunteer opportunities that match your skills on CharitMe. Search by cause, filter remote roles, and apply in one click.',
  alternates: { canonical: 'https://www.charitme.com/volunteer' },
  openGraph: {
    title: 'Volunteer with CharitMe',
    description: 'Match your skills to causes that need you.',
    url: 'https://www.charitme.com/volunteer',
    type: 'website',
  },
  });
}

export const dynamic = 'force-dynamic';

export default async function VolunteerPage() {
  const [opportunities, categories] = await Promise.all([
    getPublicOpportunities(48),
    getVolunteerCategories(),
  ]);
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Volunteer opportunities on CharitMe',
    url: `${CHARITME_ORIGIN}/volunteer`,
    itemListElement: opportunities.map((opportunity, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${CHARITME_ORIGIN}/volunteer/${opportunity.slug}`,
      name: opportunity.title,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }} />
      <div className="container" style={{ padding: '40px 24px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 900, margin: 0, color: 'var(--t1)' }}>
          Volunteer Opportunities
        </h1>
        <p style={{ color: 'var(--t3)', fontSize: 15, margin: '8px 0 0', maxWidth: 640 }}>
          Give your time and skills to causes that need them. Filter by category or remote roles,
          then apply in one click — your applications are tracked in your dashboard.
        </p>
      </div>
      <VolunteerClient initialOpportunities={opportunities} categories={categories} />
      </div>
      <AeoContent route="/volunteer" title="Volunteer opportunity answers" />
    </>
  );
}
