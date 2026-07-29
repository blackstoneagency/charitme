import type { Metadata } from 'next';
import JsonLd from '../../components/JsonLd';
import { safeJsonLd } from '../../lib/json-ld';
import PricingPageClient from './PricingPageClient';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Review CharitMe fundraising plans, payment processing details, optional donor support, and premium campaign tools.',
  alternates: { canonical: 'https://www.charitme.com/pricing' },
  openGraph: {
    title: 'CharitMe Pricing',
    description: 'Review fundraising plans, payment processing details, optional donor support, and premium campaign tools.',
    url: 'https://www.charitme.com/pricing',
    type: 'website',
  },
};

export default function PricingPage(): React.ReactElement {
  return (
    <>
      <JsonLd json={safeJsonLd({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'CharitMe Pricing',
        url: 'https://www.charitme.com/pricing',
        description: 'CharitMe fundraising plans and premium campaign tools.',
        isPartOf: {
          '@type': 'WebSite',
          name: 'CharitMe',
          url: 'https://www.charitme.com',
        },
      })} />
      <PricingPageClient />
    </>
  );
}
