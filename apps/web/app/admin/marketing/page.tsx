import 'server-only';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import AdminMarketingClient from './_components/AdminMarketingClient';
import { getMarketingOverview } from './_components/overview';

export const dynamic = 'force-dynamic';

export default async function AdminMarketingPage() {
  await requireAdmin();
  const overview = await getMarketingOverview();
  return (
    <CharitMeShell active="Marketing" mode="admin">
      <TopBar title="Marketing" subtitle="Audience capture, segmentation, campaigns, automations, and the AI copilot — all on live data." actions={<></>} />
      <AdminMarketingClient overview={overview} />
    </CharitMeShell>
  );
}
