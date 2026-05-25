import { MarketingPage } from '../../components/MarketingPage';
import { getMarketingPage } from '../../lib/marketing';

export default function FastPayoutsPage() {
  return <MarketingPage page={getMarketingPage('fast-payouts')!} />;
}
