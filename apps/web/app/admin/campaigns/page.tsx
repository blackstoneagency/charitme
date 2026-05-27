import { PageScaffold, campaignRows } from '../../../components/KindFundShellServer';

export default function AdminCampaignsPage() {
  return <PageScaffold mode="admin" active="Campaigns" title="Campaigns" subtitle="Create, review, approve, manage and track campaigns from start to finish." metrics={[{ label: 'All Campaigns', value: '2,348', change: '↑ 12%', icon: 'stack', tone: 'violet' }, { label: 'Published', value: '1,924', change: '↑ 8%', icon: 'check', tone: 'green' }, { label: 'Pending Review', value: '86', change: '↑ 4%', icon: 'audit', tone: 'orange' }, { label: 'Drafts', value: '338', change: '↑ 3%', icon: 'doc', tone: 'blue' }]} rows={campaignRows} tabs={['All (24)', 'Published (12)', 'Draft (5)', 'Pending (3)', 'Archived (4)']} />;
}
