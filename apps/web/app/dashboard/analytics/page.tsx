import { PageScaffold, campaignRows } from '../../../components/KindFundApp';

export default function AnalyticsPage() {
  return (
    <PageScaffold
      active="Analytics"
      title="Analytics"
      subtitle="Track your performance, understand your donors, and grow your impact."
      metrics={[
        { label: 'Raised This Week', value: '$3,420', change: '↑ 28% vs last week', icon: 'gift', tone: 'violet' },
        { label: 'Donations', value: '487', change: '↑ 18% vs last week', icon: 'users', tone: 'green' },
        { label: 'Views', value: '12,450', change: '↑ 36% vs last week', icon: 'chart', tone: 'orange' },
        { label: 'Conversion Rate', value: '3.9%', change: '↑ 12% vs last week', icon: 'filter', tone: 'blue' },
      ]}
      rows={campaignRows}
      tabs={['Overview', 'Donors', 'Campaign Performance', 'Content', 'Traffic', 'Reports']}
    />
  );
}
