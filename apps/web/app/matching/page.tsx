import type { Metadata } from 'next';
import Link from 'next/link';
import { formatMoneyShort } from '@shared/currencies';
import { Badge, EmptyState } from '../../components/ui';
import { listActivePrograms } from '../../lib/matching';
import { safeJsonLd } from '../../lib/json-ld';
import { CHARITME_ORIGIN } from '../../lib/public-routes';
import { seoMetadata } from '../../lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('/matching', {
  title: 'Corporate Matching Gifts — Double Your Impact',
  description:
    'Find your employer’s matching-gift program on CharitMe and claim a match for your donations. Companies can launch a program in minutes.',
  alternates: { canonical: 'https://www.charitme.com/matching' },
  });
}
export const dynamic = 'force-dynamic';

export default async function MatchingPage() {
  const programs = await listActivePrograms();
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Corporate matching gift programs on CharitMe',
    url: `${CHARITME_ORIGIN}/matching`,
    itemListElement: programs.map((program, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${CHARITME_ORIGIN}/matching/${program.id}`,
      name: `${program.company_name} matching gifts`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }} />
      <div className="container" style={{ padding: '40px 24px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>🏢 Matching Gifts</h1>
        <p style={{ color: 'var(--t3)', fontSize: '15px', maxWidth: 640 }}>
          Many employers match their employees’ charitable donations. Find a matching program,
          submit a claim for your donation, and the company doubles (or more) your impact.
          Companies can{' '}
          <Link href="/matching/manage" style={{ color: 'var(--green-dark)', fontWeight: 600 }}>
            launch a program
          </Link>
          .
        </p>
      </div>

      {programs.length === 0 ? (
        <EmptyState
          icon="🏢"
          title="No matching programs yet"
          body="Check back soon, or if you run a company, launch the first matching program."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
          {programs.map((p) => (
            <Link
              key={p.id}
              href={`/matching/${p.id}`}
              style={{
                display: 'block',
                border: '1px solid var(--b2)',
                borderRadius: 'var(--rl)',
                padding: 18,
                background: 'var(--s1)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <Badge color="green">{p.match_ratio}:1 match</Badge>
                {p.annual_cap_cents > 0 && (
                  <Badge color="gray">Up to {formatMoneyShort(p.annual_cap_cents, p.currency)}/yr</Badge>
                )}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{p.company_name}</h3>
              {p.description && (
                <p style={{ color: 'var(--t3)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                  {p.description.length > 140 ? `${p.description.slice(0, 140)}…` : p.description}
                </p>
              )}
              {p.categories.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--t4)' }}>
                  Eligible: {p.categories.join(', ')}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
      </div>
    </>
  );
}
