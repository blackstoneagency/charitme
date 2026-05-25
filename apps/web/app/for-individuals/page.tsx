import { MarketingPage } from '../../components/MarketingPage';
import { getMarketingPage } from '../../lib/marketing';

export default function ForIndividualsPage() {
  return <MarketingPage page={getMarketingPage('for-individuals')!} />;
}
