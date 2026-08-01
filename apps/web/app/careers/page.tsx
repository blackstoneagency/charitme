import Link from 'next/link';
import type { Metadata } from 'next';
import { PageBody, PageHero, Section, CardGrid, InfoCard } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Careers',
  description:
    'Work at CharitMe — how we operate, what we look for, and how to get in touch when a role is not posted.',
  alternates: { canonical: 'https://www.charitme.com/careers' },
};

const VALUES = [
  {
    title: 'Measure before you claim',
    body: 'We do not ship a number we have not checked. Most of the bugs worth catching here have been a green check measuring the wrong thing, so we re-measure rather than trust a prior pass.',
  },
  {
    title: 'Say the unflattering part',
    body: 'Our transparency pages document the limits of what we verify, not only the strengths. The same applies internally: an honest “this is not working” is worth more than an optimistic status update.',
  },
  {
    title: 'Small teams, whole problems',
    body: 'People here own a problem end to end rather than a layer of it. That means fewer handoffs and considerably more context to hold.',
  },
  {
    title: 'Donor money is not ours',
    body: 'Every decision about fees, payouts, and holding periods starts from the fact that the money passing through belongs to someone else.',
  },
];

export default function CareersPage() {
  return (
    <PageBody>
      <PageHero
        eyebrow="CAREERS"
        title="Work at CharitMe"
        lede="We are a small team building fundraising infrastructure that people trust with money that is not theirs. That constraint shapes most of how we work."
      />

      <Section id="values" heading="How we operate" intro="Four things that genuinely determine day-to-day decisions here.">
        <CardGrid min={280}>
          {VALUES.map((v) => (
            <InfoCard key={v.title} title={v.title} body={v.body} />
          ))}
        </CardGrid>
      </Section>

      <Section id="openings" heading="Open roles">
        {/* No roles are listed because none are published. Inventing plausible
            openings on a careers page wastes candidates' time and is exactly the
            kind of unsupported claim this codebase forbids elsewhere. When roles
            open they will be listed here with real detail. */}
        <div
          style={{
            padding: '28px',
            background: 'var(--s2)',
            border: '1px solid var(--b1)',
            borderRadius: 'var(--rl)',
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--t1)' }}>
            No roles are currently posted
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--t3)', lineHeight: 1.6, marginTop: '8px', maxWidth: '620px' }}>
            We would rather say that plainly than list roles we are not actively hiring for.
            If you think you should be working here anyway, write to us — describe something
            you have built and why this problem interests you. We read those, and we have
            hired from them before roles were posted.
          </p>
          <p style={{ marginTop: '16px' }}>
            <Link href="/contact" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 700 }}>
              Get in touch →
            </Link>
          </p>
        </div>
      </Section>

      <Section id="more" heading="Learn more about us">
        <CardGrid min={250}>
          <InfoCard title="About CharitMe" body="Who we are and why the platform works the way it does." href="/about-us" />
          <InfoCard title="How it works" body="The product itself, end to end." href="/how-it-works" />
          <InfoCard title="Transparency" body="Our fee model and how donor money is handled." href="/transparency" />
          <InfoCard title="Security" body="How accounts, payments, and personal data are protected." href="/security" />
        </CardGrid>
      </Section>
    </PageBody>
  );
}
