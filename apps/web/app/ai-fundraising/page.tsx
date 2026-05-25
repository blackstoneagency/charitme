import { MarketingPage } from '../../components/MarketingPage';
import { getMarketingPage } from '../../lib/marketing';

export default function AiFundraisingPage() {
  return <MarketingPage page={getMarketingPage('ai-fundraising')!} />;
}
