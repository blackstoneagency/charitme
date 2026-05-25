import { MarketingPage } from '../../components/MarketingPage';
import { getMarketingPage } from '../../lib/marketing';

export default function HowItWorksPage() {
  return <MarketingPage page={getMarketingPage('how-it-works')!} />;
}
