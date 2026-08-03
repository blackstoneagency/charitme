import 'server-only';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import { getPricingAnalytics } from '../../../lib/pricing-analytics';

export const dynamic = 'force-dynamic';

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--t1)', marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--t4)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default async function AdminPricingPage() {
  await requireAdmin();
  const a = await getPricingAnalytics(30);

  return (
    <CharitMeShell active="Pricing" mode="admin">
      <TopBar
        title="Pricing & Support Analytics"
        subtitle="How donors respond to optional support, from real donation data (last 30 days). Subscription metrics appear once Stripe billing is live."
        actions={<></>}
      />
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <Stat label="Donations" value={a.donationCount.toLocaleString()} sub={`${a.days}-day window`} />
          <Stat label="Gross donations" value={money(a.grossDonationCents)} sub="to recipients" />
          <Stat label="Support revenue" value={money(a.supportRevenueCents)} sub="optional donor support → CharitMe" />
          <Stat label="Avg donation" value={money(a.averageDonationCents)} />
          <Stat label="Avg support %" value={`${a.averageSupportPercent}%`} sub={`effective ${a.effectiveSupportPercent}%`} />
          <Stat label="Support reduction" value={`${a.supportReductionPercent}%`} sub="below suggested 15%" />
          <Stat label="Zero support" value={`${a.zeroSupportPercent}%`} sub="left no support" />
        </div>

        <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)', marginBottom: 14 }}>Support tier distribution</div>
          {a.donationCount === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--t4)', margin: 0 }}>No completed donations in this window yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {a.buckets.map((b) => (
                <div key={b.label} style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 90, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>{b.label}</div>
                  <div style={{ flex: 1, background: 'var(--s2)', borderRadius: 999, height: 16, overflow: 'hidden' }}>
                    <div style={{ width: `${b.share}%`, height: '100%', background: 'var(--violet, #6c35ff)', transition: 'width .3s' }} />
                  </div>
                  <div style={{ width: 96, textAlign: 'right', fontSize: 13, color: 'var(--t3)', fontVariantNumeric: 'tabular-nums' }}>
                    {b.share}% · {b.count.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p style={{ fontSize: 12, color: 'var(--t4)', margin: 0 }}>
          Platform fee is 0% by design, so CharitMe&apos;s donation-side revenue is entirely optional donor
          support. MRR / ARR / LTV / CAC and conversion-funnel metrics are added once subscription billing
          is wired (see <code>todo.md</code> C4/C7).
        </p>
      </div>
    </CharitMeShell>
  );
}
