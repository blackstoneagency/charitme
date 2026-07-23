import JsonLd from '../../components/JsonLd';
import PricingPageClient from './PricingPageClient';

export default function PricingPage(): React.ReactElement {
  return (
    <>
      <JsonLd json={JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'CharitMe Pricing',
        url: 'https://www.charitme.com/pricing',
      })} />
      <PricingPageClient />
    </>
  );
}
