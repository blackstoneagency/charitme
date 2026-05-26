import { PageScaffold } from '../../../components/KindFundApp';

const rows = ['Donation Summary', 'Campaign Performance', 'Payout Summary', 'User Activity', 'Recurring Donations', 'Top Donors', 'Donation Trends'].map((title, i) => ({ title, subtitle: ['Donations', 'Campaigns', 'Payouts', 'Users'][i % 4], status: i === 6 ? 'Failed' : 'Completed', amount: ['PDF, CSV', 'Excel', 'Scheduled'][i % 3], meta: ['Created May 30, 2024', 'Admin User'] }));

export default function AdminReportsPage() {
  return <PageScaffold mode="admin" active="Reports" title="Reports" subtitle="Create, run, analyze and export reports to drive data-informed decisions." metrics={[{ label: 'Total Reports', value: '128', change: '↑ 15%', icon: 'chart', tone: 'violet' }, { label: 'Scheduled Reports', value: '24', change: '↑ 20%', icon: 'doc', tone: 'green' }, { label: 'Total Exports', value: '86', change: '↑ 16%', icon: 'upload', tone: 'blue' }, { label: 'Data Points', value: '2.4M', change: '↑ 12%', icon: 'sliders', tone: 'orange' }]} rows={rows} tabs={['All Reports', 'Scheduled', 'Exports', 'History']} />;
}
