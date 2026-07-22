import type { Metadata } from 'next';
import { seoMetadata } from '../../lib/seo';
import AeoContent from '../../components/AeoContent';
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('/pricing', {
  title: 'Pricing',
  description: 'Simple, transparent CharitMe pricing. 0% platform fee on the Free plan, plus Boost, Pro, Creator, Community, and Nonprofit plans with advanced AI fundraising tools.',
  alternates: { canonical: 'https://www.charitme.com/pricing' },
  });
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<AeoContent route="/pricing" title="Pricing questions answered" /></>;
}
