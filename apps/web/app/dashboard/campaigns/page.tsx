import { PageScaffold, baseMetrics, campaignRows } from '../../../components/KindFundApp';

export default function MyCampaignsPage() {
  return (
    <PageScaffold
      active="Campaigns"
      title="My Campaigns"
      subtitle="Manage and grow all your fundraising campaigns in one place."
      metrics={[
        { ...baseMetrics[0], value: '$32,770' },
        { ...baseMetrics[1], value: '649' },
        { ...baseMetrics[2], label: 'Total Supporters', value: '812' },
        { ...baseMetrics[3], label: 'Avg. Conversion Rate', value: '3.6%' },
      ]}
      rows={campaignRows}
      tabs={['All Campaigns (4)', 'Active (3)', 'Paused (1)', 'Completed (0)', 'Drafts (0)']}
    />
  );
}
