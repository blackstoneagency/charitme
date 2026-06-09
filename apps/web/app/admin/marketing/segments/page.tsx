import 'server-only';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../../lib/auth';
import AdminMarketingClient from '../_components/AdminMarketingClient';
import { getMarketingOverview } from '../_components/overview';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireAdmin();
  const overview = await getMarketingOverview();
  return (
    <CharitMeShell active="Marketing" mode="admin">
      <TopBar title="Marketing — Segments" subtitle="Live Supabase data." actions={<></>} />
      <AdminMarketingClient overview={overview} initialTab="segments" />
    </CharitMeShell>
  );
}
