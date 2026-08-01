import Link from 'next/link';
import type { Metadata } from 'next';
import { getHomeData } from '../../lib/home-data';
import { formatHomeCents, shortHomeCount, shouldShowPlatformMetrics } from '../../lib/home-utils';
import { PageBody, PageHero, Section, CardGrid, InfoCard, StatCard } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Press',
  description:
    'Press and media enquiries for CharitMe — who to contact, the facts you can quote, and where to get logo files.',
  alternates: { canonical: 'https://www.charitme.com/press' },
};

export const revalidate = 900;

// Design 77 is a press-release detail page: "CharitMe Launches New Community
// Impact Report", a downloadable press kit, and headline figures. **We have
// published no press releases**, and there is no press-kit file. Inventing a
// release would be fabricating a company announcement — the most clearly
// unacceptable thing on this whole design set.
//
// So this is the press page that is actually useful: who to contact, the figures
// a journalist can quote (counted live, not asserted), and honest statements of
// what we will and will not confirm.

const CONTACT_EMAIL = 'press@charitme.com';

const WHAT_WE_CAN_CONFIRM = [
  { title: 'Platform figures', body: 'Total raised, live campaigns, donations recorded, and average trust score — all counted from the production database. The numbers on this page are those figures.' },
  { title: 'How the fee model works', body: 'CharitMe charges organisers no mandatory platform fee. It is funded by an optional donor tip, always reducible to zero. Payment processing is charged at cost.' },
  { title: 'How verification works', body: 'What we check before money moves, and — importantly — what we do not and cannot check. Documented publicly.' },
];

const WHAT_WE_WILL_NOT = [
  { title: 'Individual campaign or donor details', body: 'We do not confirm who gave, how much, or discuss a specific campaign’s finances with press. Donors who chose anonymity stay anonymous.' },
  { title: 'Figures we cannot derive', body: 'We will not supply “lives changed”, “countries reached” or similar. Nothing in our data records them, and we would rather say so than estimate.' },
  { title: 'Comment on open investigations', body: 'While a Trust & Safety review is open we will not comment on it, including to confirm it exists.' },
];

export default async function PressPage() {
  let metrics: { raisedCents: number; campaigns: number; donations: number; trustAvg: number } | null = null;
  try {
    metrics = (await getHomeData({})).metrics;
  } catch {
    metrics = null;
  }
  // Same shared rule the homepage and /reports use, so the three cannot quote
  // different numbers. `getHomeData` coalesces failed reads to zeros, so a
  // try/catch alone cannot tell a broken load from a real zero.
  const measured = metrics !== null && shouldShowPlatformMetrics(metrics, true);
  const dash = '—';

  return (
    <PageBody>
      <PageHero
        eyebrow="PRESS"
        title="Press & media"
        lede="Who to contact, what we can confirm on the record, and where to get logo files."
        actions={
          <>
            <a href={`mailto:${CONTACT_EMAIL}`} className="cta-primary" style={{ display: 'inline-flex' }}>
              Email the press desk
            </a>
            <Link
              href="/brand-assets"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 22px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}
            >
              Brand assets
            </Link>
          </>
        }
      />

      <Section
        id="figures"
        heading="Figures you can quote"
        intro={
          measured
            ? 'Counted from the production database, refreshed at most every fifteen minutes. These are the same numbers our own reports page publishes.'
            : 'These figures are temporarily unavailable. A dash means we could not measure the value — it does not mean the value is zero.'
        }
      >
        <CardGrid min={200}>
          <StatCard value={measured ? formatHomeCents(metrics!.raisedCents) : dash} label="Raised on CharitMe" />
          <StatCard value={measured ? metrics!.campaigns.toLocaleString() : dash} label="Live campaigns" />
          <StatCard value={measured ? shortHomeCount(metrics!.donations) : dash} label="Donations recorded" />
          <StatCard value={measured && metrics!.trustAvg > 0 ? `${metrics!.trustAvg}%` : dash} label="Average trust score" />
        </CardGrid>
        <p style={{ fontSize: '13px', color: 'var(--t4)', marginTop: '14px', maxWidth: '680px', lineHeight: 1.6 }}>
          Methodology is documented on the{' '}
          <Link href="/reports" style={{ color: 'var(--green-text)', fontWeight: 650 }}>reports page</Link>. If you need a
          figure that is not here, ask — we will supply it if we can derive it, and say so plainly if
          we cannot.
        </p>
      </Section>

      <Section id="confirm" heading="What we can confirm on the record">
        <CardGrid min={270}>
          {WHAT_WE_CAN_CONFIRM.map((w) => <InfoCard key={w.title} title={w.title} body={w.body} />)}
        </CardGrid>
      </Section>

      <Section id="will-not" heading="What we will not">
        <CardGrid min={270}>
          {WHAT_WE_WILL_NOT.map((w) => <InfoCard key={w.title} title={w.title} body={w.body} />)}
        </CardGrid>
      </Section>

      <Section id="releases" heading="Press releases">
        <div style={{ padding: '24px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s2)', maxWidth: '700px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--t1)' }}>
            We have not issued any press releases
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--t3)', lineHeight: 1.65, marginTop: '8px' }}>
            There is no archive to list and no press kit to download, so this page does not pretend
            otherwise. When we publish something, it will appear here with a date. In the meantime
            the{' '}
            <Link href="/transparency" style={{ color: 'var(--green-text)', fontWeight: 650 }}>transparency centre</Link>{' '}
            and{' '}
            <Link href="/reports" style={{ color: 'var(--green-text)', fontWeight: 650 }}>reports</Link>{' '}
            are the substantive documents about how CharitMe operates.
          </p>
          <p style={{ fontSize: '14px', color: 'var(--t3)', lineHeight: 1.65, marginTop: '12px' }}>
            Media enquiries:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--green-text)', fontWeight: 700 }}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      </Section>

      <Section id="background" heading="Background reading">
        <CardGrid min={250}>
          <InfoCard title="About CharitMe" body="Who we are and why the platform works the way it does." href="/about-us" />
          <InfoCard title="Transparency centre" body="Fee model, payout handling, and data practices." href="/transparency" />
          <InfoCard title="Trust & safety" body="How campaigns are reviewed and removed." href="/trust-safety" />
          <InfoCard title="Brand assets" body="Logo files, colours, and usage rules." href="/brand-assets" />
        </CardGrid>
      </Section>
    </PageBody>
  );
}
