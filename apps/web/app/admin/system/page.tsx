import { PageScaffold } from '../../../components/KindFundApp';

const rows = ['General', 'Security', 'Email', 'Payment', 'Integrations', 'Notifications', 'Storage', 'System Maintenance', 'Feature Flags', 'Advanced'].map((title, i) => ({ title, subtitle: ['Basic platform configuration', 'Security policies and authentication', 'Email server and templates', 'Payment gateways and fees'][i % 4], status: i === 4 ? 'Disabled' : 'Enabled', amount: i === 4 ? 'Action needed' : 'Operational', meta: ['Updated May 30, 2024'] }));

export default function SystemSettingsPage() {
  return <PageScaffold mode="admin" active="System Settings" title="System Settings" subtitle="Configure platform-wide settings, integrations and system preferences." metrics={[{ label: 'Services', value: '18', change: 'Online', icon: 'check', tone: 'green' }, { label: 'Integrations', value: '12', change: 'Active', icon: 'link', tone: 'violet' }, { label: 'Scheduled Jobs', value: '36', change: 'Success', icon: 'chart', tone: 'blue' }, { label: 'Error Rate', value: '0.02%', change: 'Low', icon: 'audit', tone: 'orange' }]} rows={rows} tabs={['All Settings', 'General', 'Security', 'Integrations']} />;
}
