'use client';

import React, { useEffect, useState } from 'react';

interface Grant {
  id: string;
  slug: string;
  title: string;
  funder_name: string;
  funder_type: string;
  category: string | null;
  summary: string | null;
  focus_areas: string[];
  eligible_entity_types: string[];
  amount_min: number | null;
  amount_max: number | null;
  currency: string;
  application_url: string | null;
  deadline_at: string | null;
  rolling_deadline: boolean;
  status: string;
  verified: boolean;
}

const FUNDER_TYPES = ['foundation', 'government', 'corporate', 'community', 'individual', 'other'];
const STATUSES = ['open', 'upcoming', 'closed'];

const input: React.CSSProperties = {
  padding: '9px 11px', border: '1px solid #e2e5ee', borderRadius: 9, fontSize: 13,
  background: 'var(--s1)', color: 'var(--t1)', width: '100%', boxSizing: 'border-box',
};
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--t3)', marginBottom: 4, display: 'block' };

function dollarsToCents(v: string): number | null {
  const n = parseFloat(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
function centsToDollars(c: number | null): string {
  return c == null ? '' : String(Math.round(c / 100));
}

const emptyForm = {
  title: '', funderName: '', funderType: 'foundation', category: '', summary: '', description: '',
  focusAreas: '', eligibility: '', eligibleEntityTypes: '', amountMin: '', amountMax: '',
  location: '', country: '', applicationUrl: '', deadlineAt: '', status: 'open', verified: false,
};

export default function AdminGrantsClient() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function load() {
    return fetch('/api/admin/grants')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((j) => { setGrants(j.grants ?? []); setLoading(false); })
      .catch(() => { setMsg({ kind: 'err', text: 'Failed to load grants' }); setLoading(false); });
  }

  useEffect(() => {
    fetch('/api/admin/grants')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((j) => { setGrants(j.grants ?? []); setLoading(false); })
      .catch(() => { setMsg({ kind: 'err', text: 'Failed to load grants' }); setLoading(false); });
  }, []);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function resetForm() { setForm({ ...emptyForm }); setEditId(null); }

  function startEdit(g: Grant) {
    setEditId(g.id);
    setForm({
      title: g.title, funderName: g.funder_name, funderType: g.funder_type, category: g.category ?? '',
      summary: g.summary ?? '', description: '', focusAreas: g.focus_areas.join(', '),
      eligibility: '', eligibleEntityTypes: g.eligible_entity_types.join(', '),
      amountMin: centsToDollars(g.amount_min), amountMax: centsToDollars(g.amount_max),
      location: '', country: '', applicationUrl: g.application_url ?? '',
      deadlineAt: g.deadline_at ? g.deadline_at.slice(0, 10) : '', status: g.status, verified: g.verified,
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const payload = {
      title: form.title.trim(),
      funderName: form.funderName.trim(),
      funderType: form.funderType,
      category: form.category.trim() || null,
      summary: form.summary.trim() || null,
      description: form.description.trim() || null,
      focusAreas: form.focusAreas.split(',').map((s) => s.trim()).filter(Boolean),
      eligibility: form.eligibility.trim() || null,
      eligibleEntityTypes: form.eligibleEntityTypes.split(',').map((s) => s.trim()).filter(Boolean),
      amountMin: form.amountMin ? dollarsToCents(form.amountMin) : null,
      amountMax: form.amountMax ? dollarsToCents(form.amountMax) : null,
      location: form.location.trim() || null,
      country: form.country.trim() || null,
      applicationUrl: form.applicationUrl.trim() || '',
      deadlineAt: form.deadlineAt ? new Date(form.deadlineAt).toISOString() : '',
      status: form.status,
      verified: form.verified,
    };
    try {
      const url = editId ? `/api/admin/grants/${editId}` : '/api/admin/grants';
      const res = await fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Save failed');
      setMsg({ kind: 'ok', text: editId ? 'Grant updated' : 'Grant published' });
      resetForm();
      await load();
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this grant? It will be removed from discovery.')) return;
    const res = await fetch(`/api/admin/grants/${id}`, { method: 'DELETE' });
    if (res.ok) { await load(); } else { setMsg({ kind: 'err', text: 'Delete failed' }); }
  }

  async function quickStatus(id: string, status: string) {
    const res = await fetch(`/api/admin/grants/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    if (res.ok) await load();
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20 }}>
      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: msg.kind === 'ok' ? 'var(--green-light)' : 'rgba(190,18,60,.12)',
          color: msg.kind === 'ok' ? 'var(--green-text)' : 'var(--red-text)',
        }}>{msg.text}</div>
      )}

      {/* Create / edit form */}
      <form onSubmit={submit} style={{ background: 'var(--s1)', border: '1px solid #eef0f7', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', minWidth: 0, justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>
            {editId ? 'Edit grant' : 'Add a grant'}
          </h3>
          {editId && <button type="button" onClick={resetForm} style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-text)', background: 'none', border: 'none' }}>+ New instead</button>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label} htmlFor="grant-title">Title *</label>
            <input id="grant-title" style={input} value={form.title} onChange={(e) => set('title', e.target.value)} required minLength={3} placeholder="e.g. Community Health Innovation Grant" />
          </div>
          <div>
            <label style={label} htmlFor="grant-funderName">Funder name *</label>
            <input id="grant-funderName" style={input} value={form.funderName} onChange={(e) => set('funderName', e.target.value)} required placeholder="e.g. Robert Wood Johnson Foundation" />
          </div>
          <div>
            <label style={label} htmlFor="grant-funderType">Funder type</label>
            <select id="grant-funderType" style={input} value={form.funderType} onChange={(e) => set('funderType', e.target.value)}>
              {FUNDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={label} htmlFor="grant-category">Category</label>
            <input id="grant-category" style={input} value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="e.g. health" />
          </div>
          <div>
            <label style={label} htmlFor="grant-status">Status</label>
            <select id="grant-status" style={input} value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={label} htmlFor="grant-amountMin">Min award (USD)</label>
            <input id="grant-amountMin" style={input} value={form.amountMin} onChange={(e) => set('amountMin', e.target.value)} inputMode="numeric" placeholder="5000" />
          </div>
          <div>
            <label style={label} htmlFor="grant-amountMax">Max award (USD)</label>
            <input id="grant-amountMax" style={input} value={form.amountMax} onChange={(e) => set('amountMax', e.target.value)} inputMode="numeric" placeholder="50000" />
          </div>
          <div>
            <label style={label} htmlFor="grant-deadlineAt">Deadline</label>
            <input id="grant-deadlineAt" style={input} type="date" value={form.deadlineAt} onChange={(e) => set('deadlineAt', e.target.value)} />
          </div>
          <div>
            <label style={label} htmlFor="grant-country">Country</label>
            <input id="grant-country" style={input} value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="US" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label} htmlFor="grant-applicationUrl">Application URL</label>
            <input id="grant-applicationUrl" style={input} value={form.applicationUrl} onChange={(e) => set('applicationUrl', e.target.value)} placeholder="https://funder.org/apply" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label} htmlFor="grant-focusAreas">Focus areas (comma-separated)</label>
            <input id="grant-focusAreas" style={input} value={form.focusAreas} onChange={(e) => set('focusAreas', e.target.value)} placeholder="health, community, youth" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label} htmlFor="grant-eligibleEntityTypes">Eligible entity types (comma-separated)</label>
            <input id="grant-eligibleEntityTypes" style={input} value={form.eligibleEntityTypes} onChange={(e) => set('eligibleEntityTypes', e.target.value)} placeholder="nonprofit, school, individual" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label} htmlFor="grant-summary">Summary</label>
            <textarea id="grant-summary" style={{ ...input, minHeight: 60, resize: 'vertical' }} value={form.summary} onChange={(e) => set('summary', e.target.value)} maxLength={1000} placeholder="One or two sentences shown on the grant card." />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label} htmlFor="grant-description">Full description / eligibility details</label>
            <textarea id="grant-description" style={{ ...input, minHeight: 90, resize: 'vertical' }} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={20000} placeholder="Full grant details shown on the detail page." />
          </div>
        </div>

        <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
            <input type="checkbox" checked={form.verified} onChange={(e) => set('verified', e.target.checked)} />
            Verified (trusted badge + ranked first)
          </label>
          <button type="submit" disabled={saving} style={{
            marginLeft: 'auto', padding: '10px 22px', borderRadius: 10, border: 'none',
            background: '#6d35ff', color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
          }}>{saving ? 'Saving…' : editId ? 'Save changes' : 'Publish grant'}</button>
        </div>
      </form>

      {/* Existing grants list */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)', margin: '4px 0 12px' }}>
          All grants {loading ? '' : `(${grants.length})`}
        </h3>
        {loading ? (
          <div style={{ color: 'var(--t3)', fontSize: 13, padding: 20 }}>Loading…</div>
        ) : grants.length === 0 ? (
          <div style={{ color: 'var(--t3)', fontSize: 13, padding: 20, background: 'var(--s1)', borderRadius: 12, border: '1px solid var(--line)' }}>
            No grants yet. Add your first one above — it goes live on <strong>/grants</strong> immediately.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
            {grants.map((g) => (
              <div key={g.id} style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', background: 'var(--s1)', border: '1px solid #eef0f7', borderRadius: 12 }}>
                <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                  <div style={{ display: 'flex', minWidth: 0, gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: g.status === 'open' ? 'var(--green-light)' : g.status === 'upcoming' ? 'var(--s3)' : 'var(--s2)',
                      color: g.status === 'open' ? 'var(--green-text)' : g.status === 'upcoming' ? 'var(--blue-text)' : 'var(--t3)',
                    }}>{g.status}</span>
                    {g.verified && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-text)' }}>✓ verified</span>}
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>{g.funder_name}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <a
                      href={`/grants/${g.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
                    >
                      {g.title}
                    </a>
                  </div>
                </div>
                <div style={{ display: 'flex', minWidth: 0, gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                  <button onClick={() => startEdit(g)} style={btn('var(--brand-text)')}>Edit</button>
                  {g.status !== 'open' && <button onClick={() => quickStatus(g.id, 'open')} style={btn('var(--green-text)')}>Open</button>}
                  {g.status !== 'closed' && <button onClick={() => quickStatus(g.id, 'closed')} style={btn('var(--t3)')}>Close</button>}
                  <button onClick={() => remove(g.id)} style={btn('var(--red-text)')}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8,
    border: '1px solid var(--b1)', background: 'var(--s2)', color, cursor: 'pointer',
  };
}
