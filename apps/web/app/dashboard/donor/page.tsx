import { PageScaffold } from '../../../components/KindFundApp';

const rows = ['James Miller', 'Sophia Chen', 'Michael Brown', 'Emily Davis', 'Daniel Wilson', 'Lisa White', 'David Thompson', 'Olivia Martinez'].map((name, i) => ({
  title: name,
  subtitle: `${name.toLowerCase().replace(' ', '.')}@gmail.com`,
  status: i % 2 ? 'One-time' : 'Recurring',
  amount: ['$1,250', '$980', '$750', '$620', '$580', '$500', '$450', '$420'][i],
  meta: [`${12 - i} donations`, i % 3 === 0 ? 'High engagement' : 'Medium engagement'],
}));

export default function DonorsPage() {
  return (
    <PageScaffold
      active="Donors"
      title="Donors"
      subtitle="Build stronger relationships with your supporters."
      metrics={[
        { label: 'Total Donors', value: '649', change: '↑ 18% vs last 7 days', icon: 'users', tone: 'violet' },
        { label: 'New Donors', value: '78', change: '↑ 22% vs last 7 days', icon: 'team', tone: 'green' },
        { label: 'Total Donated', value: '$32,770', change: '↑ 28% vs last 7 days', icon: 'gift', tone: 'blue' },
        { label: 'Avg. Donation', value: '$50.42', change: '↑ 9% vs last 7 days', icon: 'chart', tone: 'orange' },
      ]}
      rows={rows}
      tabs={['All Donors (649)', 'New (78)', 'Top Donors', 'Recurring Donors']}
    />
  );
}
