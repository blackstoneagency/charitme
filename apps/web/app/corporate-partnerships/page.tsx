import Link from 'next/link';
import type { Metadata } from 'next';
import { PageBody, PageHero, Section, CardGrid, InfoCard, CtaBand } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Corporate Partnerships',
  description:
    'Workplace giving, donation matching, and campaign sponsorship for companies — with reporting your finance team can actually use.',
  alternates: { canonical: 'https://www.charitme.com/corporate-partnerships' },
};

const PROGRAMMES = [
  {
    title: 'Donation matching',
    body: 'Match what your employees give, up to a cap you set. Matches are applied automatically at checkout, so employees see the doubled amount at the moment they give rather than months later.',
  },
  {
    title: 'Workplace giving',
    body: 'Payroll-linked recurring donations to causes your employees choose, with a single consolidated invoice to the company.',
  },
  {
    title: 'Campaign sponsorship',
    body: 'Back specific campaigns publicly. Your sponsorship appears on the campaign page and typically pulls in further giving from the fundraiser’s own network.',
  },
  {
    title: 'Employee volunteering',
    body: 'Surface volunteering opportunities to your staff and track hours contributed alongside money raised.',
  },
];

const WHY = [
  { title: 'No platform fee on matched funds', body: 'CharitMe takes no percentage. Your matching budget goes to campaigns, not to us.' },
  { title: 'Reporting finance can use', body: 'Exportable records of every match and payroll gift, reconciled and dated, rather than a marketing dashboard.' },
  { title: 'Employees choose the causes', body: 'Participation is consistently higher when staff pick the campaign rather than the company picking it for them.' },
  { title: 'Verified recipients', body: 'Matching can be restricted to verified nonprofits, so the company only matches tax-deductible giving.' },
];

const STEPS = [
  { step: 'STEP 01', title: 'Scope the programme', body: 'Decide the match ratio, annual cap, per-employee cap, and whether matching is restricted to verified nonprofits.' },
  { step: 'STEP 02', title: 'Verification & agreement', body: 'We verify the company and agree billing terms. Matching funds are invoiced rather than held on the platform.' },
  { step: 'STEP 03', title: 'Roll out to employees', body: 'Staff link their accounts and the match applies automatically to eligible donations.' },
  { step: 'STEP 04', title: 'Report and review', body: 'Quarterly reporting on participation, amounts matched, and where the money went.' },
];

export default function CorporatePartnershipsPage() {
  return (
    <PageBody>
      <PageHero
        eyebrow="FOR ORGANIZATIONS"
        title="Corporate partnerships"
        lede="Matching, workplace giving, and sponsorship — built so employees can see the impact of what the company contributes, and so your finance team gets records that reconcile."
        actions={
          <>
            <Link href="/contact" className="cta-primary" style={{ display: 'inline-flex' }}>
              Talk to us
            </Link>
            <Link
              href="/matching"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 22px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}
            >
              See matching programmes
            </Link>
          </>
        }
      />

      <Section id="programmes" heading="Programme types" intro="Most companies run two or three of these together.">
        <CardGrid min={280}>
          {PROGRAMMES.map((p) => (
            <InfoCard key={p.title} title={p.title} body={p.body} />
          ))}
        </CardGrid>
      </Section>

      <Section id="why" heading="Why run it here">
        <CardGrid min={250}>
          {WHY.map((w) => (
            <InfoCard key={w.title} title={w.title} body={w.body} />
          ))}
        </CardGrid>
      </Section>

      <Section id="steps" heading="Getting set up">
        <CardGrid min={260}>
          {STEPS.map((s) => (
            <InfoCard key={s.step} step={s.step} title={s.title} body={s.body} />
          ))}
        </CardGrid>
      </Section>

      <Section id="related" heading="Related">
        <CardGrid min={250}>
          <InfoCard title="Matching programmes" body="Browse the matching programmes currently running on the platform." href="/matching" />
          <InfoCard title="Sponsorship" body="Back individual campaigns publicly." href="/sponsor" />
          <InfoCard title="Verification" body="What we check before an organisation is verified." href="/verification" />
          <InfoCard title="All partnerships" body="Nonprofit, community, and developer partnerships." href="/partner" />
        </CardGrid>
      </Section>

      <CtaBand
        heading="Build your giving programme"
        body="Tell us your headcount and what you want to achieve, and we will come back with a concrete proposal."
        primary={{ label: 'Contact us', href: '/contact' }}
        secondary={{ label: 'Partner overview', href: '/partner' }}
      />
    </PageBody>
  );
}
