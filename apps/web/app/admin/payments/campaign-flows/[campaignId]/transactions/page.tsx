import { CharitMeShell, TopBar } from '../../../../../../components/CharitMeShellServer';
import { getPaymentAdminData } from '../../../../../../lib/payment-admin-data';
import { PaymentTable } from '../../../_components/PaymentAdminParts';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ campaignId: string }>;
};

export default async function CampaignTransactionsPage({ params }: PageProps): Promise<JSX.Element> {
  const { campaignId } = await params;
  const data = await getPaymentAdminData({ campaignId }, 500);

  return (
    <CharitMeShell active="Payment Flows" mode="admin">
      <TopBar title="Campaign Transactions" subtitle="Every canonical payment record for this campaign." />
      <div style={{ padding: '0 32px 40px' }}>
        <PaymentTable rows={data.rows} />
      </div>
    </CharitMeShell>
  );
}
