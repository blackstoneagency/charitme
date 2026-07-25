import type { Metadata } from 'next';
import Link from 'next/link';
import { formatMoneyShort } from '@shared/currencies';
import { Badge, EmptyState, ProgressBar } from '../../components/ui';
import { listPublishedImpactSummaries } from '../../lib/impact';
import { safeJsonLd } from '../../lib/json-ld';
import { CHARITME_ORIGIN } from '../../lib/public-routes';
import { seoMetadata } from '../../lib/seo';
import AeoContent from '../../components/AeoContent';

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('/impact', {
  title: 'Impact Reports - Donation Transparency',
  description:
    'Explore published CharitMe impact reports with spending plans, progress updates, outcome metrics, and transparency scores.',
  alternates: { canonical: 'https://www.charitme.com/impact' },
  openGraph: {
    title: 'CharitMe Impact Reports',
    description:
      'See how campaigns use donations through public spending plans, progress updates, and transparency scores.',
    url: 'https://www.charitme.com/impact',
    type: 'website',
  },
  });
}

export const dynamic = 'force-dynamic';

const RATING_COLOR: Record<string, 'green' | 'blue' | 'gray'> = {
  Exceptional: 'green',
  Strong: 'green',
  Developing: 'blue',
  Building: 'gray',
};

export default async function ImpactIndexPage() {
  const summaries = await listPublishedImpactSummaries(48);
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'CharitMe impact reports',
    description: 'Published campaign impact reports with spending plans and transparency scores.',
    url: `${CHARITME_ORIGIN}/impact`,
    itemListElement: summaries.map((summary, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${CHARITME_ORIGIN}/impact/${summary.campaign.slug}`,
      name: summary.campaign.title,
      description: summary.plan.summary ?? summary.plan.title,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }} />
      <div className="container" style={{ padding: '40px 24px', maxWidth: 1180 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 28 }}>
          <div style={{ maxWidth: 720 }}>
            <h1 style={{ fontSize: 'clamp(26px, 5vw, 36px)', fontWeight: 900, margin: 0, color: 'var(--t1)' }}>
              Impact Reports
            </h1>
            <p style={{ color: 'var(--t3)', fontSize: 15, lineHeight: 1.7, margin: '10px 0 0' }}>
              Published spending plans, verified progress updates, and outcome metrics from campaigns
              that are making donation transparency part of the story.
            </p>
          </div>
          <Link
            href="/campaigns"
            style={{
              display: 'inline-flex',
              minHeight: 44,
              alignItems: 'center',
              padding: '0 18px',
              border: '1px solid var(--b2)',
              borderRadius: 'var(--r)',
              color: 'var(--t1)',
              fontWeight: 800,
              textDecoration: 'none',
              background: 'var(--s1)',
            }}
          >
            Browse campaigns
          </Link>
        </div>

        {summaries.length === 0 ? (
          <EmptyState
            icon="Impact"
            title="No published impact reports yet"
            body="Campaigns with published spending plans and updates will appear here as organizers add them."
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 18 }}>
            {summaries.map((summary) => (
              <Link
                key={summary.plan.id}
                href={`/impact/${summary.campaign.slug}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  border: '1px solid var(--b2)',
                  borderRadius: 'var(--rl)',
                  padding: 18,
                  background: 'var(--s1)',
                  color: 'inherit',
                  textDecoration: 'none',
                  minHeight: 280,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <Badge color={RATING_COLOR[summary.transparency.rating] ?? 'gray'}>{summary.transparency.rating}</Badge>
                  <span style={{ color: 'var(--green-dark)', fontWeight: 900, fontSize: 22 }}>
                    {summary.transparency.score}
                    <span style={{ color: 'var(--t4)', fontSize: 12, fontWeight: 700 }}>/100</span>
                  </span>
                </div>

                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 6px', color: 'var(--t1)' }}>
                    {summary.campaign.title}
                  </h2>
                  <p style={{ color: 'var(--t3)', fontSize: 14, lineHeight: 1.55, margin: 0 }}>
                    {(summary.plan.summary ?? summary.plan.title).length > 150
                      ? `${(summary.plan.summary ?? summary.plan.title).slice(0, 150)}...`
                      : summary.plan.summary ?? summary.plan.title}
                  </p>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, color: 'var(--t3)' }}>
                    <span>Raised</span>
                    <strong style={{ color: 'var(--t1)' }}>
                      {formatMoneyShort(summary.campaign.raised_amount, summary.campaign.currency)}
                    </strong>
                  </div>
                  <ProgressBar value={summary.transparency.score} max={100} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--t4)' }}>
                    <span>{summary.publishedUpdateCount} updates</span>
                    <span>{summary.metricCount} metrics</span>
                    <span>{formatMoneyShort(summary.plan.total_budget_cents, summary.campaign.currency)} planned</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <AeoContent route="/impact" title="Impact reporting answers" />
    </>
  );
}
