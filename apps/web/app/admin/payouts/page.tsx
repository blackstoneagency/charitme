import { PageScaffold } from '../../../components/KindFundApp';

const rows = ['Lisa Martinez', 'Helping Hands Foundation', 'Michael Brown', 'Care Foundation', 'Emily Davis', 'David Lee', 'Priya Patel'].map((name, i) => ({ title: name, subtitle: ['Clean Water for All', 'Education for Kids', 'Medical Aid Fund'][i % 3], status: ['Pending', 'Completed', 'Failed'][i % 3], amount: ['$2,500.00', '$1,250.00', '$750.00', '$1,000.00', '$600.00', '$2,000.00', '$600.00'][i], meta: ['Bank Transfer', 'May 30, 2024'] }));

export default function AdminPayoutsPage() {
  return <PageScaffold mode="admin" active="Payouts" title="Payouts" subtitle="Manage payout requests, review details, take action, and track payouts." metrics={[{ label: 'Total Payouts', value: '$156,780', change: '↑ 10%', icon: 'wallet', tone: 'violet' }, { label: 'Pending', value: '$28,450', change: '↑ 12%', icon: 'audit', tone: 'orange' }, { label: 'Completed', value: '$118,230', change: '↑ 20%', icon: 'check', tone: 'green' }, { label: 'Failed', value: '$2,100', change: '↓ 8%', icon: 'doc', tone: 'pink' }]} rows={rows} tabs={['All', 'Pending', 'Approved', 'Paid', 'Failed']} />;
}
