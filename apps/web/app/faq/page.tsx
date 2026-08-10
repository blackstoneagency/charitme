import Link from 'next/link';
import type { Metadata } from 'next';
import { safeJsonLd } from '../../lib/json-ld';
import { getPublishedFaqs, groupFaqsByTopic } from '../../lib/aeo';
import { CURATED_FAQ_SECTIONS } from '../../lib/faq-content';
import JsonLd from '../../components/JsonLd';
import { PublicIcon } from '../../components/PublicIcon';
import { IndexHero, StatStrip } from '../../components/IndexHero';
import { getCoverForCategory } from '../../lib/photo-catalog';
import { SUGGESTED_SUPPORT_COPY } from '../../lib/fee-copy';
import FaqAccordion from './FaqAccordion';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers to the most common questions about CharitMe — fees, payouts, AI tools, trust scores, and donor safety.',
  alternates: { canonical: 'https://www.charitme.com/faq' },
};

// Refresh every 5 minutes to pick up newly-published AEO answers.
export const revalidate = 300;

/**
 * The four quick answers above the sections.
 *
 * Product facts, not measurements: the platform fee is 0 because
 * PLATFORM_FEE_PERCENT is 0, standard payouts are free, and every campaign gets
 * a trust score. Each links to the page that proves it, so none is a bare claim.
 */
const QUICK_ANSWERS = [
  { value: '0%', label: 'Platform fee', href: '/fees' },
  { value: 'Optional', label: `Donor tip — suggested ${SUGGESTED_SUPPORT_COPY}, editable to $0`, href: '/fees' },
  { value: 'Free', label: 'Standard payouts, always', href: '/fast-payouts' },
  { value: 'Every campaign', label: 'Gets a trust score', href: '/verification' },
] as const;

export default async function FaqPage() {
  // Admin-managed answer-engine entries. Seeder placeholders are filtered out in
  // lib/aeo.ts — all 180 published `/faq` rows in production are generated, so
  // this is empty today and the curated sections carry the page.
  const aeoFaqs = await getPublishedFaqs('FAQPage');
  const aeoSections = groupFaqsByTopic(aeoFaqs);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      ...CURATED_FAQ_SECTIONS.flatMap((section) => section.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      }))),
      // Every entry here is also rendered visibly below, so the schema can never
      // describe content a visitor cannot find on the page.
      ...aeoFaqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    ],
  };

  return (
    <div className="fq-page">
      <JsonLd json={safeJsonLd(jsonLd)} />

      <IndexHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'FAQ' }]}
        title="Frequently asked questions"
        lede="Clear answers before you start — fees, payouts, trust scores, verification, AI tools and donor safety."
        photo={getCoverForCategory('Community', 'faq-hero')}
        photoCategory="Community"
        photoKey="faq"
        actions={<Link href="/contact" className="cx-btn-secondary">Contact support</Link>}
      />

      <div className="container fq-main">
        <section className="fq-quick" aria-labelledby="fq-quick-h">
          <h2 id="fq-quick-h" className="fq-h2">The short version</h2>
          <StatStrip
            label="Quick answers"
            tiles={QUICK_ANSWERS.map((a) => ({ value: a.value, label: a.label }))}
          />
          <p className="fq-quick-note">
            The full breakdown lives on <Link href="/fees">fees and pricing</Link> and{' '}
            <Link href="/fast-payouts">payouts</Link>.
          </p>
        </section>

        {/* The curated answers. Each topic keeps its own anchor, because other
            pages link straight to #payouts and #donors. */}
        {CURATED_FAQ_SECTIONS.map((section) => (
          <FaqAccordion
            key={section.title}
            id={section.id}
            title={section.title}
            items={section.items.map((item) => ({ question: item.q, answer: item.a }))}
          />
        ))}

        {/* Admin-published entries, when any genuine ones exist. Renders nothing
            otherwise — an empty "More answers" heading is worse than no heading. */}
        {aeoSections.map((section) => (
          <FaqAccordion
            key={section.topic}
            title={section.topic}
            items={section.items.map((item) => ({ question: item.question, answer: item.answer }))}
          />
        ))}

        <section className="fq-cta" aria-labelledby="fq-cta-h">
          <span className="fq-cta-ic" aria-hidden="true"><PublicIcon name="heart" /></span>
          <div>
            <h2 id="fq-cta-h">Still have questions?</h2>
            <p>Our team helps with fundraising, nonprofit onboarding, enterprise giving and trust reviews.</p>
          </div>
          <div className="fq-cta-actions">
            <Link href="/contact" className="cx-btn-secondary fq-cta-secondary">Contact support</Link>
            <Link href="/create/choose-path" className="cta-primary" style={{ display: 'inline-flex' }}>
              Start a campaign
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
