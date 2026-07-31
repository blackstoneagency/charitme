'use client';

import React, { useCallback, useEffect, useState } from 'react';

const card: React.CSSProperties = { background: 'var(--s1)', border: '1px solid #eef0f7', borderRadius: 14, padding: '18px 22px', marginBottom: 14 };
const btn: React.CSSProperties = { padding: '9px 18px', background: '#6c35ff', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 650, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '7px 14px', background: 'var(--s2)', color: 'var(--t1)', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const input: React.CSSProperties = { padding: '9px 12px', borderRadius: 9, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

const CHANNEL_LABEL: Record<string, string> = { web: 'Web', email: 'Email', social: 'Social', search: 'Search', sms: 'SMS', paid: 'Paid' };
const STATUS_COLOR: Record<string, string> = { draft: '#94a3b8', in_review: '#f59e0b', approved: '#10b981', archived: '#cbd5e1' };

interface Plan { id: string; goal_id: string | null; title: string; objective: string | null; summary: string | null; audience: string | null; geography: string | null; category: string | null; status: string; asset_count?: number; created_at: string }
interface Asset { id: string; plan_id: string; asset_type: string; channel: string; title: string; body: string; status: string; sort_order: number }
interface GoalLite { id: string; title: string; status: string }

export default function CampaignPlansClient({ planId }: { planId: string | null }) {
  return planId ? <Detail planId={planId} /> : <ListView />;
}

/* ─────────── List + generate ─────────── */
function ListView() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [goals, setGoals] = useState<GoalLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selGoal, setSelGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 5000); };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [pr, gr] = await Promise.all([
        fetch('/api/admin/marketing/campaign-plans', { cache: 'no-store' }),
        fetch('/api/admin/marketing/goals', { cache: 'no-store' }),
      ]);
      if (!pr.ok) throw new Error();
      setPlans((await pr.json()).plans ?? []);
      if (gr.ok) setGoals(((await gr.json()).goals ?? []).map((g: GoalLite) => ({ id: g.id, title: g.title, status: g.status })));
    } catch { setError('Could not load campaign plans.'); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates occur after fetch resolves
  useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    if (!selGoal) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/marketing/campaign-plans', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal_id: selGoal }),
      });
      if (!r.ok) throw new Error();
      const j = await r.json();
      window.location.href = `/admin/marketing/campaign-plans?id=${j.plan.id}`;
    } catch { flash('❌ Generation failed.'); setBusy(false); }
  };

  return (
    <div style={{ padding: '0 20px 48px', maxWidth: 900 }}>
      {notice && <div style={{ ...card, padding: '12px 18px', background: 'var(--tint-rose)', borderColor: '#fecdd3', color: 'var(--red-text)', fontWeight: 700, fontSize: 13 }}>{notice}</div>}

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', marginBottom: 6 }}>Generate a campaign from a goal</div>
        <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 12 }}>Pick a goal — the OS assembles a connected set of draft assets across every channel, linked to that goal.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select aria-label="Goal to generate a campaign plan from" value={selGoal} onChange={(e) => setSelGoal(e.target.value)} style={{ ...input, maxWidth: 460 }}>
            <option value="">Select a goal…</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
          <button onClick={generate} disabled={busy || !selGoal} style={{ ...btn, opacity: busy || !selGoal ? 0.5 : 1 }}>{busy ? 'Generating…' : 'Generate campaign'}</button>
        </div>
        {goals.length === 0 && !loading && <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>No goals yet — create one on the Goals page first.</div>}
      </div>

      {loading ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Loading…</div>
      ) : error ? (
        <div style={{ ...card, background: 'var(--tint-rose)', borderColor: '#fecdd3', color: 'var(--red-text)' }}>{error} <button onClick={load} style={{ ...btnGhost, marginLeft: 8 }}>Retry</button></div>
      ) : plans.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t2)', marginBottom: 6 }}>No campaign plans yet</div>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>Generate one from a goal above.</div>
        </div>
      ) : (
        plans.map((p) => (
          <a key={p.id} href={`/admin/marketing/campaign-plans?id=${p.id}`} style={{ ...card, display: 'block', textDecoration: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>{p.title}</div>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: STATUS_COLOR[p.status], padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase', height: 'fit-content' }}>{p.status.replace('_', ' ')}</span>
            </div>
            {p.summary && <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 5, lineHeight: 1.5 }}>{p.summary}</div>}
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>{p.asset_count ?? 0} assets · {new Date(p.created_at).toLocaleDateString('en-US')}</div>
          </a>
        ))
      )}
    </div>
  );
}

