import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CharitMeShell, TopBar } from '../../../../../../../components/CharitMeShellServer';
import { getPaymentDetail, money } from '../../../../../../../lib/payment-admin-data';
import { Pill } from '../../../../_components/PaymentAdminParts';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ campaignId: string; transactionId: string }>;
};

export default async function TransactionDetailPage({ params }: PageProps): Promise<JSX.Element> {
  const { campaignId, transactionId } = await params;
  const detail = await getPaymentDetail(transactionId);
  if (!detail.payment || detail.payment.campaign_id !== campaignId) notFound();
  const payment = detail.payment;

  const timeline = [
    ['Donor paid', payment.payment_status === 'succeeded' || payment.payment_status === 'refunded' || payment.payment_status === 'partially_refunded'],
    ['Processor captured payment', Boolean(payment.processor_charge_id || payment.processor_payment_intent_id)],
    ['Processor deducted fee', payment.processor_fee_amount > 0],
    ['ChartiMe.com platform fee recorded', payment.platform_fee_amount > 0],
    ['Campaign owner transfer created', payment.transfer_status === 'created' || payment.transfer_status === 'paid'],
    ['Campaign owner payout pending', payment.payout_status === 'requested' || payment.payout_status === 'pending'],
    ['Campaign owner payout completed', payment.payout_status === 'paid'],
  ] as const;

  return (
    <CharitMeShell active="Payment Flows" mode="admin">
      <TopBar title="Transaction Drill-Down" subtitle="Donor checkout to processor objects, fees, owner transfer, payout, and reconciliation." />
      <div className="kf-admin-dash">
        <section style={panel}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <Metric label="Gross" value={money(payment.gross_amount, payment.currency)} />
            <Metric label="Processor Fee" value={money(payment.processor_fee_amount, payment.currency)} />
            <Metric label="Platform Revenue" value={money(payment.platform_fee_amount, payment.currency)} />
            <Metric label="Owner Net" value={money(payment.campaign_owner_net_amount, payment.currency)} />
            <Metric label="Refunded" value={money(payment.refunded_amount, payment.currency)} />
            <Metric label="Disputed" value={money(payment.disputed_amount, payment.currency)} />
          </div>
        </section>

        <section style={panel}>
          <h2 style={h2}>Status</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Pill value={payment.payment_status} />
            <Pill value={payment.transfer_status} />
            <Pill value={payment.payout_status} />
            <Pill value={payment.refund_status} />
            <Pill value={payment.dispute_status} />
            <Pill value={payment.reconciliation_status} />
          </div>
          {payment.reconciliation_reason && <p style={muted}>Reconciliation reason: {payment.reconciliation_reason}</p>}
        </section>

        <section style={panel}>
          <h2 style={h2}>Money Movement</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {timeline.map(([label, complete], index) => (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '30px 1fr', gap: 10, alignItems: 'center' }}>
                <span style={{ width: 24, height: 24, borderRadius: 999, display: 'grid', placeItems: 'center', background: complete ? 'var(--tint-green)' : 'var(--tint-red)', color: complete ? 'var(--green-text)' : '#b91c1c', fontWeight: 700 }}>{index + 1}</span>
                <span style={{ color: 'var(--t1)', fontWeight: 650 }}>{label}{complete ? '' : ' missing or pending'}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={panel}>
          <h2 style={h2}>Processor Object IDs</h2>
          <ObjectRow label="Payment Intent" value={payment.processor_payment_intent_id} />
          <ObjectRow label="Checkout Session" value={payment.processor_checkout_session_id} />
          <ObjectRow label="Transfer" value={payment.processor_transfer_id} />
          <ObjectRow label="Payout" value={payment.processor_payout_id} />
          <Link href={`https://dashboard.stripe.com/payments/${payment.processor_payment_intent_id ?? ''}`} style={{ color: 'var(--brand-text)', fontWeight: 700, textDecoration: 'none' }}>Open processor dashboard</Link>
        </section>

        <section style={panel}>
          <h2 style={h2}>Event Timeline</h2>
          <Rows rows={detail.events.map(event => [new Date(event.occurred_at).toLocaleString(), event.event_type, event.event_status, money(event.amount, event.currency), event.processor_object_id ?? '-'])} />
        </section>

        <section style={panel}>
          <h2 style={h2}>Webhook Events</h2>
          <Rows rows={detail.webhookEvents.map(event => [new Date(event.created_at).toLocaleString(), event.event_type, event.status, event.processor_event_id, event.processor_object_id ?? '-'])} />
        </section>

        <section style={panel}>
          <h2 style={h2}>Admin Notes</h2>
          <Rows rows={detail.notes.map(note => [new Date(note.created_at).toLocaleString(), note.status, note.note])} empty="No admin notes recorded." />
        </section>
      </div>
    </CharitMeShell>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <strong style={{ display: 'block', color: 'var(--t1)', fontSize: 22 }}>{value}</strong>
      <span style={{ color: 'var(--t3)', fontSize: 12, fontWeight: 700 }}>{label}</span>
    </div>
  );
}

function ObjectRow({ label, value }: { label: string; value: string | null }): JSX.Element {
  return <p style={muted}><strong>{label}:</strong> <code>{value ?? 'pending'}</code></p>;
}

function Rows({ rows, empty = 'No records.' }: { rows: string[][]; empty?: string }): JSX.Element {
  if (rows.length === 0) return <p style={muted}>{empty}</p>;
  return (
    /* Scrolls horizontally and contains no focusable content, so without tabIndex its
       off-screen columns cannot be reached by keyboard (axe scrollable-region-focusable).
       A JS comment, not {/* … *\/}: this sits in a JSX *expression* position. */
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div className="kf-table-scroll" style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label="Transaction rows">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.join('|')} style={{ borderTop: index > 0 ? '1px solid #edf1f7' : undefined }}>
              {row.map(cell => <td key={cell} style={{ padding: '10px 12px', color: 'var(--t1)', whiteSpace: 'nowrap' }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const panel = { background: 'var(--s1)', border: '1px solid #e8ecf4', borderRadius: 16, padding: 18 } as const;
const h2 = { margin: '0 0 12px', color: 'var(--t1)', fontSize: 16 } as const;
const muted = { color: 'var(--t3)', fontSize: 13, fontWeight: 600 } as const;
