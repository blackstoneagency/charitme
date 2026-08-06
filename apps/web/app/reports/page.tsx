import Link from 'next/link';
import type { Metadata } from 'next';
import { getHomeData } from '../../lib/home-data';
import { formatHomeCents, shortHomeCount, shouldShowPlatformMetrics } from '../../lib/home-utils';
import { PageBody, PageHero, Section, CardGrid, InfoCard, StatCard, CtaBand } from '../../components/PageShell';
import PublishedReports from './PublishedReports';

export const metadata: Metadata = {
  title: 'Reports & Research',
  description:
    'Platform figures, transparency reporting, and what we publish about how CharitMe operates — including the parts that are unflattering.',
  alternates: { canonical: 'https://www.charitme.com/reports' },
};

export const revalidate = 900;

const METHODOLOGY = [
  {
    title: 'What the figures count',
    body: 'Total raised counts completed donations only — not pledges, not pending payments, and not refunded gifts. Campaign counts are live campaigns visible to the public.',
  },
  {
    title: 'When they were measured',
    body: 'These figures are read directly from the production database and refreshed at most every fifteen minutes. They are not manually curated, and nothing is rounded up.',
  },
  {
    title: 'What we do not publish',
    body: 'We do not publish per-campaign donor identities, individual donation amounts tied to a person, or any figure we cannot derive from the database. Where a number is unavailable, this page shows a dash rather than a zero.',
  },
];

export default async function ReportsPage() {
  // The same loader the homepage uses, so the two cannot disagree about what the
  // platform has raised. `getHomeData` coalesces failed reads to zeros rather
  // than throwing, which is why the guard below exists.
  let metrics: { raisedCents: number; campaigns: number; donations: number; trustAvg: number } | null = null;
  try {
    metrics = (await getHomeData({})).metrics;
  } catch {
    metrics = null;
  }

  // `shouldShowPlatformMetrics` is the shared rule, not a local judgement call.
  // A failed load returns an all-zero metrics object that is indistinguishable
  // from real zeros at the call site — trusting the try/catch alone is exactly
  // how "Raised on CharitMe $0" reached the homepage of a credential-less
  // build. On a page whose whole subject is honest reporting, publishing a
  // fabricated zero would be the worst possible bug.
  const measured = metrics !== null && shouldShowPlatformMetrics(metrics, true);
  const dash = '—';

  return (
    <PageBody>
      <PageHero
        eyebrow="REPORTS & RESEARCH"
        title="What the numbers say"
        lede="Aggregate figures for the whole platform, read live from the production database, plus the transparency documents that explain how CharitMe actually operates."
      />

      <Section
        id="platform-figures"
        heading="Platform figures"
        intro={
          measured
            ? 'Read from the production database within the last fifteen minutes.'
            : 'These figures are temporarily unavailable. A dash means we could not measure the value — it does not mean the value is zero.'
        }
      >
        <CardGrid min={200}>
          <StatCard value={measured ? formatHomeCents(metrics!.raisedCents) : dash} label="Raised on CharitMe" />
          <StatCard value={measured ? metrics!.campaigns.toLocaleString() : dash} label="Live campaigns" />
          <StatCard value={measured ? shortHomeCount(metrics!.donations) : dash} label="Donations recorded" />
          {/* An average can legitimately be 0 while data exists, so it is gated
              on the same `measured` flag rather than on its own value. */}
          <StatCard value={measured && metrics!.trustAvg > 0 ? `${metrics!.trustAvg}%` : dash} label="Average trust score" />
        </CardGrid>
      </Section>

      {/* Renders nothing until the platform_reports migration is applied and a
          report is published — a "Reports" heading over an empty list would
          state that the organisation publishes none. */}
      <PublishedReports />

      <Section id="methodology" heading="How these figures are produced" >
        <CardGrid min={280}>
          {METHODOLOGY.map((m) => (
            <InfoCard key={m.title} title={m.title} body={m.body} />
          ))}
        </CardGrid>
      </Section>

      <Section
        id="documents"
        heading="Transparency documents"
        intro="The standing reports on how the platform is run. These are maintained pages rather than dated PDFs, so they reflect current practice."
      >
        <CardGrid min={270}>
          <InfoCard
            title="Transparency report"
            body="Our fee model, how donor money is held and moved, and what we do with data."
            href="/transparency"
          />
          <InfoCard
            title="Trust & safety"
            body="How campaigns are reviewed, what gets one removed, and how to report a concern."
            href="/trust-safety"
          />
          <InfoCard
            title="Fees, in full"
            body="Every charge a donor or fundraiser can encounter, including processing rates by payment method."
            href="/fees"
          />
          <InfoCard
            title="Security"
            body="How accounts, payments, and personal data are protected."
            href="/security"
          />
          <InfoCard
            title="Supported countries"
            body="Where CharitMe can currently accept donations and pay out."
            href="/supported-countries"
          />
          <InfoCard
            title="Impact education"
            body="How to read impact claims critically — including ours."
            href="/impact-education"
          />
        </CardGrid>
      </Section>

      <Section
        id="requests"
        heading="Requesting data"
        intro="Researchers, journalists, and partner organisations can request aggregate data we do not publish here."
      >
        <p style={{ fontSize: '15px', color: 'var(--t3)', lineHeight: 1.65, maxWidth: '680px' }}>
          We will share aggregate, de-identified figures where doing so does not risk
          identifying an individual donor or fundraiser. We do not share personal data.
          Get in touch through the{' '}
          <Link href="/contact" style={{ color: 'var(--green-text)', fontWeight: 650 }}>contact page</Link>{' '}
          and describe what you are trying to measure.
        </p>
      </Section>

      <CtaBand
        heading="See it at campaign level"
        body="Every campaign has its own transparency ledger showing what was raised and what it went to."
        primary={{ label: 'Browse campaigns', href: '/campaigns' }}
        secondary={{ label: 'Read the transparency report', href: '/transparency' }}
      />
    </PageBody>
  );
}