/* ─────────── Detail ─────────── */
function Detail({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 5000); };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`/api/admin/marketing/campaign-plans?id=${planId}`, { cache: 'no-store' });
      if (!r.ok) throw new Error();
      const j = await r.json();
      setPlan(j.plan); setAssets(j.assets ?? []);
    } catch { setError('Could not load this campaign plan.'); }
    finally { setLoading(false); }
  }, [planId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates occur after fetch resolves
  useEffect(() => { void load(); }, [load]);

  const setPlanStatus = async (status: string) => {
    try {
      const r = await fetch(`/api/admin/marketing/campaign-plans?id=${planId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error();
      setPlan((await r.json()).plan);
      flash('✅ Plan updated.');
    } catch { flash('❌ Update failed.'); }
  };

  const saveAsset = async (id: string, body: Record<string, unknown>, msg: string) => {
    try {
      const r = await fetch(`/api/admin/marketing/campaign-plans/assets?id=${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      const updated: Asset = (await r.json()).asset;
      setAssets((as) => as.map((a) => (a.id === id ? updated : a)));
      flash(msg);
    } catch { flash('❌ Save failed.'); }
  };

  if (loading) return <div style={{ padding: 20 }}><div style={{ ...card, textAlign: 'center', color: 'var(--t3)' }}>Loading…</div></div>;
  if (error || !plan) return <div style={{ padding: 20 }}><div style={{ ...card, background: 'var(--tint-rose)', borderColor: '#fecdd3', color: 'var(--red-text)' }}>{error || 'Not found.'} <button onClick={load} style={{ ...btnGhost, marginLeft: 8 }}>Retry</button></div></div>;

  const approvedCount = assets.filter((a) => a.status === 'approved').length;

  return (
    <div style={{ padding: '0 20px 48px', maxWidth: 900 }}>
      {notice && <div style={{ ...card, padding: '12px 18px', background: notice.startsWith('❌') ? 'var(--tint-red)' : '#f0fdf4', borderColor: notice.startsWith('❌') ? '#fecdd3' : '#bbf7d0', fontWeight: 700, fontSize: 13, color: notice.startsWith('❌') ? 'var(--red-text)' : 'var(--green-text)' }}>{notice}</div>}

      <a href="/admin/marketing/campaign-plans" style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-text)', textDecoration: 'none' }}>← All plans</a>

      <div style={{ ...card, marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)' }}>{plan.title}</div>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: STATUS_COLOR[plan.status], padding: '4px 10px', borderRadius: 20, textTransform: 'uppercase', height: 'fit-content' }}>{plan.status.replace('_', ' ')}</span>
        </div>
        {plan.summary && <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 6, lineHeight: 1.5 }}>{plan.summary}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {plan.status === 'draft' && <button onClick={() => setPlanStatus('in_review')} style={btnGhost}>Send to review</button>}
          {plan.status === 'in_review' && <button onClick={() => setPlanStatus('approved')} style={btn}>Approve plan</button>}
          {plan.status === 'approved' && <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>Approved · {approvedCount}/{assets.length} assets approved</span>}
          {plan.status !== 'draft' && plan.status !== 'approved' && <button onClick={() => setPlanStatus('draft')} style={btnGhost}>Back to draft</button>}
        </div>
        <div style={{ fontSize: 11, color: '#b45309', background: 'var(--tint-amber)', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginTop: 12 }}>
          Assets are drafts for review. External publishing (social/email/ads) requires connected channels, which aren’t enabled — approve here, then export/publish once connectors exist.
        </div>
      </div>

      {assets.map((a) => <AssetCard key={a.id} a={a} save={saveAsset} />)}
    </div>
  );
}

function AssetCard({ a, save }: { a: Asset; save: (id: string, body: Record<string, unknown>, msg: string) => void }) {
  const [body, setBody] = useState(a.body);
  const [editing, setEditing] = useState(false);
  const dirty = body !== a.body;
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand-text)', background: '#f3edff', padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>{CHANNEL_LABEL[a.channel] ?? a.channel}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)', marginLeft: 10 }}>{a.title}</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: STATUS_COLOR[a.status] ?? '#94a3b8', padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase', height: 'fit-content' }}>{a.status}</span>
      </div>

      {editing ? (
        <textarea aria-label="Asset content" value={body} onChange={(e) => setBody(e.target.value)} rows={Math.min(18, Math.max(5, body.split('\n').length + 1))} style={{ ...input, fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.5, resize: 'vertical' }} />
      ) : (
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.5, color: '#334155', margin: 0, background: '#fafbfd', border: '1px solid #f1f5f9', borderRadius: 8, padding: 12, maxHeight: 260, overflow: 'auto' }}>{a.body}</pre>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        {!editing && <button onClick={() => setEditing(true)} style={btnGhost}>Edit</button>}
        {editing && <button onClick={() => { save(a.id, { body }, '✅ Saved.'); setEditing(false); }} disabled={!dirty} style={{ ...btn, opacity: dirty ? 1 : 0.5 }}>Save</button>}
        {editing && <button onClick={() => { setBody(a.body); setEditing(false); }} style={btnGhost}>Cancel</button>}
        {a.status !== 'approved' && <button onClick={() => save(a.id, { status: 'approved' }, '✅ Approved.')} style={{ ...btnGhost, color: '#10b981' }}>Approve</button>}
        {a.status === 'approved' && <button onClick={() => save(a.id, { status: 'draft' }, '↩ Reopened.')} style={btnGhost}>Reopen</button>}
      </div>
    </div>
  );
}
