import 'server-only';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';

export const dynamic = 'force-dynamic';

function fmtCents(n: number): string {
  const dollars = n / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${dollars.toFixed(2)}`;
}

export default async function FinancePage() {
  await requireAdmin();

  const [donRes, tipRes, feeRes, payoutRes, refundRes, failedRes, pendingPayRes, recentDonRes] = await Promise.all([
    supabaseAdmin.from('donations').select('amount_cents').eq('status', 'completed'),
    supabaseAdmin.from('donations').select('tip_cents').eq('status', 'completed'),
    supabaseAdmin.from('donations').select('processing_fee_cents').eq('status', 'completed'),
    supabaseAdmin.from('payouts').select('amount_cents').eq('status', 'paid'),
    supabaseAdmin.from('donations').select('amount_cents').eq('status', 'refunded'),
    supabaseAdmin.from('donations').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabaseAdmin.from('payouts').select('id', { count: 'exact', head: true }).in('status', ['requested', 'approved']),
    supabaseAdmin
      .from('donations')
      .select('id, amount_cents, tip_cents, processing_fee_cents, status, created_at, stripe_payment_intent_id, campaigns:campaign_id(title)')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  type D = { amount_cents: number };
  type T = { tip_cents: number };
  type F = { processing_fee_cents: number };

  const totalGross = ((donRes.data ?? []) as D[]).reduce((s, d) => s + d.amount_cents, 0);
  const totalTips = ((tipRes.data ?? []) as T[]).reduce((s, d) => s + d.tip_cents, 0);
  const totalFees = ((feeRes.data ?? []) as F[]).reduce((s, d) => s + d.processing_fee_cents, 0);
  const totalPaid = ((payoutRes.data ?? []) as D[]).reduce((s, p) => s + p.amount_cents, 0);
  const totalRefunds = ((refundRes.data ?? []) as D[]).reduce((s, d) => s + d.amount_cents, 0);
  const platformRevenue = totalTips; // tips are platform revenue; platform fee is 0%

  const metrics = [
    { label: 'Gross Donations', value: fmtCents(totalGross), sub: 'all completed', color: 'var(--brand-text)' },
    { label: 'Platform Revenue (Tips)', value: fmtCents(platformRevenue), sub: 'optional donor tips', color: 'var(--green-text)' },
    { label: 'Processing Fees Covered', value: fmtCents(totalFees), sub: 'donor-covered fees', color: 'var(--orange-text)' },
    { label: 'Total Payouts Sent', value: fmtCents(totalPaid), sub: 'paid to organizers', color: '#3b82f6' },
    { label: 'Total Refunded', value: fmtCents(totalRefunds), sub: 'net reversal', color: 'var(--red-text)' },
    // `count` is null when the QUERY FAILS, not when the number is zero. A false
    // "0" on these two is operationally consequential: it reads as "no failed
    // donations to investigate" and "nothing awaiting release", so nobody acts.
    // Same convention as dashboard/settings: render unknown, never a fake 0.
    { label: 'Failed Donations', value: failedRes.count == null ? '—' : String(failedRes.count), sub: 'payment failed', color: 'var(--t3)' },
    { label: 'Pending Payouts', value: pendingPayRes.count == null ? '—' : String(pendingPayRes.count), sub: 'awaiting release', color: 'var(--orange-text)' },
    { label: 'Net to Fundraisers', value: fmtCents(totalGross - totalRefunds), sub: 'gross minus refunds', color: '#0ea5e9' },
  ];

  type DonRow = {
    id: string;
    amount_cents: number;
    tip_cents: number;
    processing_fee_cents: number;
    status: string;
    created_at: string;
    stripe_payment_intent_id: string | null;
    campaigns: { title: string } | null;
  };
  const recentDons = (recentDonRes.data ?? []) as unknown as DonRow[];

  const statusColor: Record<string, string> = {
    completed: '#19b86a',
    pending: '#f59e0b',
    refunded: '#6b7280',
    failed: '#ef4444',
    disputed: '#f97316',
  };

  return (
    <CharitMeShell active="Finance" mode="admin">
      <TopBar
        title="Finance & Ledger"
        subtitle="Real-time platform revenue, payout, and reconciliation view."
        actions={<></>}
      />

      <div className="kf-admin-dash">
        {/* Metrics grid */}
        <div className="kf-metrics">
          {metrics.map(m => (
            <div key={m.label} style={{ background: 'var(--s1)', border: '1px solid #e8ecf4', borderRadius: 14, padding: '20px 24px' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginTop: 4 }}>{m.label}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Recent donations ledger */}
        <div style={{ background: 'var(--s1)', border: '1px solid #e8ecf4', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f4f8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 650 }}>Recent Transactions</h2>
            <a href="/api/admin/payments/export" style={{ fontSize: 13, color: 'var(--brand-text)', fontWeight: 700, textDecoration: 'none' }}>
              Export CSV ↓
            </a>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--s2)' }}>
                  {['Date', 'Campaign', 'Gross', 'Tip', 'Fee Covered', 'Net', 'Status', 'Stripe PI'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--t3)', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentDons.map((d, i) => {
                  // net = gross donation minus any donor-covered processing fee
                  const net = d.amount_cents - (d.processing_fee_cents ?? 0);
                  return (
                    <tr key={d.id} style={{ borderTop: i > 0 ? '1px solid #f0f4f8' : undefined }}>
                      <td style={{ padding: '10px 14px', color: 'var(--t3)', whiteSpace: 'nowrap' }}>
                        {new Date(d.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--t1)', fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(d.campaigns as { title?: string } | null)?.title ?? '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{fmtCents(d.amount_cents)}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--green-text)' }}>{d.tip_cents > 0 ? fmtCents(d.tip_cents) : '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--orange-text)' }}>{d.processing_fee_cents > 0 ? fmtCents(d.processing_fee_cents) : '—'}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--brand-text)' }}>{fmtCents(net)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: (statusColor[d.status] ?? '#6b7280') + '18', color: statusColor[d.status] ?? '#6b7280', padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
                          {d.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--t3)' }}>
                        {d.stripe_payment_intent_id?.slice(0, 20) ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </CharitMeShell>
  );
}
