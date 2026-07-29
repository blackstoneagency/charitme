import type { Metadata } from 'next';
import JsonLd from '../../components/JsonLd';
import { safeJsonLd } from '../../lib/json-ld';

export const metadata: Metadata = {
  title: 'AI Campaign Builder',
  description: 'Describe your fundraiser in a sentence and let CharitMe AI build your campaign title, story, goal, and donation tiers in seconds.',
  alternates: { canonical: 'https://www.charitme.com/ai-campaign' },
  openGraph: {
    title: 'CharitMe AI Campaign Builder',
    description: 'Describe your fundraiser and let CharitMe AI build your campaign title, story, goal, and donation tiers.',
    url: 'https://www.charitme.com/ai-campaign',
    type: 'website',
  },
};

const aiCampaignJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'CharitMe AI Campaign Builder',
  url: 'https://www.charitme.com/ai-campaign',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'An AI-assisted workflow for building a CharitMe fundraising campaign title, story, goal, and donation tiers.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
};

export default function AiCampaignLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <>
      <JsonLd json={safeJsonLd(aiCampaignJsonLd)} />
      {children}
    </>
  );
}
