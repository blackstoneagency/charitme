import Link from 'next/link';
import type { Metadata } from 'next';
import { PageBody, PageHero, Section, CardGrid, InfoCard } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Internships',
  description:
    'Internships at CharitMe — what we look for, what an internship here actually involves, and how to get in touch.',
  alternates: { canonical: 'https://www.charitme.com/internships' },
};

const TRACKS = [
  {
    title: 'Hands-on experience',
    body: 'Interns here own a piece of real work that ships, not a side project that gets archived. If your change reaches production, your name is on the commit.',
  },
  {
    title: 'Mentorship',
    body: 'You are paired with someone who reviews your work properly — the kind of review that explains why, not just what to change.',
  },
  {
    title: 'Create impact',
    body: 'Everything on this platform moves money that belongs to someone else. That constraint makes it a genuinely good place to learn how to build carefully.',
  },
];

const WHAT_WE_LOOK_FOR = [
  { title: 'Evidence you have built something', body: 'A repo, a project, a thing you shipped. It does not need to be impressive — it needs to be yours and you need to be able to explain the decisions in it.' },
  { title: 'Comfort saying “I do not know”', body: 'Most of the bugs worth catching here were found by someone re-checking an assumption rather than defending it.' },
  { title: 'Care about the details', body: 'A number on a fundraising page is a claim about someone else’s money. We take that seriously and expect the same.' },
];

export default function InternshipsPage() {
  return (
    <PageBody>
      <PageHero
        eyebrow="INTERNSHIPS"
        title="Start your career making an impact"
        lede="Internships at CharitMe are real work on a live platform, reviewed properly, with your name on what ships."
      />

      <Section id="tracks" heading="What an internship here involves">
        <CardGrid min={270}>
          {TRACKS.map((t) => <InfoCard key={t.title} title={t.title} body={t.body} />)}
        </CardGrid>
      </Section>

      <Section id="looking-for" heading="What we look for">
        <CardGrid min={270}>
          {WHAT_WE_LOOK_FOR.map((w) => <InfoCard key={w.title} title={w.title} body={w.body} />)}
        </CardGrid>
      </Section>

      <Section id="open" heading="Open internships">
        {/* No positions are listed because none are open. The design shows an
            "Explore Internship Opportunities" button against a populated list;
            inventing plausible openings would waste applicants' time, which is
            the same reason /careers lists none. */}
        <div style={{ padding: '26px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', maxWidth: '680px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--t1)' }}>
            No internships are currently open
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--t3)', lineHeight: 1.6, marginTop: '8px' }}>
            We would rather say so than list positions we are not actively filling. Write to us
            anyway — describe something you have built and why this problem interests you. Those
            messages get read, and they have led to offers before a posting existed.
          </p>
          <p style={{ marginTop: '16px' }}>
            <Link href="/contact" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 700 }}>
              Get in touch →
            </Link>
          </p>
        </div>
      </Section>

      <Section id="more" heading="Also worth reading">
        <CardGrid min={250}>
          <InfoCard title="Careers" body="Full-time roles and how we operate day to day." href="/careers" />
          <InfoCard title="About CharitMe" body="Who we are and why the platform works the way it does." href="/about-us" />
          <InfoCard title="Volunteer instead" body="If you want to contribute time rather than join the team." href="/volunteer" />
          <InfoCard title="How it works" body="The product itself, end to end." href="/how-it-works" />
        </CardGrid>
      </Section>
    </PageBody>
  );
}
