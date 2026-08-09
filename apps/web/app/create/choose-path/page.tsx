import type { Metadata } from 'next';
import CampaignPathChoice from '../CampaignPathChoice';

export const metadata: Metadata = {
  title: 'Start your campaign',
  description: 'Choose how to build your fundraiser: let AI draft it for you or go step by step. Either way, pause and resume anytime.',
};

export default function ChoosePathPage() {
  return <CampaignPathChoice />;
}
