import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { getPaymentAdminData } from '../../../../lib/payment-admin-data';
import { PaymentTable } from '../_components/PaymentAdminParts';

export const dynamic = 'force-dynamic';

export default async function PaymentRefundsPage(): Promise<JSX.Element> {
  const partial = await getPaymentAdminData({ paymentStatus: 'partially_refunded' }, 300);
  const full = await getPaymentAdminData({ paymentStatus: 'refunded' }, 300);
  return (
    <CharitMeShell active="Payment Flows" mode="admin">
      <TopBar title="Payment Refunds" subtitle="Partial and full campaign payment refunds." />
      <div style={{ padding: '0 32px 40px' }}>
        <PaymentTable rows={[...partial.rows, ...full.rows]} />
      </div>
    </CharitMeShell>
  );
}
