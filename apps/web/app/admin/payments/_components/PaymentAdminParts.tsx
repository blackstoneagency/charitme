import Link from 'next/link';
import { money, statusTone, type PaymentAdminData } from '../../../../lib/payment-admin-data';
import type { AdminPaymentRow } from '../../../../lib/payment-flow';

const cardStyle = {
  background: 'var(--s1)',
  border: '1px solid var(--line)',
  borderRadius: 14,
  padding: '18px 20px',
} as const;

export function SummaryCards({ data }: { data: PaymentAdminData }) {
  const cards = [
    ['Gross Campaign Payments', money(data.summary.totalGross)],
    ['ChartiMe.com Revenue', money(data.summary.totalPlatformRevenue)],
    ['Processor Fees', money(data.summary.totalProcessorFees)],
    ['Campaign Owner Net', money(data.summary.totalOwnerNet)],
    ['Paid Out', money(data.summary.totalPaidOut)],
    ['Pending Payout', money(data.summary.totalPendingPayout)],
    ['Failed Payments', String(data.summary.failedPayments)],
    ['Refunds', money(data.summary.totalRefunds)],
    ['Disputes', money(data.summary.totalDisputes)],
    ['Unreconciled', String(data.summary.unreconciled)],
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
      {cards.map(([label, value]) => (
        <div key={label} style={cardStyle}>
          <strong style={{ display: 'block', color: 'var(--t1)', fontSize: 22 }}>{value}</strong>
          <span style={{ display: 'block', color: 'var(--t3)', fontSize: 12, fontWeight: 650, marginTop: 5 }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function PaymentFiltersBar({ campaigns }: { campaigns: Array<{ id: string; title: string }> }) {
  return (
    <form className="kf-grid-6" style={{ alignItems: 'end', background: 'var(--s1)', border: '1px solid var(--line)', borderRadius: 14, padding: 14 }}>
      <Select name="processor" label="Processor" values={['', 'stripe', 'paypal', 'manual', 'other']} />
      <Select name="paymentStatus" label="Payment" values={['', 'pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded', 'disputed']} />
      <Select name="payoutStatus" label="Payout" values={['', 'not_applicable', 'requested', 'approved', 'pending', 'paid', 'failed', 'frozen', 'released']} />
      <Select name="reconciliationStatus" label="Reconciliation" values={['', 'reconciled', 'pending_data', 'mismatch', 'failed', 'needs_review', 'ignored']} />
      <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5, color: 'var(--t3)', fontSize: 11, fontWeight: 700 }}>
        Campaign
        <select name="campaignId" style={inputStyle}>
          <option value="">All</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </label>
      <button type="submit" style={{ height: 38, border: 0, borderRadius: 10, background: '#6c35ff', color: '#fff', fontWeight: 700 }}>Apply</button>
    </form>
  );
}

function Select({ name, label, values }: { name: string; label: string; values: string[] }) {
  return (
    <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5, color: 'var(--t3)', fontSize: 11, fontWeight: 700 }}>
      {label}
      <select name={name} style={inputStyle}>
        {values.map(v => <option key={v || 'all'} value={v}>{v || 'All'}</option>)}
      </select>
    </label>
  );
}

const inputStyle = {
  height: 38,
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: '0 10px',
  color: 'var(--t1)',
  background: 'var(--s1)',
  fontWeight: 650,
  minWidth: 0,
} as const;

export function PaymentTable({ rows, baseHref = '/admin/payments/campaign-flows' }: { rows: AdminPaymentRow[]; baseHref?: string }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
        <strong>Campaign Payment Ledger</strong>
        <Link href="/api/admin/payments/export?type=campaign-ledger" style={{ color: 'var(--brand-text)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Export CSV</Link>
      </div>
      <div className="kf-table-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--s2)' }}>
              {['Date', 'Campaign', 'Processor', 'Gross', 'Processor Fee', 'Platform Revenue', 'Owner Net', 'Payment', 'Payout', 'Reconciliation', 'Drill-down'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} style={{ borderTop: '1px solid #edf1f7' }}>
                <td style={td}>{new Date(row.created_at).toLocaleDateString()}</td>
                <td style={td}>{row.campaigns?.title ?? row.campaign_id ?? 'Unknown'}</td>
                <td style={td}>{row.processor}</td>
                <td style={td}>{money(row.gross_amount, row.currency)}</td>
                <td style={td}>{money(row.processor_fee_amount, row.currency)}</td>
                <td style={td}>{money(row.platform_fee_amount, row.currency)}</td>
                <td style={td}>{money(row.campaign_owner_net_amount, row.currency)}</td>
                <td style={td}><Pill value={row.payment_status} /></td>
                <td style={td}><Pill value={row.payout_status} /></td>
                <td style={td}><Pill value={row.reconciliation_status} /></td>
                <td style={td}>
                  <Link href={`${baseHref}/${row.campaign_id ?? 'unknown'}/transactions/${row.id}`} style={{ color: 'var(--brand-text)', fontWeight: 700 }}>Open</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={11} style={{ ...td, textAlign: 'center', color: 'var(--t3)', padding: 28 }}>No campaign payment records match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Pill({ value }: { value: string }) {
  const tone = statusTone(value);
  const background =
    tone === 'var(--green-text)' ? 'var(--green-light)' :
    tone === 'var(--red-text)' ? 'var(--red-soft)' :
    tone === 'var(--orange-text)' ? 'var(--orange-soft)' :
    'var(--s2)';
  return <span style={{ display: 'inline-flex', padding: '4px 9px', borderRadius: 999, background, color: tone, fontWeight: 700, whiteSpace: 'nowrap' }}>{value}</span>;
}

const th = { textAlign: 'left', color: 'var(--t3)', fontSize: 11, fontWeight: 700, padding: '10px 12px', whiteSpace: 'nowrap' } as const;
const td = { color: 'var(--t1)', padding: '11px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' } as const;
