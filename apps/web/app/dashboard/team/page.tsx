import { PageScaffold } from '../../../components/KindFundApp';

const rows = ['Sarah Thompson', 'Michael Brown', 'Emily Davis', 'David Thompson', 'Olivia Martinez', 'James Wilson', 'Sophia Chen', 'Daniel Carter'].map((name, i) => ({
  title: name,
  subtitle: `${name.toLowerCase().replace(' ', '.')}@kindfund.org`,
  status: 'Active',
  amount: ['Admin', 'Admin', 'Editor', 'Editor', 'Editor', 'Viewer', 'Viewer', 'Editor'][i],
  meta: ['Full Access', 'Joined Apr 2024'],
}));

export default function TeamPage() {
  return (
    <PageScaffold
      active="Team"
      title="Team"
      subtitle="Collaborate with your team and manage roles and permissions."
      metrics={[
        { label: 'Total Members', value: '12', change: '↑ 20% vs last 30 days', icon: 'users', tone: 'violet' },
        { label: 'New Members', value: '2', change: '↑ 100% vs last 30 days', icon: 'team', tone: 'green' },
        { label: 'Active Members', value: '10', change: '↑ 11% vs last 30 days', icon: 'check', tone: 'blue' },
        { label: 'Admins', value: '3', change: '— vs last 30 days', icon: 'crown', tone: 'orange' },
      ]}
      rows={rows}
      tabs={['All Members (12)', 'Admins (3)', 'Editors (6)', 'Viewers (3)', 'Invited (1)']}
    />
  );
}
