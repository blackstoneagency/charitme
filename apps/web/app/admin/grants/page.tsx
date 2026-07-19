import 'server-only';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import AdminGrantsClient from './_components/AdminGrantsClient';

export const dynamic = 'force-dynamic';

export default async function AdminGrantsPage() {
  await requireAdmin();

  return (
    <CharitMeShell active="Grants" mode="admin">
      <TopBar
        title="Grants"
        subtitle="Publish grant opportunities to the public discovery page and manage applications."
        actions={<></>}
      />
      <div className="kf-admin-dash">
        <AdminGrantsClient />
      </div>
    </CharitMeShell>
  );
}
