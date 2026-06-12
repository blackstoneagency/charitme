import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Campaign Builder',
  description: 'Describe your fundraiser in a sentence and let CharitMe AI build your campaign title, story, goal, and donation tiers in seconds.',
  alternates: { canonical: 'https://www.charitme.com/ai-campaign' },
};

export default function AiCampaignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
