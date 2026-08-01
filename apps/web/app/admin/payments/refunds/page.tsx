import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { getPaymentAdminData } from '../../../../lib/payment-admin-data';
import { PaymentTable } from '../_components/PaymentAdminParts';
import { PaymentsSubnav } from '../_components/PaymentsSubnav';

export const dynamic = 'force-dynamic';

export default async function PaymentRefundsPage(): Promise<JSX.Element> {
  const partial = await getPaymentAdminData({ paymentStatus: 'partially_refunded' }, 300);
  const full = await getPaymentAdminData({ paymentStatus: 'refunded' }, 300);
  return (
    <CharitMeShell active="Payment Flows" mode="admin">
      <TopBar title="Payment Refunds" subtitle="Partial and full campaign payment refunds." />
      <div className="kf-admin-dash">
        <PaymentsSubnav />
        <PaymentTable rows={[...partial.rows, ...full.rows]} />
      </div>
    </CharitMeShell>
  );
}
