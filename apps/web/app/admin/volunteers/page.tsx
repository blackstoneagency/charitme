import 'server-only';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import AdminVolunteersClient from './_components/AdminVolunteersClient';

export const dynamic = 'force-dynamic';

export default async function AdminVolunteersPage() {
  await requireAdmin();

  return (
    <CharitMeShell active="Volunteers" mode="admin">
      <TopBar
        title="Volunteers"
        subtitle="Publish volunteer opportunities to the public /volunteer page and manage spots."
        actions={<></>}
      />
      <div className="kf-admin-dash">
        <AdminVolunteersClient />
      </div>
    </CharitMeShell>
  );
}
