import { PageScaffold, campaignRows } from '../../components/KindFundApp';

export default function AdminDashboardPage() {
  return (
    <PageScaffold
      mode="admin"
      active="Dashboard"
      title="Admin Dashboard"
      subtitle="Get a high-level overview of the platform and drill down into what matters."
      metrics={[
        { label: 'Total Users', value: '12,580', change: '↑ 10%', icon: 'users', tone: 'violet' },
        { label: 'Campaigns', value: '2,348', change: '↑ 12%', icon: 'stack', tone: 'green' },
        { label: 'Donations', value: '$289,450', change: '↑ 22%', icon: 'gift', tone: 'blue' },
        { label: 'Payouts', value: '$156,780', change: '↑ 15%', icon: 'wallet', tone: 'orange' },
      ]}
      rows={campaignRows}
      tabs={['Overview', 'Donations', 'Users', 'Payouts']}
    />
  );
}
