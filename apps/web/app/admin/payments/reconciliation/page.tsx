import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { getPaymentAdminData } from '../../../../lib/payment-admin-data';
import { summarizePaymentRows } from '../../../../lib/payment-flow';
import { PaymentTable, SummaryCards } from '../_components/PaymentAdminParts';

export const dynamic = 'force-dynamic';

export default async function PaymentReconciliationPage(): Promise<JSX.Element> {
  const data = await getPaymentAdminData({ reconciliationStatus: 'needs_review' }, 300);
  const pending = await getPaymentAdminData({ reconciliationStatus: 'pending_data' }, 300);
  const rows = [...data.rows, ...pending.rows];
  const summary = summarizePaymentRows(rows);

  return (
    <CharitMeShell active="Payment Flows" mode="admin">
      <TopBar title="Payment Reconciliation" subtitle="Missing fees, mismatches, payout issues, webhook gaps, refunds, disputes, and stale pending settlement." />
      <div style={{ padding: '0 32px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SummaryCards data={{ rows, summary }} />
        <PaymentTable rows={rows} />
      </div>
    </CharitMeShell>
  );
}
