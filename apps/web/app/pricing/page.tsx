import { MarketingPage } from '../../components/MarketingPage';
import { getMarketingPage } from '../../lib/marketing';

export default function PricingPage() {
  return <MarketingPage page={getMarketingPage('pricing')!} />;
}
