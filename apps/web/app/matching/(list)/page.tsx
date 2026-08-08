import type { Metadata } from 'next';
import Link from 'next/link';
import { formatMoneyShort } from '@shared/currencies';
import {
  ReferenceCta,
  ReferenceHero,
  ReferenceIconGrid,
  ReferencePage,
  ReferenceSection,
  ReferenceSteps,
} from '../../../components/ReferenceMarketing';
import { PublicIcon } from '../../../components/PublicIcon';
import { listActivePrograms } from '../../../lib/matching';

export const metadata: Metadata = {
  title: 'Matching Gifts — Double Your Donation at No Extra Cost',
  description:
    'Search live employer matching-gift programs on CharitMe, submit a claim, and multiply the impact of an eligible charitable donation.',
  alternates: { canonical: 'https://www.charitme.com/matching' },
  openGraph: {
    title: 'Double Your Impact With Matching Gifts',
    description: 'Find out whether your employer will match your CharitMe donation.',
    url: 'https://www.charitme.com/matching',
    images: [{ url: '/images/reference/matching-gifts-hero.webp' }],
    type: 'website',
  },
};

export const dynamic = 'force-dynamic';

const STEPS = [
  { icon: 'search', title: 'Check Eligibility', body: 'Search for your employer to see whether they offer a matching-gift program.' },
  { icon: 'dollar', title: 'Make Your Donation', body: 'Donate to a qualifying campaign or organization on CharitMe.' },
  { icon: 'edit', title: 'Submit a Request', body: 'Follow your employer’s instructions and submit your matching request.' },
  { icon: 'people', title: 'Employer Reviews', body: 'Your employer verifies your donation and approves the match.' },
  { icon: 'heart', title: 'Double the Impact', body: 'Your employer makes a matching donation to multiply your impact.' },
];

const BENEFITS = [
  { icon: 'people', title: 'More Impact', body: 'Your donation can help twice as many people.' },
  { icon: 'dollar', title: 'No Extra Cost', body: 'Your employer provides the match at no cost to you.' },
  { icon: 'shield', title: 'Stronger Communities', body: 'Together, we can create lasting change.' },
];

const FAQS = [
  ['What is a matching gift?', 'A matching gift is a charitable contribution an employer makes after an eligible employee donates. Program ratios, limits, and eligible causes are set by each employer.'],
  ['How do I submit a matching gift request?', 'Choose your employer below, open its program, and follow the claim instructions. You will need an eligible CharitMe donation and may need to provide your receipt.'],
  ['How long does a matching gift take?', 'Review timing depends on the employer. Your claim page shows its current status from submission through approval and payment.'],
] as const;

type MatchingSearchParams = Promise<{ q?: string | string[] }>;

