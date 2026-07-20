import 'server-only';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import { listExceptions } from '../../../lib/reconciliation';
import AdminReconciliationClient from './_components/AdminReconciliationClient';

export const dynamic = 'force-dynamic';

export default async function AdminReconciliationPage() {
  await requireAdmin();
  const exceptions = await listExceptions('open');

  return (
    <CharitMeShell active="Reconciliation" mode="admin">
      <TopBar
        title="Ledger Reconciliation"
        subtitle="Exceptions where a captured donation does not match its immutable ledger footprint. Raised nightly by the reconciliation job."
        actions={<></>}
      />
      <div style={{ padding: '20px 24px' }}>
        <AdminReconciliationClient initialExceptions={exceptions} />
      </div>
    </CharitMeShell>
  );
}
