import 'server-only';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import { listAllRequests } from '../../../lib/privacy';
import AdminPrivacyClient from './_components/AdminPrivacyClient';

export const dynamic = 'force-dynamic';

export default async function AdminPrivacyPage() {
  await requireAdmin();
  const requests = await listAllRequests();

  return (
    <CharitMeShell active="Privacy Requests" mode="admin">
      <TopBar
        title="Privacy Requests"
        subtitle="Review and fulfill GDPR/CCPA data-export and account-deletion requests."
        actions={<></>}
      />
      <div style={{ padding: '20px 24px' }}>
        <AdminPrivacyClient initialRequests={requests} />
      </div>
    </CharitMeShell>
  );
}
