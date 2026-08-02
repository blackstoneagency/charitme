import type { Metadata } from 'next';
import { PageBody, PageHero, Section, CardGrid, InfoCard } from '../../components/PageShell';
import NewsletterForm from './NewsletterForm';

export const metadata: Metadata = {
  title: 'Newsletter',
  description:
    'One email a month from CharitMe — what got funded, what we changed, and what we got wrong. One-click unsubscribe on every issue.',
  alternates: { canonical: 'https://www.charitme.com/newsletter' },
};

// Design 32. `todo.md` had this page marked as unbuildable — "no subscriber
// table, needs DDL, which is blocked". That was wrong: `marketing_contacts`
// already lists `newsletter` among its client types, `marketing_consent` already
// records opt-ins, and `/api/marketing/capture` already accepts both. So this
// ships fully wired with no migration.
//
// Nothing on this page claims a subscriber count, an open rate, or "join 40,000
// readers". None of those are measured, and the design's placeholder numbers are
// the same fabricated-statistic problem `/resources` documents.

const WHAT_YOU_GET = [
  {
    title: 'What actually got funded',
    body: 'A handful of campaigns that reached their goal last month, with the amount raised and what it paid for. Real campaigns, linked, not composites.',
  },
  {
    title: 'What changed on the platform',
    body: 'Features that shipped, fees that moved, countries that opened. Written so you can tell whether it affects you in one line.',
  },
  {
    title: 'What we got wrong',
    body: 'Outages, mistakes and the fixes. If something went wrong with payouts or a campaign was removed in error, it goes here rather than nowhere.',
  },
  {
    title: 'Practical fundraising advice',
    body: 'One concrete thing that measurably helps a campaign — drawn from what worked on this platform, not from generic marketing lists.',
  },
];

const PROMISES = [
  {
    title: 'Once a month',
    body: 'At the start of the month. There is no daily digest, no drip sequence, and no "we noticed you didn’t open the last one" follow-up.',
  },
  {
    title: 'One click to leave',
    body: 'Every issue carries an unsubscribe link that works in one click, without a login and without a "are you sure?" page.',
  },
  {
    title: 'Never sold, never rented',
    body: 'Your address is stored to send this newsletter. It is not passed to advertisers or partners.',
  },
  {
    title: 'Separate from donation receipts',
    body: 'Subscribing here does not change anything about the transactional email for donations or campaigns you already receive.',
  },
];

export default function NewsletterPage() {
  return (
    <PageBody>
      <PageHero
        eyebrow="NEWSLETTER"
        title="One email a month, worth the open"
        lede="What got funded, what changed on CharitMe, and what we got wrong — sent at the start of each month. Nothing else."
      />

      <div style={{ maxWidth: 720, marginBottom: 52 }}>
        <NewsletterForm />
      </div>

      <Section id="whats-inside" heading="What is inside" intro="Four sections, every issue, in this order.">
        <CardGrid>
          {WHAT_YOU_GET.map((item) => (
            <InfoCard key={item.title} title={item.title} body={item.body} />
          ))}
        </CardGrid>
      </Section>

      <Section
        id="the-terms"
        heading="The terms, plainly"
        intro="The things a subscribe box usually leaves you to find out afterwards."
      >
        <CardGrid>
          {PROMISES.map((item) => (
            <InfoCard key={item.title} title={item.title} body={item.body} />
          ))}
        </CardGrid>
      </Section>

      <Section
        id="already-subscribed"
        heading="Already subscribed, or want out?"
        intro="Both take one step and neither needs an account."
      >
        <CardGrid>
          <InfoCard
            title="Unsubscribe"
            body="Use the link at the bottom of any issue. It takes effect immediately — there is no confirmation step to complete."
          />
          <InfoCard
            title="Change your address"
            body="Subscribe with the new one here, then unsubscribe the old one. They are tracked separately."
          />
          <InfoCard
            title="Delete your data"
            body="Ask us to remove your contact record entirely rather than just stopping the sends."
            href="/privacy-center"
          />
          <InfoCard
            title="Something else"
            body="Anything the above does not cover reaches a real support queue."
            href="/contact"
          />
        </CardGrid>
      </Section>
    </PageBody>
  );
}
