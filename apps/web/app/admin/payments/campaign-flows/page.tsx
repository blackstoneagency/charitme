import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { getCampaignOptions, getPaymentAdminData, type PaymentFilters } from '../../../../lib/payment-admin-data';
import { PaymentFiltersBar, PaymentTable, SummaryCards } from '../_components/PaymentAdminParts';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<PaymentFilters>;
};

export default async function CampaignPaymentFlowsPage({ searchParams }: PageProps): Promise<JSX.Element> {
  const filters = (await searchParams) ?? {};
  const [data, campaigns] = await Promise.all([
    getPaymentAdminData(filters, 200),
    getCampaignOptions(),
  ]);

  return (
    <CharitMeShell active="Payment Flows" mode="admin">
      <TopBar title="Campaign Payment Flows" subtitle="Trace donor payment, processor fees, ChartiMe.com revenue, owner transfer, payout, and settlement." />
      <div className="kf-admin-dash">
        <SummaryCards data={data} />
        <PaymentFiltersBar campaigns={campaigns} />
        <PaymentTable rows={data.rows} />
      </div>
    </CharitMeShell>
  );
}
