import type { Metadata } from 'next';
import JsonLd from '../../components/JsonLd';
import { safeJsonLd } from '../../lib/json-ld';
import HelpPageClient from './HelpPageClient';

export const metadata: Metadata = {
  title: 'Help Center',
  description: 'Get answers about CharitMe campaigns, donations, payouts, account security, and fundraiser support.',
  alternates: { canonical: 'https://www.charitme.com/help' },
  openGraph: {
    title: 'CharitMe Help Center',
    description: 'Get answers about campaigns, donations, payouts, account security, and fundraiser support.',
    url: 'https://www.charitme.com/help',
    type: 'website',
  },
};

const helpFaqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  name: 'CharitMe Help Center',
  url: 'https://www.charitme.com/help',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How do I start a fundraiser?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Click "Get Started" on any page, sign in or create a free account, then follow the 5-step campaign wizard. You can save a draft at any time and publish when ready. AI Copilot can write your title and story automatically.',
      },
    },
    {
      '@type': 'Question',
      name: 'What categories can I fundraise for?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'CharitMe supports Medical, Memorial/Funeral, Emergency, Disaster Relief, Education, Animal/Pet, Community, Nonprofit, Sports/Teams, and more. Choose the category that best fits your need during campaign creation.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I donate anonymously?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Check "Donate anonymously" at checkout. Your name will not appear in the public donation list, but your donation amount still counts toward the campaign goal.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can someone else receive the funds?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. If you\'re raising funds for a beneficiary, you can set up a separate Stripe Connect account for them to receive funds directly. Contact support to initiate a beneficiary payout transfer.',
      },
    },
    {
      '@type': 'Question',
      name: 'Will I get a receipt?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. An email receipt is sent automatically after every completed donation. The receipt includes the amount, campaign name, date, and a link to your donor dashboard. Contact support to resend a receipt.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I add video to my campaign?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. When editing your campaign, paste a YouTube or Vimeo URL in the Video URL field. The video will be embedded on your public campaign page.',
      },
    },
  ],
};

export default function HelpPage(): React.ReactElement {
  return (
    <>
      <JsonLd json={safeJsonLd(helpFaqJsonLd)} />
      <HelpPageClient />
    </>
  );
}
