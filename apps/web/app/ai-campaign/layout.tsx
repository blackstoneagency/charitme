import type { Metadata } from 'next';
import { seoMetadata } from '../../lib/seo';
import AeoContent from '../../components/AeoContent';
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('/ai-campaign', {
  title: 'AI Campaign Builder',
  description: 'Describe your fundraiser in a sentence and let CharitMe AI build your campaign title, story, goal, and donation tiers in seconds.',
  alternates: { canonical: 'https://www.charitme.com/ai-campaign' },
  });
}

export default function AiCampaignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<AeoContent route="/ai-campaign" title="AI campaign builder answers" /></>;
}
