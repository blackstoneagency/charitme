import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, transparent CharitMe pricing. 0% platform fee on the Free plan, plus Boost, Pro, Creator, Community, and Nonprofit plans with advanced AI fundraising tools.',
  alternates: { canonical: 'https://www.charitme.com/pricing' },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
