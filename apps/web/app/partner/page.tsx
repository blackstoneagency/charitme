import Link from 'next/link';
import type { Metadata } from 'next';
import { PageBody, PageHero, Section, CardGrid, InfoCard, CtaBand } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Partner With Us',
  description:
    'Bring CharitMe to your community, company, or network — through nonprofit partnerships, corporate giving, community programmes, or the developer API.',
  alternates: { canonical: 'https://www.charitme.com/partner' },
};

const PARTNER_TYPES = [
  {
    title: 'Nonprofits & charities',
    body: 'Run your fundraising on CharitMe with verification, team access, tax receipting, and a nonprofit dashboard built for organisations rather than individuals.',
    href: '/for-nonprofits',
  },
  {
    title: 'Companies',
    body: 'Workplace giving, donation matching, and campaign sponsorship — set up so your employees can see the impact of what the company contributes.',
    href: '/corporate-partnerships',
  },
  {
    title: 'Community organisations',
    body: 'Schools, clubs, congregations, and mutual aid groups running recurring fundraisers with multiple organisers and shared payouts.',
    href: '/for-individuals',
  },
  {
    title: 'Developers & platforms',
    body: 'Embed campaigns, pull donation data, and build giving into your own product using the CharitMe API.',
    href: '/developers',
  },
];

const WHAT_YOU_GET = [
  { title: 'No mandatory platform fee', body: 'CharitMe takes no percentage of donations. Partners are not charged for the giving itself.' },
  { title: 'Verification and trust signals', body: 'Verified partners carry a visible badge, which measurably improves conversion.' },
  { title: 'Shared reporting', body: 'Aggregate reporting across every campaign your organisation runs, exportable for your own accounts.' },
  { title: 'Direct support', body: 'A named contact rather than a general queue, and help migrating existing campaigns.' },
];

const PROCESS = [
  { step: 'STEP 01', title: 'Tell us what you want to do', body: 'A short message describing your organisation and what you are trying to fund is enough to start.' },
  { step: 'STEP 02', title: 'Verification', body: 'We confirm your organisation is what it says it is. For registered charities this is usually quick; the full process is documented publicly.' },
  { step: 'STEP 03', title: 'Set-up and migration', body: 'We help configure payouts, team access, and any existing campaigns you want to bring across.' },
  { step: 'STEP 04', title: 'Launch', body: 'You go live with your own campaigns, dashboard, and reporting.' },
];

export default function PartnerPage() {
  return (
    <PageBody>
      <PageHero
        eyebrow="PARTNERSHIPS"
        title="Partner with CharitMe"
        lede="Whether you are a registered charity, a company running a giving programme, a community group, or a platform wanting to build giving into your product — there is a way to work together."
        actions={
          <>
            <Link href="/contact" className="cta-primary" style={{ display: 'inline-flex' }}>
              Get in touch
            </Link>
            <Link
              href="/verification"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 22px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}
            >
              How verification works
            </Link>
          </>
        }
      />

      <Section id="types" heading="Ways to partner" intro="Pick the one closest to your organisation — we will point you the right way if none fit exactly.">
        <CardGrid min={280}>
          {PARTNER_TYPES.map((p) => (
            <InfoCard key={p.title} title={p.title} body={p.body} href={p.href} />
          ))}
        </CardGrid>
      </Section>

      <Section id="benefits" heading="What partners get">
        <CardGrid min={250}>
          {WHAT_YOU_GET.map((w) => (
            <InfoCard key={w.title} title={w.title} body={w.body} />
          ))}
        </CardGrid>
      </Section>

      <Section id="process" heading="How it works" intro="Four steps. Most organisations are live within a couple of weeks.">
        <CardGrid min={260}>
          {PROCESS.map((p) => (
            <InfoCard key={p.step} step={p.step} title={p.title} body={p.body} />
          ))}
        </CardGrid>
      </Section>

      <CtaBand
        heading="Start a conversation"
        body="Tell us about your organisation and what you are trying to fund. We read every message."
        primary={{ label: 'Contact us', href: '/contact' }}
        secondary={{ label: 'For nonprofits', href: '/for-nonprofits' }}
      />
    </PageBody>
  );
}
