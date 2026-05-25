import { MarketingPage } from '../../components/MarketingPage';
import { getMarketingPage } from '../../lib/marketing';

export default function ForDonorsPage() {
  return <MarketingPage page={getMarketingPage('for-donors')!} />;
}
