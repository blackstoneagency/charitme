import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { getPaymentAdminData } from '../../../../lib/payment-admin-data';
import { PaymentTable } from '../_components/PaymentAdminParts';

export const dynamic = 'force-dynamic';

export default async function PaymentPayoutsPage(): Promise<JSX.Element> {
  const data = await getPaymentAdminData({}, 500);
  const rows = data.rows.filter(row => row.payout_status !== 'not_applicable');
  return (
    <CharitMeShell active="Payment Flows" mode="admin">
      <TopBar title="Campaign Owner Payouts" subtitle="Owner payout status backed by canonical campaign payment records." />
      <div style={{ padding: '0 32px 40px' }}>
        <PaymentTable rows={rows} />
      </div>
    </CharitMeShell>
  );
}
