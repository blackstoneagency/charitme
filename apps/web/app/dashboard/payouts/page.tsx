import { PageScaffold } from '../../../components/KindFundApp';

const rows = ['Children’s Heart Alliance', 'Hope Family Shelter', 'Paws & Claws Rescue', 'Bright Future Academy', 'Global Relief Initiative', 'Clean Water Project', 'Youth Empowerment Foundation'].map((title, i) => ({
  title,
  subtitle: ['John Davis', 'Lisa Martinez', 'Michael Brown', 'Emily Johnson', 'David Wilson', 'Sarah Lee', 'Rachel Green'][i],
  status: ['Completed', 'Completed', 'Pending', 'Completed', 'Failed', 'Cancelled', 'Completed'][i],
  amount: ['$8,750.00', '$6,200.00', '$3,400.00', '$4,125.00', '$5,250.00', '$875.00', '$1,850.00'][i],
  meta: ['Bank Transfer', 'May 20, 2024'],
}));

export default function PayoutsPage() {
  return (
    <PageScaffold
      active="Payouts"
      title="Payouts"
      subtitle="Review and manage payouts to your beneficiaries and organization."
      metrics={[
        { label: 'Total Payouted', value: '$28,450.00', change: '↑ 24% vs last 7 days', icon: 'wallet', tone: 'violet' },
        { label: 'Pending Payouts', value: '$3,250.00', change: '↑ 12% vs last 7 days', icon: 'gift', tone: 'green' },
        { label: 'This Month', value: '$12,840.00', change: '↑ 18% vs last month', icon: 'chart', tone: 'blue' },
        { label: 'Total Fees', value: '$412.75', change: '↓ 8% vs last 7 days', icon: 'doc', tone: 'orange' },
      ]}
      rows={rows}
      tabs={['All Payouts (42)', 'Completed (36)', 'Pending (3)', 'Failed (1)', 'Cancelled (2)']}
    />
  );
}
