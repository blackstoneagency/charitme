import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicGrants, getGrantCategories } from '../../lib/grants-server';
import { safeJsonLd } from '../../lib/json-ld';
import { CHARITME_ORIGIN } from '../../lib/public-routes';
import { seoMetadata } from '../../lib/seo';
import GrantsClient from './GrantsClient';

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('/grants', {
  title: 'Grant Discovery — Find Funding for Your Cause',
  description:
    'Discover foundation, government, corporate, and community grants on CharitMe. Search by cause, filter by category, and apply with AI-assisted matching.',
  alternates: { canonical: 'https://www.charitme.com/grants' },
  openGraph: {
    title: 'Grant Discovery on CharitMe',
    description: 'Find and apply for grants that fund your mission — with AI matching.',
    url: 'https://www.charitme.com/grants',
    type: 'website',
  },
  });
}

export const dynamic = 'force-dynamic';

export default async function GrantsPage() {
  const [grants, categories] = await Promise.all([
    getPublicGrants(48),
    getGrantCategories(),
  ]);
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Open grant opportunities on CharitMe',
    url: `${CHARITME_ORIGIN}/grants`,
    itemListElement: grants.map((grant, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${CHARITME_ORIGIN}/grants/${grant.slug}`,
      name: grant.title,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }} />
      <div className="container" style={{ padding: '40px 24px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 900, margin: 0, color: 'var(--t1)' }}>
              Grant Discovery
            </h1>
            <p style={{ color: 'var(--t3)', fontSize: 15, margin: '8px 0 0', maxWidth: 640 }}>
              Foundation, government, corporate, and community grants — searchable in one place.
              Sign in to save opportunities, get AI-matched recommendations, and track applications.
            </p>
          </div>
          <Link href="/dashboard/grants">
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px',
              background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rl)',
              fontSize: 14, fontWeight: 700, color: 'var(--t1)', whiteSpace: 'nowrap',
            }}>
              My applications →
            </span>
          </Link>
        </div>
      </div>

      <GrantsClient initialGrants={grants} categories={categories} />
      </div>
    </>
  );
}
