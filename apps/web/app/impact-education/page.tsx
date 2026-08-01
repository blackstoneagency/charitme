import type { Metadata } from 'next';
import { PageBody, PageHero, Section, CardGrid, InfoCard, CtaBand } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Impact Education',
  description:
    'How charitable giving actually works — where your money goes, how to tell a well-run campaign from a risky one, and how impact is measured honestly.',
  alternates: { canonical: 'https://www.charitme.com/impact-education' },
};

const LESSONS = [
  {
    title: 'Where your money actually goes',
    body: 'A donation on CharitMe splits three ways: the campaign, the payment processor, and an optional tip you choose. There is no mandatory platform cut. The exact split is shown before you confirm, not after.',
  },
  {
    title: 'Why “% to programmes” is a weak signal',
    body: 'Overhead ratios are easy to game and punish organisations that invest in staff and systems. A charity spending 20% on operations may deliver far more than one spending 5% and achieving little. Ask what changed, not what percentage was spent.',
  },
  {
    title: 'Reading a campaign critically',
    body: 'Look for a specific goal with a breakdown, a real name and face, evidence attached, and updates posted after launch. Vagueness about what the money is for is the single most useful warning sign.',
  },
  {
    title: 'Restricted vs unrestricted giving',
    body: 'Money earmarked for one purpose cannot be moved when circumstances change. Unrestricted gifts are less satisfying to picture and usually more useful to the recipient.',
  },
  {
    title: 'Recurring beats one-off',
    body: 'A predictable $10 a month is worth more to an organisation than an unpredictable $120 once, because it can be planned against. Recurring donors also stay engaged far longer.',
  },
  {
    title: 'Tax deductibility is not automatic',
    body: 'Gifts to individuals are generally not tax deductible; gifts to verified nonprofits usually are. CharitMe marks verified nonprofit campaigns explicitly, and issues receipts for those gifts.',
  },
];

const MEASURING = [
  { title: 'Outputs', body: 'What was delivered — meals served, nights of shelter, treatments funded. Easy to count, and only the first step.' },
  { title: 'Outcomes', body: 'What changed for the people involved. Harder to measure, and the thing that actually matters.' },
  { title: 'Counterfactual', body: 'What would have happened anyway without the donation. The honest question, and the one most impact reporting avoids.' },
];

export default function ImpactEducationPage() {
  return (
    <PageBody>
      <PageHero
        eyebrow="LEARN"
        title="Impact education"
        lede="Giving well is a skill. This is what we think is worth understanding about where donations go, how to read a campaign, and what impact claims are actually worth."
      />

      <Section
        id="lessons"
        heading="Six things worth knowing"
        intro="Written for donors, but useful to anyone running a campaign too."
      >
        <CardGrid min={300}>
          {LESSONS.map((l) => (
            <InfoCard key={l.title} title={l.title} body={l.body} />
          ))}
        </CardGrid>
      </Section>

      <Section
        id="measuring"
        heading="How impact is measured"
        intro="Three levels, in increasing order of difficulty and decreasing order of how often you will see them reported."
      >
        <CardGrid min={260}>
          {MEASURING.map((m) => (
            <InfoCard key={m.title} title={m.title} body={m.body} />
          ))}
        </CardGrid>
      </Section>

      <Section
        id="on-this-site"
        heading="What we publish about ourselves"
        intro="We hold ourselves to the same standard this page asks of everyone else."
      >
        <CardGrid min={280}>
          <InfoCard
            title="Transparency reporting"
            body="Our fee model, payout timing, and how donations are handled are documented in full, including the parts that are unflattering."
            href="/transparency"
          />
          <InfoCard
            title="Trust & safety"
            body="How campaigns are reviewed, what gets a campaign removed, and how to report one that concerns you."
            href="/trust-safety"
          />
          <InfoCard
            title="Platform reports"
            body="Aggregate figures on what has been raised and where it went."
            href="/reports"
          />
        </CardGrid>
      </Section>

      <CtaBand
        heading="Put it into practice"
        body="Browse live campaigns and apply the questions on this page to a few of them."
        primary={{ label: 'Browse campaigns', href: '/campaigns' }}
        secondary={{ label: 'Explore causes', href: '/causes' }}
      />
    </PageBody>
  );
}
