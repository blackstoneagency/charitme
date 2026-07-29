'use client';

import React, { useCallback, useEffect, useState } from 'react';

/* ── shared styles (match AdminMarketingClient) ── */
const card: React.CSSProperties = { background: 'var(--s1)', border: '1px solid #eef0f7', borderRadius: 14, padding: '20px 24px', marginBottom: 16 };
const btn: React.CSSProperties = { padding: '9px 18px', background: '#6c35ff', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 650, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '7px 14px', background: 'var(--s2)', color: 'var(--t1)', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const input: React.CSSProperties = { padding: '10px 14px', borderRadius: 9, border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 };

const METRIC_LABEL: Record<string, string> = {
  fundraiser_starts: 'New fundraiser starts', donation_volume: 'Donation volume', recurring_donors: 'Recurring donors',
  donation_conversion: 'Donation conversion rate', verified_charities: 'Verified charity signups',
  donor_acquisition_cost: 'Donor acquisition cost', organizer_retention: 'Organizer retention',
  aeo_visibility: 'AI / AEO visibility', organic_traffic: 'Organic traffic', custom: 'Custom metric',
};
const PRIORITY_COLOR: Record<string, string> = { low: '#94a3b8', medium: '#3b82f6', high: '#f59e0b', critical: '#ef4444' };
const STATUS_COLOR: Record<string, string> = { draft: '#94a3b8', active: '#10b981', paused: '#f59e0b', achieved: '#6c35ff', missed: '#ef4444', archived: '#cbd5e1' };
const AUTONOMY: Record<number, string> = { 1: 'L1 · Recommend', 2: 'L2 · Create', 3: 'L3 · Guardrailed', 4: 'L4 · Exception-based' };

interface Progress { metric: string; measurable: boolean; current: number | null; target: number | null; baseline: number | null; gained: number | null; percent: number | null; note: string }
interface Goal {
  id: string; title: string; objective: string | null; target_metric: string; unit: string;
  baseline_value: number | null; target_value: number | null; deadline: string | null; priority: string;
  geography: string | null; audience: string | null; category: string | null; channels: string[];
  autonomy_level: number; status: string; created_at: string; progress: Progress;
}
interface Draft {
  title: string; objective: string; target_metric: string; unit: string; target_value: number | null;
  deadline: string | null; priority: string; geography: string | null; category: string | null;
  audience: string | null; channels: string[]; natural_language_input: string;
}

function fmt(v: number | null, unit: string): string {
  if (v == null) return '—';
  if (unit === 'cents') return `$${(v / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (unit === 'percent') return `${v}%`;
  return v.toLocaleString('en-US');
}

export default function GoalsClient() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 5000); };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/admin/marketing/goals', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setGoals(j.goals ?? []);
    } catch {
      setError('Could not load goals. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates occur after fetch resolves
  useEffect(() => { void load(); }, [load]);

  const preview = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/marketing/goals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, preview: true }),
      });
      const j = await r.json();
      if (j.draft) setDraft(j.draft);
      else flash('❌ Could not parse that objective.');
    } catch { flash('❌ Something went wrong.'); }
    finally { setBusy(false); }
  };

  const create = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/marketing/goals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!r.ok) throw new Error();
      setDraft(null); setText('');
      flash('✅ Goal created.');
      await load();
    } catch { flash('❌ Could not create the goal.'); }
    finally { setBusy(false); }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    try {
      const r = await fetch(`/api/admin/marketing/goals?id=${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      const j = await r.json();
      const updated: Goal | undefined = j.goal;
      setGoals((gs) =>
        !updated || updated.status === 'archived'
          ? gs.filter((g) => g.id !== id)
          : gs.map((g) => (g.id === id ? updated : g)),
      );
      flash('✅ Updated.');
    } catch { flash('❌ Update failed.'); }
  };

  return (
    <div style={{ padding: '0 20px 48px', maxWidth: 900 }}>
      {notice && <div style={{ ...card, padding: '12px 18px', background: notice.startsWith('❌') ? '#fff0f3' : '#f0fdf4', borderColor: notice.startsWith('❌') ? '#fecdd3' : '#bbf7d0', fontWeight: 700, fontSize: 13, color: notice.startsWith('❌') ? '#be123c' : '#15803d' }}>{notice}</div>}

      {/* ── Goal composer ── */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', marginBottom: 4 }}>Set a marketing goal</div>
        <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 14 }}>
          e.g. “Grow verified education fundraisers in New Jersey by 15% before year-end” or “Generate more recurring donors for animal rescue campaigns.”
        </div>
        <textarea
          aria-label="Describe the marketing goal in plain language" value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe the outcome you want…"
          rows={2}
          style={{ ...input, resize: 'vertical', marginBottom: 10 }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={preview} disabled={busy || !text.trim()} style={{ ...btn, opacity: busy || !text.trim() ? 0.5 : 1 }}>
            {busy ? 'Analyzing…' : 'Analyze objective →'}
          </button>
          {draft && <button onClick={() => setDraft(null)} style={btnGhost}>Discard draft</button>}
        </div>

        {draft && (
          <div style={{ marginTop: 16, padding: 16, background: 'var(--s2)', border: '1px solid #e9deff', borderRadius: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand-text)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Review draft — edit before saving</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
              <div><span style={label}>Title</span><input style={input} aria-label="Goal title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
              <div>
                <span style={label}>Metric</span>
                <select style={input} aria-label="Target metric" value={draft.target_metric} onChange={(e) => setDraft({ ...draft, target_metric: e.target.value })}>
                  {Object.entries(METRIC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <span style={label}>Target ({draft.unit === 'cents' ? '$' : draft.unit})</span>
                <input aria-label="Target value" style={input} type="number" value={draft.unit === 'cents' && draft.target_value != null ? draft.target_value / 100 : draft.target_value ?? ''} onChange={(e) => {
                  const raw = e.target.value === '' ? null : Number(e.target.value);
                  setDraft({ ...draft, target_value: raw == null ? null : draft.unit === 'cents' ? Math.round(raw * 100) : raw });
                }} />
              </div>
              <div><span style={label}>Deadline</span><input aria-label="Deadline" style={input} type="date" value={draft.deadline ?? ''} onChange={(e) => setDraft({ ...draft, deadline: e.target.value || null })} /></div>
              <div>
                <span style={label}>Priority</span>
                <select style={input} aria-label="Priority" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
                  {['low', 'medium', 'high', 'critical'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div><span style={label}>Geography</span><input aria-label="Geography" style={input} value={draft.geography ?? ''} onChange={(e) => setDraft({ ...draft, geography: e.target.value || null })} /></div>
              <div><span style={label}>Category</span><input aria-label="Category" style={input} value={draft.category ?? ''} onChange={(e) => setDraft({ ...draft, category: e.target.value || null })} /></div>
              <div><span style={label}>Audience</span><input aria-label="Audience" style={input} value={draft.audience ?? ''} onChange={(e) => setDraft({ ...draft, audience: e.target.value || null })} /></div>
            </div>
            {draft.channels.length > 0 && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--t3)' }}>Channels detected: {draft.channels.join(', ')}</div>}
            <button onClick={create} disabled={busy} style={{ ...btn, marginTop: 14, opacity: busy ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Create goal'}</button>
          </div>
        )}
      </div>

      {/* ── Goals list ── */}
      {loading ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Loading goals…</div>
      ) : error ? (
        <div style={{ ...card, background: '#fff0f3', borderColor: '#fecdd3', color: '#be123c' }}>
          {error} <button onClick={load} style={{ ...btnGhost, marginLeft: 8 }}>Retry</button>
        </div>
      ) : goals.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#475569', marginBottom: 6 }}>No goals yet</div>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>Describe an outcome above to create your first measurable marketing goal.</div>
        </div>
      ) : (
        goals.map((g) => <GoalCard key={g.id} g={g} onPatch={patch} />)
      )}
    </div>
  );
}

function GoalCard({ g, onPatch }: { g: Goal; onPatch: (id: string, body: Record<string, unknown>) => void }) {
  const p = g.progress;
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>{g.title}</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>
            {METRIC_LABEL[g.target_metric]}
            {g.geography ? ` · ${g.geography}` : ''}{g.category ? ` · ${g.category}` : ''}{g.audience ? ` · ${g.audience}` : ''}
            {g.deadline ? ` · due ${g.deadline}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: PRIORITY_COLOR[g.priority], padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase' }}>{g.priority}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)' }}>{AUTONOMY[g.autonomy_level]}</span>
        </div>
      </div>

      {/* progress */}
      <div style={{ marginTop: 14 }}>
        {p.measurable ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
              <span style={{ color: '#475569', fontWeight: 700 }}>
                {fmt(p.gained, g.unit)} of {fmt(p.target, g.unit)} {p.percent != null ? `(${Math.round(p.percent)}%)` : ''}
              </span>
              <span style={{ color: 'var(--t3)' }}>since goal set</span>
            </div>
            <div style={{ height: 8, background: 'var(--s2)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${p.percent ?? 0}%`, background: 'linear-gradient(90deg,#7035ff,#ec39c3)', borderRadius: 6 }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 5 }}>{p.note}</div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px' }}>
            Measurement pending — {p.note} Target: {fmt(p.target, g.unit)}.
          </div>
        )}
      </div>

      {/* status controls */}
      <div style={{ display: 'flex', gap: 6, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: STATUS_COLOR[g.status], padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase' }}>{g.status}</span>
        {g.status === 'draft' && <button onClick={() => onPatch(g.id, { status: 'active' })} style={btnGhost}>Activate</button>}
        {g.status === 'active' && <button onClick={() => onPatch(g.id, { status: 'paused' })} style={btnGhost}>Pause</button>}
        {g.status === 'paused' && <button onClick={() => onPatch(g.id, { status: 'active' })} style={btnGhost}>Resume</button>}
        {(g.status === 'active' || g.status === 'paused') && <button onClick={() => onPatch(g.id, { status: 'achieved' })} style={btnGhost}>Mark achieved</button>}
        <GenerateCampaignButton goalId={g.id} />
        <button onClick={() => onPatch(g.id, { status: 'archived' })} style={{ ...btnGhost, color: 'var(--t3)', marginLeft: 'auto' }}>Archive</button>
      </div>
    </div>
  );
}

function GenerateCampaignButton({ goalId }: { goalId: string }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/marketing/campaign-plans', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal_id: goalId }),
      });
      if (!r.ok) throw new Error();
      const j = await r.json();
      window.location.href = `/admin/marketing/campaign-plans?id=${j.plan.id}`;
    } catch { setBusy(false); }
  };
  return <button onClick={go} disabled={busy} style={{ ...btnGhost, color: 'var(--brand-text)', borderColor: '#e9deff', opacity: busy ? 0.6 : 1 }}>{busy ? 'Generating…' : 'Generate campaign →'}</button>;
}
