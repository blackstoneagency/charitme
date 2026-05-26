import { PageScaffold, baseMetrics, campaignRows, LineChart, DonutCard } from '../../components/KindFundApp';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <PageScaffold
      active="Dashboard"
      title="Welcome back, Sarah!"
      subtitle="Here's what's happening with your campaigns."
      metrics={baseMetrics}
      rows={campaignRows}
      tabs={['All Campaigns (4)', 'Active (3)', 'Paused (1)', 'Completed (0)', 'Drafts (0)']}
    >
      <div className="kf-two-col">
        <LineChart title="Performance Overview" />
        <DonutCard title="Donations by Source" />
      </div>
    </PageScaffold>
  );
}