export default async function MatchingPage({ searchParams }: { searchParams: MatchingSearchParams }) {
  const rawQuery = (await searchParams).q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim().slice(0, 100) ?? '';
  const programs = await listActivePrograms(query || undefined).catch(() => []);

  return (
    <ReferencePage className="rr-page">
      <ReferenceHero
        crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Resources', href: '/resources' },
          { label: 'Corporate Partnerships', href: '/corporate-partnerships' },
          { label: 'Matching Gifts' },
        ]}
        eyebrow="Matching Gifts"
        title={<>Double Your Impact<br /><span className="rp-accent">at No Extra Cost</span></>}
        lede="Many companies match donations made by their employees. Find out whether your employer participates and increase the impact of your gift today."
        actions={[
          { label: 'See if Your Employer Matches', href: '#employer-search' },
          { label: 'How Matching Gifts Work', href: '#how-it-works', variant: 'secondary' },
        ]}
        highlights={[
          { icon: 'shield', title: 'Secure. Easy. 100% Free.', body: 'We guide you every step of the way.' },
        ]}
        image="/images/reference/matching-gifts-hero.webp"
        imageAlt="Two people holding a red heart together"
        callout={{
          icon: 'gift',
          title: 'Your gift can go twice as far.',
          body: 'Matching gifts help more people, strengthen communities, and create lasting change.',
        }}
      />

      <div className="rr-band rr-band-light">
        <ReferenceSection title="How Matching Gifts Work" compact>
          <div id="how-it-works"><ReferenceSteps items={STEPS} /></div>
        </ReferenceSection>

        <ReferenceSection title="See if Your Employer Matches" intro="Search the active employer programs in CharitMe to get started." compact>
          <div id="employer-search" className="rr-employer-panel">
            <form action="/matching" method="get" role="search" className="rr-employer-search">
              <label htmlFor="matching-company">Company name</label>
              <div>
                <input id="matching-company" name="q" type="search" defaultValue={query} placeholder="Search company name…" />
                <button type="submit"><PublicIcon name="search" />Search</button>
              </div>
              <small>Search results come directly from active matching programs.</small>
            </form>

            <div className="rr-program-list" aria-live="polite">
              <div className="rr-program-head">
                <h3>{query ? `Results for “${query}”` : 'Active Matching Gift Companies'}</h3>
                {query && <Link href="/matching">Clear search</Link>}
              </div>
              {programs.length === 0 ? (
                <div className="rr-program-empty">
                  <PublicIcon name="briefcase" />
                  <div><strong>No active program found</strong><span>Ask your employer to launch a matching program with CharitMe.</span></div>
                  <Link href="/matching/manage">Launch a program</Link>
                </div>
              ) : (
                <div className="rr-program-grid">
                  {programs.map((program) => (
                    <Link key={program.id} href={`/matching/${program.id}`} className="rr-program-card">
                      <span className="rp-icon rp-icon-sm"><PublicIcon name="gift" /></span>
                      <div>
                        <strong>{program.company_name}</strong>
                        <small>
                          {program.match_ratio}:1 match
                          {program.annual_cap_cents > 0 ? ` · Up to ${formatMoneyShort(program.annual_cap_cents, program.currency)}/year` : ' · No published annual cap'}
                        </small>
                      </div>
                      <PublicIcon name="arrow" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ReferenceSection>

        <section className="rr-impact-band" aria-label="Matching gift impact">
          <div><span className="rp-icon rp-icon-lg"><PublicIcon name="chart" /></span><p><strong>The Power of Matching Gifts</strong><small>Matching gifts significantly increase charitable impact.</small></p></div>
          <dl>
            <div><dd>$4–$7B</dd><dt>Estimated matching gifts available annually</dt></div>
            <div><dd>26M+</dd><dt>Donations are matched each year</dt></div>
            <div><dd>65%</dd><dt>Of eligible donors do not know their gifts can be matched</dt></div>
          </dl>
        </section>

        <ReferenceSection title="Why It Matters" compact>
          <div className="rr-help-grid">
            <div className="rr-benefit-panel"><ReferenceIconGrid items={BENEFITS} columns={4} /></div>
            <div className="rr-help-panel">
              <span className="rp-icon rp-icon-lg"><PublicIcon name="help" /></span>
              <div><h3>Questions? We’re Here to Help.</h3><p>Our team can help you navigate the matching-gift process and maximize your impact.</p><Link href="/help">Visit Help Center <PublicIcon name="arrow" /></Link></div>
            </div>
          </div>
        </ReferenceSection>

        <ReferenceSection title="Frequently Asked Questions" compact>
          <div className="rr-faq-list">
            {FAQS.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
          </div>
        </ReferenceSection>

        <ReferenceCta
          icon="hand"
          title="Double Your Impact Today"
          body="It only takes a minute to see whether your employer will match your gift."
          actions={[
            { label: 'Find My Employer', href: '#employer-search' },
            { label: 'Learn More', href: '/help', variant: 'secondary' },
          ]}
        />
      </div>
    </ReferencePage>
  );
}
