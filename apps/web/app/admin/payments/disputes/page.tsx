import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { getPaymentAdminData } from '../../../../lib/payment-admin-data';
import { PaymentTable } from '../_components/PaymentAdminParts';

export const dynamic = 'force-dynamic';

export default async function PaymentDisputesPage(): Promise<JSX.Element> {
  const data = await getPaymentAdminData({ paymentStatus: 'disputed' }, 500);
  return (
    <CharitMeShell active="Payment Flows" mode="admin">
      <TopBar title="Payment Disputes" subtitle="Open, won, and lost campaign payment disputes." />
      <div style={{ padding: '0 32px 40px' }}>
        <PaymentTable rows={data.rows} />
      </div>
    </CharitMeShell>
  );
}
