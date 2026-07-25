import JsonLd from '../../components/JsonLd';
import HelpPageClient from './HelpPageClient';

export default function HelpPage(): React.ReactElement {
  return (
    <>
      <JsonLd json={JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'CharitMe Help Center',
        url: 'https://www.charitme.com/help',
      })} />
      <HelpPageClient />
    </>
  );
}
