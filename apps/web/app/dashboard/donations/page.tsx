import { PageScaffold, baseMetrics } from '../../../components/KindFundApp';

const rows = ['James Miller', 'Sophia Chen', 'Michael Brown', 'Emily Davis', 'Daniel Wilson', 'Lisa White', 'David Thompson', 'Olivia Martinez'].map((name, i) => ({
  title: name,
  subtitle: `${name.toLowerCase().replace(' ', '.')}@gmail.com`,
  image: i % 3 === 0 ? '/hero-child-crop.png' : undefined,
  status: i === 6 ? 'Recurring' : 'One-time',
  amount: ['$100.00', '$250.00', '$50.00', '$75.00', '$60.00', '$35.00', '$200.00', '$120.00'][i],
  meta: ['Help Mia Get Life-Saving Heart Surgery', 'May 20, 2024'],
}));

export default function DonationsPage() {
  return (
    <PageScaffold
      active="Donations"
      title="Donations"
      subtitle="Track and manage all donations across your campaigns."
      metrics={baseMetrics}
      rows={rows}
      tabs={['All Donations', 'One-time', 'Recurring', 'Top Donors']}
    />
  );
}
