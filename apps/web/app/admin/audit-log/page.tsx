import { PageScaffold } from '../../../components/KindFundShellServer';

const rows = ['Updated user role', 'Created campaign', 'Donation refunded', 'Approved payout', 'Published content', 'Login failed', 'Password changed'].map((title, i) => ({ title, subtitle: ['Admin User', 'System', 'User John'][i % 3], status: i === 5 ? 'Failed' : 'Success', amount: ['Users', 'Campaigns', 'Donations', 'Payouts'][i % 4], meta: ['May 31, 2024', '10:24 AM UTC'] }));

export default function AuditLogPage() {
  return <PageScaffold mode="admin" active="Audit Log" title="Audit Log" subtitle="Track, review and monitor important actions across the platform." metrics={[{ label: 'Total Events', value: '24,856', change: '↑ 10%', icon: 'audit', tone: 'violet' }, { label: 'Unique Users', value: '156', change: '↑ 12%', icon: 'users', tone: 'green' }, { label: 'Categories', value: '14', change: '', icon: 'stack', tone: 'blue' }, { label: 'Failed Events', value: '32', change: '↑ 6%', icon: 'doc', tone: 'orange' }]} rows={rows} tabs={['All Events', 'Users', 'Campaigns', 'Donations', 'Security']} />;
}
