import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../../../components/CharitMeShellServer';
import { getPaymentAdminData, money } from '../../../../../lib/payment-admin-data';
import { PaymentTable, SummaryCards } from '../../_components/PaymentAdminParts';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ campaignId: string }>;
};

export default async function CampaignPaymentFlowPage({ params }: PageProps): Promise<JSX.Element> {
  const { campaignId } = await params;
  const data = await getPaymentAdminData({ campaignId }, 200);
  const title = data.rows[0]?.campaigns?.title ?? 'Campaign Payment Flow';

  return (
    <CharitMeShell active="Payment Flows" mode="admin">
      <TopBar title={title} subtitle="Campaign-level money movement from checkout through settlement." />
      <div className="kf-admin-dash">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={`/admin/payments/campaign-flows/${campaignId}/transactions`} style={buttonStyle}>Transactions</Link>
          <Link href="/admin/payments/reconciliation" style={buttonStyle}>Reconciliation</Link>
          <Link href={`/api/admin/payments/export?type=campaign-ledger&campaignId=${campaignId}`} style={buttonStyle}>Export Campaign Ledger</Link>
        </div>
        <SummaryCards data={data} />
        <div style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 14, padding: 18 }}>
          <strong style={{ color: '#111944', display: 'block', marginBottom: 8 }}>Settlement Snapshot</strong>
          <span style={{ color: '#64748b', fontWeight: 800 }}>
            Gross {money(data.summary.totalGross)} · Platform revenue {money(data.summary.totalPlatformRevenue)} · Owner net {money(data.summary.totalOwnerNet)}
          </span>
        </div>
        <PaymentTable rows={data.rows} />
      </div>
    </CharitMeShell>
  );
}

const buttonStyle = {
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 10,
  background: '#6c35ff',
  color: '#fff',
  padding: '0 14px',
  fontWeight: 900,
  textDecoration: 'none',
} as const;
