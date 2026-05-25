import { MarketingPage } from '../../components/MarketingPage';
import { getMarketingPage } from '../../lib/marketing';

export default function ForNonprofitsPage() {
  return <MarketingPage page={getMarketingPage('for-nonprofits')!} />;
}
