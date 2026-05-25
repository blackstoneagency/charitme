import { MarketingPage } from '../../components/MarketingPage';
import { getMarketingPage } from '../../lib/marketing';

export default function TrustSafetyPage() {
  return <MarketingPage page={getMarketingPage('trust-safety')!} />;
}
