import type { Metadata } from 'next';
import FeedbackForm from './FeedbackForm';
import { PageBody, PageHero, Section, CardGrid, InfoCard } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Feedback',
  description:
    'Tell us what is working and what is not. Bug reports, feature requests, confusing wording, and accessibility problems all reach a person.',
  alternates: { canonical: 'https://www.charitme.com/feedback' },
};

const OTHER_WAYS = [
  { title: 'Help centre', body: 'Answers to the questions we get most, searchable.', href: '/help' },
  { title: 'Contact us', body: 'For anything that needs a conversation rather than a note.', href: '/contact' },
  { title: 'Report a campaign', body: 'If something on a campaign page concerns you, this is the faster route.', href: '/trust-safety' },
  { title: 'Accessibility', body: 'Our accessibility commitments, and how to tell us where we fall short.', href: '/accessibility' },
];

export default function FeedbackPage() {
  return (
    <PageBody>
      <PageHero
        eyebrow="FEEDBACK"
        title="We value your feedback"
        lede="Tell us what is working and what is not. Bug reports and “this bit confused me” are equally useful — the second kind is usually harder to get and more valuable."
      />

      <Section id="form" heading="Send us a note">
        <FeedbackForm />
      </Section>

      <Section id="other" heading="Other ways to reach us">
        <CardGrid min={250}>
          {OTHER_WAYS.map((o) => <InfoCard key={o.href} title={o.title} body={o.body} href={o.href} />)}
        </CardGrid>
      </Section>
    </PageBody>
  );
}
