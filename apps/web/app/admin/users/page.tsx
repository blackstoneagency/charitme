import { PageScaffold } from '../../../components/KindFundApp';

const rows = ['Sarah Johnson', 'Michael Brown', 'Emily Davis', 'James Wilson', 'Lisa Martinez'].map((name, i) => ({
  title: name,
  subtitle: `${name.toLowerCase().replace(' ', '.')}@example.com`,
  status: i === 3 ? 'Inactive' : 'Active',
  amount: i === 1 || i === 4 ? 'Organizer' : 'Donor',
  meta: ['Joined May 2024', i === 0 ? '$1,245 donated' : 'Platform user'],
}));

export default function AdminUsersPage() {
  return <PageScaffold mode="admin" active="Users" title="Users" subtitle="Manage platform users, roles, permissions, and account status." metrics={[{ label: 'Total Users', value: '12,580', change: '↑ 12%', icon: 'users', tone: 'violet' }, { label: 'Active Users', value: '10,245', change: '↑ 8%', icon: 'check', tone: 'green' }, { label: 'New Users', value: '856', change: '↑ 15%', icon: 'team', tone: 'blue' }, { label: 'Suspended', value: '249', change: '↑ 3%', icon: 'audit', tone: 'orange' }]} rows={rows} tabs={['All (2,560)', 'Active (2,156)', 'Inactive (284)', 'Suspended (120)']} />;
}
