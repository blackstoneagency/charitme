import Link from 'next/link';
import type { Metadata } from 'next';
import { BLOG_POSTS } from '../../lib/blog-posts';
import { PageBody, PageHero, Section, CardGrid, InfoCard, CtaBand } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Resources',
  description:
    'Guides, research, and reference for fundraisers and donors — the fundraising playbook, impact education, the glossary, and platform reports.',
  alternates: { canonical: 'https://www.charitme.com/resources' },
};

// Every card here points at a page that EXISTS. The design shows a guide detail
// view with star ratings, page counts and PDF downloads ("4.8 (108 reviews) ·
// PDF · 21 pages"); none of that is backed by anything — there is no ratings
// table, no PDF pipeline, and no page count. Rendering those would be the same
// fabricated-statistic problem as the mockup's "120+ countries".
//
// So this is an index over real guidance, with real recency where we have it.

const LEARN = [
  { title: 'Fundraising guide', body: 'The six steps to a funded campaign, in the order you actually take them — plus what goes wrong most often.', href: '/fundraising-guide' },
  { title: 'Impact education', body: 'How giving works, why “% to programmes” is a weak signal, and how to read a campaign critically.', href: '/impact-education' },
  { title: 'Glossary', body: 'Fundraising terms defined as they work on CharitMe, not in the abstract.', href: '/glossary' },
  { title: 'How it works', body: 'The product end to end, for fundraisers and donors.', href: '/how-it-works' },
];

const DATA = [
  { title: 'Reports & research', body: 'Platform figures read live from the database, and how each one is produced.', href: '/reports' },
  { title: 'Impact map', body: 'Where campaigns are running and what they fund, counted by place and cause.', href: '/impact-map' },
  { title: 'Transparency centre', body: 'Our fee model, how donor money is handled, and the parts that are unflattering.', href: '/transparency' },
  { title: 'Fees, in full', body: 'Every charge a donor or fundraiser can encounter, by payment method.', href: '/fees' },
];

const TRUST = [
  { title: 'Verification process', body: 'What we check before money moves — and what we cannot check.', href: '/verification' },
  { title: 'Trust & safety', body: 'How campaigns are reviewed and what gets one removed.', href: '/trust-safety' },
  { title: 'Security', body: 'How accounts, payments, and personal data are protected.', href: '/security' },
  { title: 'Supported countries', body: 'Where CharitMe can accept donations and pay out.', href: '/supported-countries' },
];

const FOR_ORGS = [
  { title: 'For nonprofits', body: 'Verification, team access, tax receipting, and an organisation dashboard.', href: '/for-nonprofits' },
  { title: 'Corporate partnerships', body: 'Matching, workplace giving, and campaign sponsorship.', href: '/corporate-partnerships' },
  { title: 'Grants', body: 'Funding opportunities and AI-assisted applications.', href: '/grants' },
  { title: 'Developers & API', body: 'Embed campaigns and build giving into your own product.', href: '/developers' },
];

// Latest posts come from `lib/blog-posts.ts`, the SAME module /blog renders.
// A first draft queried a `blog_posts` table — which does not exist. The catch
// would have swallowed the error and rendered nothing, so the section would have
// been permanently, silently absent. Reading the real source means this cannot
// drift from /blog either.
const LATEST_POSTS = [...BLOG_POSTS]
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  .slice(0, 3);

export default function ResourcesPage() {
  return (
    <PageBody>
      <PageHero
        eyebrow="RESOURCES"
        title="Everything worth reading first"
        lede="Guides for running a campaign, reference for understanding where money goes, and the documents that explain how CharitMe operates."
        actions={
          <>
            <Link href="/fundraising-guide" className="kind-start-pill" style={{ display: 'inline-flex' }}>
              Start with the guide
            </Link>
            <Link
              href="/blog"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 22px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}
            >
              Read the blog
            </Link>
          </>
        }
      />

      <Section id="learn" heading="Learn" intro="Start here if you are running a campaign or deciding where to give.">
        <CardGrid min={260}>
          {LEARN.map((r) => <InfoCard key={r.href} title={r.title} body={r.body} href={r.href} />)}
        </CardGrid>
      </Section>

      <Section id="data" heading="Data & transparency" intro="What we publish about ourselves, and how each figure is produced.">
        <CardGrid min={260}>
          {DATA.map((r) => <InfoCard key={r.href} title={r.title} body={r.body} href={r.href} />)}
        </CardGrid>
      </Section>

      <Section id="trust" heading="Trust & safety" intro="What we verify, what we cannot, and how to report a concern.">
        <CardGrid min={260}>
          {TRUST.map((r) => <InfoCard key={r.href} title={r.title} body={r.body} href={r.href} />)}
        </CardGrid>
      </Section>

      <Section id="orgs" heading="For organisations">
        <CardGrid min={260}>
          {FOR_ORGS.map((r) => <InfoCard key={r.href} title={r.title} body={r.body} href={r.href} />)}
        </CardGrid>
      </Section>

      {/* Rendered only when there are posts. An empty "Latest from the blog"
          heading would suggest we had stopped publishing. */}
      {LATEST_POSTS.length > 0 && (
        <Section id="blog" heading="Latest from the blog">
          <CardGrid min={260}>
            {LATEST_POSTS.map((p) => (
              <InfoCard
                key={p.slug}
                title={p.title}
                body={p.excerpt}
                href={`/blog/${p.slug}`}
              />
            ))}
          </CardGrid>
        </Section>
      )}

      <CtaBand
        heading="Still have a question?"
        body="The help centre covers the questions we get most, and a person answers the rest."
        primary={{ label: 'Help centre', href: '/help' }}
        secondary={{ label: 'Contact us', href: '/contact' }}
      />
    </PageBody>
  );
}
