'use client';

import React, { useCallback, useEffect, useState } from 'react';

const card: React.CSSProperties = { background: 'var(--s1)', border: '1px solid #eef0f7', borderRadius: 14, padding: '18px 22px', marginBottom: 14 };
const btn: React.CSSProperties = { padding: '9px 18px', background: '#6c35ff', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 650, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '7px 14px', background: 'var(--s2)', color: 'var(--t1)', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' };

const METRIC_LABEL: Record<string, string> = {
  fundraiser_starts: 'Fundraiser starts', donation_volume: 'Donation volume', recurring_donors: 'Recurring donors',
  donation_conversion: 'Conversion', verified_charities: 'Verified charities', donor_acquisition_cost: 'Donor acq. cost',
  organizer_retention: 'Organizer retention', aeo_visibility: 'AI/AEO visibility', organic_traffic: 'Organic traffic', custom: 'Custom',
};
const STATUS_COLOR: Record<string, string> = { new: '#3b82f6', accepted: '#10b981', rejected: '#ef4444', deferred: '#f59e0b', converted: '#6c35ff', archived: '#cbd5e1' };

interface Opportunity {
  id: string; title: string; description: string | null; rationale: string | null;
  evidence: Record<string, number | string>; category: string | null; geography: string | null; audience: string | null;
  target_metric: string; est_impact_cents: number | null; est_starts: number | null; confidence: number | null;
  effort: string; time_to_value_days: number | null; score: number; status: string; source: string;
  linked_goal_id: string | null;
}

const money = (c: number | null) => c == null ? '—' : `$${(c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function OpportunitiesClient() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 5000); };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/admin/marketing/opportunities', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      const j = await r.json();
      setOpps(j.opportunities ?? []);
    } catch { setError('Could not load opportunities.'); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates occur after fetch resolves
  useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/marketing/opportunities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate' }),
      });
      if (!r.ok) throw new Error();
      const j = await r.json();
      setOpps(j.opportunities ?? []);
      flash(j.generated > 0 ? `✅ ${j.generated} opportunit${j.generated === 1 ? 'y' : 'ies'} scored from live data.` : 'ℹ️ No opportunities surfaced — not enough recent campaign signal yet.');
    } catch { flash('❌ Generation failed.'); }
    finally { setBusy(false); }
  };

  const act = async (id: string, body: Record<string, unknown>, msg: string) => {
    try {
      const r = await fetch(`/api/admin/marketing/opportunities?id=${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      const j = await r.json();
      const updated: Opportunity = j.opportunity;
      setOpps((os) => updated.status === 'archived' || updated.status === 'rejected' ? os.filter((o) => o.id !== id) : os.map((o) => (o.id === id ? updated : o)));
      flash(j.goal_id ? `✅ Goal created from opportunity. Open Goals to activate it.` : msg);
    } catch { flash('❌ Action failed.'); }
  };

  return (
    <div style={{ padding: '0 20px 48px', maxWidth: 900 }}>
      {notice && <div style={{ ...card, padding: '12px 18px', background: notice.startsWith('❌') ? 'var(--tint-red)' : '#f0fdf4', borderColor: notice.startsWith('❌') ? '#fecdd3' : '#bbf7d0', fontWeight: 700, fontSize: 13, color: notice.startsWith('❌') ? 'var(--red-text)' : 'var(--green-text)' }}>{notice}</div>}

      <div style={{ ...card, display: 'flex', minWidth: 0, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>Opportunity feed</div>
          <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 3 }}>Derived from real campaign category momentum over the last 60 days. Estimates are labelled — never presented as fact.</div>
        </div>
        <button onClick={generate} disabled={busy} style={{ ...btn, opacity: busy ? 0.5 : 1 }}>{busy ? 'Scanning live data…' : 'Generate from live data'}</button>
      </div>

      {loading ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Loading…</div>
      ) : error ? (
        <div style={{ ...card, background: 'var(--tint-rose)', borderColor: '#fecdd3', color: 'var(--red-text)' }}>{error} <button onClick={load} style={{ ...btnGhost, marginLeft: 8 }}>Retry</button></div>
      ) : opps.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t2)', marginBottom: 6 }}>No opportunities yet</div>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>Click “Generate from live data” to scan campaign momentum and surface scored opportunities.</div>
        </div>
      ) : (
        opps.map((o) => <OppCard key={o.id} o={o} act={act} />)
      )}
    </div>
  );
}

function OppCard({ o, act }: { o: Opportunity; act: (id: string, body: Record<string, unknown>, msg: string) => void }) {
  const scoreColor = o.score >= 66 ? '#10b981' : o.score >= 33 ? '#f59e0b' : '#94a3b8';
  return (
    <div style={card}>
      <div style={{ display: 'flex', minWidth: 0, gap: 14, alignItems: 'flex-start' }}>
        <div style={{ textAlign: 'center', minWidth: 54 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: scoreColor }}>{o.score}</div>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>score</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', minWidth: 0, justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>{o.title}</div>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: STATUS_COLOR[o.status], padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase', height: 'fit-content' }}>{o.status}</span>
          </div>
          {o.description && <div style={{ fontSize: 13, color: '#475569', marginTop: 5, lineHeight: 1.5 }}>{o.description}</div>}
          {o.rationale && <div style={{ fontSize: 12, color: 'var(--brand-text)', marginTop: 6, fontWeight: 600 }}>Why: {o.rationale}</div>}

          <div style={{ display: 'flex', minWidth: 0, gap: 16, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: 'var(--t3)' }}>
            <span><b style={{ color: '#334155' }}>{METRIC_LABEL[o.target_metric]}</b></span>
            {o.category && <span>· {o.category}</span>}
            <span>· Est. impact <b style={{ color: '#334155' }}>{money(o.est_impact_cents)}</b> <span style={{ color: '#cbd5e1' }}>(estimate)</span></span>
            {o.confidence != null && <span>· Confidence {Math.round(o.confidence * 100)}%</span>}
            <span>· Effort {o.effort}</span>
            {o.time_to_value_days != null && <span>· ~{o.time_to_value_days}d to value</span>}
          </div>

          {/* actions */}
          <div style={{ display: 'flex', minWidth: 0, gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {o.status !== 'converted' && !o.linked_goal_id && (
              <button onClick={() => act(o.id, { convert: true }, '')} style={btn}>Convert to goal →</button>
            )}
            {o.status === 'new' && <button onClick={() => act(o.id, { status: 'accepted' }, '✅ Accepted.')} style={btnGhost}>Accept</button>}
            {o.status === 'new' && <button onClick={() => act(o.id, { status: 'deferred' }, '✅ Deferred.')} style={btnGhost}>Defer</button>}
            {o.status !== 'rejected' && o.status !== 'converted' && <button onClick={() => act(o.id, { status: 'rejected' }, '✅ Rejected.')} style={{ ...btnGhost, color: 'var(--red-text)' }}>Reject</button>}
            {o.linked_goal_id && <span style={{ fontSize: 12, color: 'var(--brand-text)', fontWeight: 700, alignSelf: 'center' }}>Linked to a goal ✓</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
