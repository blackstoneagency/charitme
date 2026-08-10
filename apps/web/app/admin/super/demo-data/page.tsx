import 'server-only';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireSuperAdmin } from '../../../../lib/auth';
import { getDemoDataSnapshot } from '../../../../lib/demo-data-admin';
import DemoDataClient from './DemoDataClient';

export const dynamic = 'force-dynamic';

export default async function DemoDataPage() {
  await requireSuperAdmin();
  const snapshot = await getDemoDataSnapshot();

  return (
    <CharitMeShell active="Demo Data" mode="admin">
      <TopBar title="Demo Data" subtitle="Review, label, and safely archive synthetic campaign records" />
      <DemoDataClient snapshot={snapshot} />
    </CharitMeShell>
  );
}
