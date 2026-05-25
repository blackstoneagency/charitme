import { MarketingPage } from '../../components/MarketingPage';
import { getMarketingPage } from '../../lib/marketing';

export default function ContactPage() {
  return <MarketingPage page={getMarketingPage('contact')!} />;
}
