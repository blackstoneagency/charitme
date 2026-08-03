import type { Metadata } from 'next';
import { PageBody, PageHero, Section, CardGrid, InfoCard } from '../../components/PageShell';
import InternshipListings from './InternshipListings';

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

export default async function InternshipsPage() {
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

      {/* Live listings from `volunteer_opportunities`, filtered to the
          internship categories. Previously this section was hardcoded to "none
          open" — the right ANSWER, but not a measured one, so a real posting
          entered through the volunteer admin would never have appeared here. */}
      {/* Not wrapped in <Section>: InternshipListings supplies its own
          landmark and <h2>. A Section with an empty heading would render an
          empty <h2> and an aria-labelledby pointing at nothing. */}
      <div style={{ marginBottom: 52 }}>
        <InternshipListings />
      </div>

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
