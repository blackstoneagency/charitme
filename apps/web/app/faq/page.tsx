import { MarketingPage } from '../../components/MarketingPage';
import { getMarketingPage } from '../../lib/marketing';

export default function FaqPage() {
  return <MarketingPage page={getMarketingPage('faq')!} />;
}
