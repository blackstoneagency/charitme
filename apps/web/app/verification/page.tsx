import Link from 'next/link';
import type { Metadata } from 'next';
import { PageBody, PageHero, Section, CardGrid, InfoCard, CtaBand } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Verification Process',
  description:
    'How CharitMe verifies fundraisers and nonprofit organisations — what we check, what each badge means, and what verification does and does not guarantee.',
  alternates: { canonical: 'https://www.charitme.com/verification' },
};

const STAGES = [
  {
    step: 'STEP 01',
    title: 'Identity',
    body: 'Every fundraiser who receives a payout connects a Stripe account, which confirms their legal identity and bank details. This happens before any money can leave the platform, not after.',
  },
  {
    step: 'STEP 02',
    title: 'Organisation status',
    body: 'For charities we check registration against public registries and, where available, third-party company data. A campaign is only marked tax deductible once that check passes.',
  },
  {
    step: 'STEP 03',
    title: 'Campaign evidence',
    body: 'Fundraisers can attach supporting documents — medical letters, invoices, receipts, photos. Evidence is reviewed rather than simply displayed, and it raises the campaign trust score.',
  },
  {
    step: 'STEP 04',
    title: 'Ongoing monitoring',
    body: 'Verification is not a one-off. Campaigns are re-checked as they grow, when they are reported, and when their stated purpose changes materially.',
  },
];

const BADGES = [
  {
    title: 'Verified fundraiser',
    body: 'Identity confirmed and payouts enabled. It means we know who is receiving the money — not that we endorse the campaign.',
  },
  {
    title: 'Tax deductible',
    body: 'The recipient is a verified nonprofit, so donations are generally tax deductible and receive an official receipt. Consult your own tax advice for your situation.',
  },
  {
    title: 'Trust score',
    body: 'A 0–99 score computed from verification status, evidence attached, update frequency, and campaign history. Higher is more complete, not more deserving.',
  },
];

const LIMITS = [
  {
    title: 'What verification does not mean',
    body: 'It is not a guarantee that a campaign will succeed, that funds will be spent exactly as described, or that we endorse the cause. It confirms identity and, for nonprofits, registration.',
  },
  {
    title: 'What we cannot check',
    body: 'We cannot independently confirm every claim in a personal story. Where a claim is central and unverifiable, the campaign carries a lower trust score rather than a badge.',
  },
  {
    title: 'If something looks wrong',
    body: 'Report it. Reported campaigns are reviewed by a person, and we can pause payouts while a review is open.',
  },
];

export default function VerificationPage() {
  return (
    <PageBody>
      <PageHero
        eyebrow="TRUST"
        title="How verification works"
        lede="What we check before money moves, what each badge on a campaign actually means, and — just as importantly — what verification does not guarantee."
      />

      <Section id="stages" heading="The four checks" intro="In the order they happen.">
        <CardGrid min={280}>
          {STAGES.map((s) => (
            <InfoCard key={s.step} step={s.step} title={s.title} body={s.body} />
          ))}
        </CardGrid>
      </Section>

      <Section id="badges" heading="What each badge means" intro="Every signal on a campaign card corresponds to something specific.">
        <CardGrid min={270}>
          {BADGES.map((b) => (
            <InfoCard key={b.title} title={b.title} body={b.body} />
          ))}
        </CardGrid>
      </Section>

      <Section
        id="limits"
        heading="The honest limits"
        intro="A verification page that only lists strengths is not much use to someone deciding whether to give."
      >
        <CardGrid min={270}>
          {LIMITS.map((l) => (
            <InfoCard key={l.title} title={l.title} body={l.body} />
          ))}
        </CardGrid>
      </Section>

      <Section id="get-verified" heading="Getting verified">
        <p style={{ fontSize: '15px', color: 'var(--t3)', lineHeight: 1.65, maxWidth: '680px' }}>
          Individuals are verified by connecting Stripe from the campaign payout settings — it takes
          a few minutes. Organisations should start on the{' '}
          <Link href="/for-nonprofits" style={{ color: 'var(--green-text)', fontWeight: 650 }}>nonprofit page</Link>,
          which covers registration checks and team access, or contact us through{' '}
          <Link href="/partner" style={{ color: 'var(--green-text)', fontWeight: 650 }}>partnerships</Link>.
        </p>
      </Section>

      <CtaBand
        heading="Read the wider trust policy"
        body="How campaigns are reviewed, what gets one removed, and how to report a concern."
        primary={{ label: 'Trust & safety', href: '/trust-safety' }}
        secondary={{ label: 'Report a campaign', href: '/contact' }}
      />
    </PageBody>
  );
}
