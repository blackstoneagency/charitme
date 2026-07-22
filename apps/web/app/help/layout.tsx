import type { Metadata } from 'next';
import { seoMetadata } from '../../lib/seo';
import AeoContent from '../../components/AeoContent';
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('/help', {
  title: 'Help Center',
  description: 'Find answers to common questions about CharitMe campaigns, donations, payouts, trust & safety, and account management.',
  alternates: { canonical: 'https://www.charitme.com/help' },
  });
}

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<AeoContent route="/help" title="Published help answers" /></>;
}
