import { PageScaffold } from '../../../components/KindFundApp';

const rows = ['Sarah Johnson', 'Michael Brown', 'Emily Davis', 'James Wilson', 'Lisa Martinez', 'David Lee', 'Priya Patel'].map((name, i) => ({ title: name, subtitle: ['Clean Water for All', 'Education for Kids', 'Medical Aid Fund', 'Save the Oceans'][i % 4], status: ['Completed', 'Completed', 'Refunded', 'Pending'][i % 4], amount: ['$100.00', '$250.00', '$75.00', '$120.00', '$60.00', '$200.00', '$50.00'][i], meta: ['May 30, 2024', 'Visa •••• 4242'] }));

export default function AdminDonationsPage() {
  return <PageScaffold mode="admin" active="Donations" title="Donations" subtitle="Manage donations, donors, and transactions from start to finish." metrics={[{ label: 'Total Donations', value: '$289,450', change: '↑ 10%', icon: 'gift', tone: 'violet' }, { label: 'Total Donors', value: '2,348', change: '↑ 12%', icon: 'users', tone: 'green' }, { label: 'Average Donation', value: '$123.45', change: '↑ 8%', icon: 'chart', tone: 'blue' }, { label: 'Recurring Donations', value: '856', change: '↑ 21%', icon: 'check', tone: 'orange' }]} rows={rows} tabs={['All Donations', 'Completed', 'Pending', 'Refunded', 'Failed']} />;
}
