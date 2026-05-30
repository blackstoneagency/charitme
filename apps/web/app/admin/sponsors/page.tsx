import 'server-only';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import AdminSponsorsClient from './_components/AdminSponsorsClient';

export const dynamic = 'force-dynamic';

export default async function AdminSponsorsPage() {
  await requireAdmin();
  return (
    <CharitMeShell active="Sponsors" mode="admin">
      <TopBar title="Sponsors" subtitle="Manage sponsor logos displayed in the homepage rotating bar." actions={<></>} />
      <AdminSponsorsClient />
    </CharitMeShell>
  );
}
