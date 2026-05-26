import { PageScaffold } from '../../../components/KindFundApp';

const rows = ['Clean Water Initiative', 'About Us', 'Partnership Update', 'Volunteer Stories', 'Annual Report 2024', 'Event Gallery', 'Privacy Policy'].map((title, i) => ({ title, subtitle: ['Blog Post', 'Page', 'News', 'Document'][i % 4], status: i === 3 || i === 5 ? 'Draft' : 'Published', amount: ['1,254 views', '324 shares', '82 conversions'][i % 3], meta: ['Updated May 30, 2024', 'Sarah Johnson'] }));

export default function AdminContentPage() {
  return <PageScaffold mode="admin" active="Content" title="Content" subtitle="Create, manage, publish and track content across the platform." metrics={[{ label: 'Total Content', value: '256', change: '↑ 12%', icon: 'doc', tone: 'violet' }, { label: 'Published', value: '189', change: '↑ 15%', icon: 'check', tone: 'green' }, { label: 'Drafts', value: '42', change: '↓ 3%', icon: 'audit', tone: 'orange' }, { label: 'Archived', value: '25', change: '↑ 5%', icon: 'stack', tone: 'blue' }]} rows={rows} tabs={['All Content', 'Published', 'Drafts', 'Archived']} />;
}
