import 'server-only';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import AdminMarketingClient from './_components/AdminMarketingClient';
import { getMarketingOverview } from './_components/overview';

export const dynamic = 'force-dynamic';

const VALID_TABS = ['overview', 'audience', 'segments', 'campaigns', 'automations', 'copilot'] as const;
type TabKey = typeof VALID_TABS[number];

export default async function AdminMarketingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const overview = await getMarketingOverview();
  const { tab } = await searchParams;
  const initialTab = (VALID_TABS as readonly string[]).includes(tab ?? '') ? (tab as TabKey) : undefined;
  return (
    <CharitMeShell active="Marketing" mode="admin">
      <TopBar title="Marketing" subtitle="Audience capture, segmentation, campaigns, automations, and the AI copilot — all on live data." actions={<></>} />
      <AdminMarketingClient overview={overview} initialTab={initialTab} />
    </CharitMeShell>
  );
}
