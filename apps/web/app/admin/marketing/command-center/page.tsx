import 'server-only';
import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../../lib/auth';
import { getCommandCenter, type Delta, type ActivityItem } from '../../../../lib/marketing-command-center';
import type { MarketingGoal, GoalProgress, GoalUnit } from '../../../../lib/marketing-goals';

export const dynamic = 'force-dynamic';

const card: React.CSSProperties = { background: 'var(--s1)', border: '1px solid #eef0f7', borderRadius: 14, padding: '20px 24px' };
const METRIC_LABEL: Record<string, string> = {
  fundraiser_starts: 'New fundraiser starts', donation_volume: 'Donation volume', recurring_donors: 'Recurring donors',
  donation_conversion: 'Donation conversion', verified_charities: 'Verified charities', donor_acquisition_cost: 'Donor acq. cost',
  organizer_retention: 'Organizer retention', aeo_visibility: 'AI / AEO visibility', organic_traffic: 'Organic traffic', custom: 'Custom',
};

function money(cents: number): string { return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`; }
function fmtUnit(v: number | null, unit: GoalUnit | 'count' | 'cents'): string {
  if (v == null) return '—';
  if (unit === 'cents') return money(v);
  if (unit === 'percent') return `${v}%`;
  return v.toLocaleString('en-US');
}
function ago(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default async function CommandCenterPage() {
  await requireAdmin();
  const cc = await getCommandCenter();

  return (
    <CharitMeShell active="Marketing" mode="admin">
      <TopBar
        title="Marketing Command Center"
        subtitle="What changed, what's active, and what's waiting — all on live data. Read-only executive view."
        actions={<div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin/marketing/campaign-plans" style={{ height: 38, display: 'inline-flex', alignItems: 'center', padding: '0 16px', borderRadius: 10, background: 'var(--s2)', color: 'var(--t1)', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Campaigns</Link>
          <Link href="/admin/marketing/opportunities" style={{ height: 38, display: 'inline-flex', alignItems: 'center', padding: '0 16px', borderRadius: 10, background: 'var(--s2)', color: 'var(--t1)', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Opportunities</Link>
          <Link href="/admin/marketing/goals" style={{ height: 38, display: 'inline-flex', alignItems: 'center', padding: '0 16px', borderRadius: 10, background: 'linear-gradient(135deg,#7035ff,#ec39c3)', color: '#fff', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>Goals →</Link>
        </div>}
      />
      <div style={{ padding: '0 20px 48px', maxWidth: 1040 }}>

        {/* What changed (week over week) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, marginBottom: 16 }}>
          {cc.deltas.map((d) => <DeltaCard key={d.label} d={d} />)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
          {/* Active goals */}
          <div style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--t1)' }}>Active goals</div>
              <Link href="/admin/marketing/goals" style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-text)', textDecoration: 'none' }}>Manage →</Link>
            </div>
            {cc.activeGoals.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--t3)' }}>
                No active goals.{cc.goalsAwaitingActivation > 0 ? ` ${cc.goalsAwaitingActivation} draft goal(s) awaiting activation.` : ' Set one on the Goals page.'}
              </div>
            ) : (
              cc.activeGoals.map((g) => <GoalRow key={g.id} g={g} />)
            )}
          </div>

          {/* Right column: needs attention + pulse + freshness */}
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ ...card, background: cc.goalsAwaitingActivation > 0 ? '#fffbeb' : '#fff', borderColor: cc.goalsAwaitingActivation > 0 ? '#fde68a' : '#eef0f7' }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--t1)', marginBottom: 8 }}>Needs your attention</div>
              {cc.goalsAwaitingActivation > 0 ? (
                <Link href="/admin/marketing/goals" style={{ fontSize: 13, color: '#b45309', fontWeight: 700, textDecoration: 'none' }}>
                  {cc.goalsAwaitingActivation} goal(s) awaiting activation →
                </Link>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--t3)' }}>Nothing in the queue. No autonomous actions are enabled, so nothing publishes or spends without you.</div>
              )}
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--t1)', marginBottom: 10 }}>Marketing pulse</div>
              <PulseRow label="Contacts" value={cc.pulse.contacts.toLocaleString()} />
              <PulseRow label="Events (7d)" value={cc.pulse.events7d.toLocaleString()} />
              <PulseRow label="Campaigns sent" value={cc.pulse.campaignsSent.toLocaleString()} />
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--t1)', marginBottom: 10 }}>Data freshness</div>
              <PulseRow label="Latest event" value={ago(cc.freshness.events)} />
              <PulseRow label="Latest donation" value={ago(cc.freshness.donations)} />
            </div>
          </div>
        </div>

        {/* Recent activity feed */}
        <div style={{ ...card, marginTop: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--t1)', marginBottom: 4 }}>Recent activity</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>Every marketing action — human or system — from the audit log.</div>
          {cc.activity.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--t3)' }}>No marketing actions recorded yet.</div>
          ) : (
            cc.activity.map((a) => <ActivityRow key={a.id} a={a} />)
          )}
        </div>

        <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 14, textAlign: 'right' }}>
          Generated {new Date(cc.generatedAt).toLocaleString('en-US')} · live query
        </div>
      </div>
    </CharitMeShell>
  );
}

function DeltaCard({ d }: { d: Delta }) {
  const up = d.changePct != null && d.changePct >= 0;
  const color = d.changePct == null ? '#94a3b8' : up ? '#10b981' : '#ef4444';
  return (
    <div style={card}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{d.label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--t1)', marginTop: 6 }}>{fmtUnit(d.current, d.unit)}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 4 }}>
        {d.changePct == null ? 'no prior-week baseline' : `${up ? '▲' : '▼'} ${Math.abs(d.changePct).toFixed(0)}% vs prior 7d`}
      </div>
    </div>
  );
}

function GoalRow({ g }: { g: MarketingGoal & { progress: GoalProgress } }) {
  const p = g.progress;
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #f5f6fa' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{g.title}</div>
        <div style={{ fontSize: 11, color: 'var(--t3)', whiteSpace: 'nowrap' }}>{METRIC_LABEL[g.target_metric]}</div>
      </div>
      {p.measurable ? (
        <>
          <div style={{ height: 7, background: 'var(--s2)', borderRadius: 6, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ height: '100%', width: `${p.percent ?? 0}%`, background: 'linear-gradient(90deg,#7035ff,#ec39c3)' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>
            {fmtUnit(p.gained, g.unit)} of {fmtUnit(p.target, g.unit)}{p.percent != null ? ` · ${Math.round(p.percent)}%` : ''}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 11, color: '#b45309', marginTop: 5 }}>Measurement pending · target {fmtUnit(p.target, g.unit)}</div>
      )}
    </div>
  );
}

function PulseRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid #f5f6fa' }}>
      <span style={{ color: 'var(--t3)', fontWeight: 600 }}>{label}</span>
      <b style={{ color: 'var(--t1)' }}>{value}</b>
    </div>
  );
}

function ActivityRow({ a }: { a: ActivityItem }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f5f6fa' }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: a.actor === 'system' ? '#6c35ff' : '#64748b', padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase' }}>{a.actor}</span>
      <span style={{ fontSize: 13, color: '#334155', fontWeight: 600, flex: 1 }}>
        {a.action.replaceAll('_', ' ')} <span style={{ color: 'var(--t3)', fontWeight: 500 }}>· {a.summary}</span>
      </span>
      <span style={{ fontSize: 11, color: '#cbd5e1', whiteSpace: 'nowrap' }}>{ago(a.created_at)}</span>
    </div>
  );
}
