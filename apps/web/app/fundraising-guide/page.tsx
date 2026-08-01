import Link from 'next/link';
import type { Metadata } from 'next';
import { PageBody, PageHero, Section, CardGrid, InfoCard, CtaBand } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Fundraising Guide',
  description:
    'A step-by-step guide to running a successful fundraiser on CharitMe — writing your story, setting a goal, sharing it, and keeping donors engaged.',
  alternates: { canonical: 'https://www.charitme.com/fundraising-guide' },
};

const STEPS = [
  {
    step: 'STEP 01',
    title: 'Set a goal you can explain',
    body: 'Work out what you actually need and add the processing fee on top. A goal you can break down line by line — “$2,400 covers eight weeks of treatment” — raises more than a round number, because donors can see what their gift does.',
  },
  {
    step: 'STEP 02',
    title: 'Write the story only you can tell',
    body: 'Open with the person, not the problem. Say who this is for, what happened, and what changes if it is funded. Two hundred honest words beat a thousand polished ones. The AI Copilot can turn rough notes into a first draft you then make yours.',
  },
  {
    step: 'STEP 03',
    title: 'Add proof before you share',
    body: 'Connect Stripe to verify your identity, and upload whatever evidence you have — receipts, letters, photos. Every signal you add raises your trust score, and campaigns with a visible trust score convert markedly better than ones without.',
  },
  {
    step: 'STEP 04',
    title: 'Share with your closest circle first',
    body: 'Do not start with a public post. Message twenty people directly and ask them personally. Early donations make a campaign look alive, and a page with momentum is far easier to share than an empty one.',
  },
  {
    step: 'STEP 05',
    title: 'Post updates while it is running',
    body: 'An update every few days keeps a campaign in people’s feeds and gives past donors a reason to share it again. Say what has changed, what the money has covered, and what is still needed.',
  },
  {
    step: 'STEP 06',
    title: 'Close the loop when it ends',
    body: 'Thank every donor and show them the outcome. This is the step most people skip, and it is the one that decides whether those donors give again next time.',
  },
];

const MISTAKES = [
  { title: 'A goal with no breakdown', body: 'A bare number reads as a guess. Show the arithmetic.' },
  { title: 'No cover photo', body: 'A real photo of the person or project outperforms stock imagery every time.' },
  { title: 'Sharing once and stopping', body: 'Most campaigns fail from silence, not rejection. Keep posting.' },
  { title: 'Waiting to be perfect', body: 'A live campaign you improve beats a draft you never publish.' },
];

export default function FundraisingGuidePage() {
  return (
    <PageBody>
      <PageHero
        eyebrow="LEARN"
        title="The fundraising guide"
        lede="Everything we have learned about what makes a campaign work — written as the six steps you actually take, in the order you take them."
        actions={
          <>
            <Link href="/create" className="kind-start-pill" style={{ display: 'inline-flex' }}>
              Start a fundraiser
            </Link>
            <Link
              href="/campaigns"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 22px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}
            >
              See live campaigns
            </Link>
          </>
        }
      />

      <Section
        id="steps"
        heading="Six steps to a funded campaign"
        intro="In order. Most campaigns that stall have skipped step three or step four."
      >
        <CardGrid min={300}>
          {STEPS.map((s) => (
            <InfoCard key={s.step} step={s.step} title={s.title} body={s.body} />
          ))}
        </CardGrid>
      </Section>

      <Section
        id="mistakes"
        heading="What goes wrong most often"
        intro="None of these are about writing ability. They are all about follow-through."
      >
        <CardGrid min={250}>
          {MISTAKES.map((m) => (
            <InfoCard key={m.title} title={m.title} body={m.body} />
          ))}
        </CardGrid>
      </Section>

      <Section
        id="costs"
        heading="What it costs"
        intro="CharitMe charges no mandatory platform fee. Donors are offered an optional tip, which is always reducible to zero, and payment processing is charged at cost."
      >
        <CardGrid min={250}>
          <InfoCard title="Platform fee" body="0%. There is no percentage cut of your donations, and no monthly charge to run a campaign." />
          <InfoCard title="Processing" body="Card payments are 2.9% + $0.30, charged by the payment processor. Other methods differ — the exact rate is shown to donors before they pay." />
          <InfoCard title="Payouts" body="Standard payouts arrive on a two-business-day schedule once your Stripe account is connected and verified." />
        </CardGrid>
        <p style={{ fontSize: '13px', color: 'var(--t4)', marginTop: '14px' }}>
          Full detail on the <Link href="/pricing" style={{ color: 'var(--green-text)', fontWeight: 650 }}>pricing page</Link> and{' '}
          <Link href="/fees" style={{ color: 'var(--green-text)', fontWeight: 650 }}>fee breakdown</Link>.
        </p>
      </Section>

      <CtaBand
        heading="Ready to start?"
        body="It takes about five minutes to publish, and you can keep editing after it goes live."
        primary={{ label: 'Start a fundraiser', href: '/create' }}
        secondary={{ label: 'How it works', href: '/how-it-works' }}
      />
    </PageBody>
  );
}
