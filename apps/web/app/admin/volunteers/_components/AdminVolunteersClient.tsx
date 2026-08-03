'use client';

import React, { useEffect, useState } from 'react';

interface Opportunity {
  id: string;
  slug: string;
  title: string;
  org_name: string;
  summary: string | null;
  description: string | null;
  category: string | null;
  skills: string[];
  location: string | null;
  country: string | null;
  is_remote: boolean;
  starts_at: string | null;
  ends_at: string | null;
  slots: number | null;
  slots_filled: number;
  time_commitment: string | null;
  contact_url: string | null;
  status: string;
  verified: boolean;
}

const STATUSES = ['open', 'upcoming', 'closed'];

const input: React.CSSProperties = {
  padding: '9px 11px', border: '1px solid #e2e5ee', borderRadius: 9, fontSize: 13,
  background: 'var(--s1)', color: 'var(--t1)', width: '100%', boxSizing: 'border-box',
};
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--t3)', marginBottom: 4, display: 'block' };

const emptyForm = {
  title: '', orgName: '', category: '', summary: '', description: '', skills: '',
  location: '', country: '', isRemote: false, startsAt: '', endsAt: '', slots: '',
  timeCommitment: '', contactUrl: '', status: 'open', verified: false,
};

export default function AdminVolunteersClient() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function load() {
    return fetch('/api/admin/volunteers')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((j) => { setOpps(j.opportunities ?? []); setLoading(false); })
      .catch(() => { setMsg({ kind: 'err', text: 'Failed to load opportunities' }); setLoading(false); });
  }

  useEffect(() => {
    fetch('/api/admin/volunteers')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((j) => { setOpps(j.opportunities ?? []); setLoading(false); })
      .catch(() => { setMsg({ kind: 'err', text: 'Failed to load opportunities' }); setLoading(false); });
  }, []);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function resetForm() { setForm({ ...emptyForm }); setEditId(null); }

  function startEdit(o: Opportunity) {
    setEditId(o.id);
    setForm({
      title: o.title, orgName: o.org_name, category: o.category ?? '', summary: o.summary ?? '',
      description: o.description ?? '', skills: o.skills.join(', '),
      location: o.location ?? '', country: o.country ?? '', isRemote: o.is_remote,
      startsAt: o.starts_at ? o.starts_at.slice(0, 10) : '',
      endsAt: o.ends_at ? o.ends_at.slice(0, 10) : '',
      slots: o.slots == null ? '' : String(o.slots),
      timeCommitment: o.time_commitment ?? '', contactUrl: o.contact_url ?? '',
      status: o.status, verified: o.verified,
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const slotsNum = form.slots.trim() === '' ? null : parseInt(form.slots, 10);
    const payload = {
      title: form.title.trim(),
      orgName: form.orgName.trim(),
      category: form.category.trim() || null,
      summary: form.summary.trim() || null,
      description: form.description.trim() || null,
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      location: form.location.trim() || null,
      country: form.country.trim() || null,
      isRemote: form.isRemote,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : '',
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : '',
      slots: Number.isFinite(slotsNum as number) ? slotsNum : null,
      timeCommitment: form.timeCommitment.trim() || null,
      contactUrl: form.contactUrl.trim() || '',
      status: form.status,
      verified: form.verified,
    };
    try {
      const url = editId ? `/api/admin/volunteers/${editId}` : '/api/admin/volunteers';
      const res = await fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Save failed');
      setMsg({ kind: 'ok', text: editId ? 'Opportunity updated' : 'Opportunity published' });
      resetForm();
      await load();
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this opportunity? It will be removed from /volunteer.')) return;
    const res = await fetch(`/api/admin/volunteers/${id}`, { method: 'DELETE' });
    if (res.ok) { await load(); } else { setMsg({ kind: 'err', text: 'Delete failed' }); }
  }

  async function quickStatus(id: string, status: string) {
    const res = await fetch(`/api/admin/volunteers/${id}`, {
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
            {editId ? 'Edit opportunity' : 'Add a volunteer opportunity'}
          </h3>
          {editId && <button type="button" onClick={resetForm} style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-text)', background: 'none', border: 'none' }}>+ New instead</button>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="vol-title" style={label}>Title *</label>
            <input id="vol-title" style={input} value={form.title} onChange={(e) => set('title', e.target.value)} required minLength={3} placeholder="e.g. Food Bank Distribution Helper" />
          </div>
          <div>
            <label htmlFor="vol-org" style={label}>Organization *</label>
            <input id="vol-org" style={input} value={form.orgName} onChange={(e) => set('orgName', e.target.value)} required placeholder="e.g. City Food Bank" />
          </div>
          <div>
            <label htmlFor="vol-category" style={label}>Category</label>
            <input id="vol-category" style={input} value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="e.g. community" />
          </div>
          <div>
            <label htmlFor="vol-status" style={label}>Status</label>
            <select id="vol-status" style={input} value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="vol-slots" style={label}>Spots (blank = unlimited)</label>
            <input id="vol-slots" style={input} value={form.slots} onChange={(e) => set('slots', e.target.value)} inputMode="numeric" placeholder="10" />
          </div>
          <div>
            <label htmlFor="vol-starts" style={label}>Starts</label>
            <input id="vol-starts" style={input} type="date" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          </div>
          <div>
            <label htmlFor="vol-ends" style={label}>Ends</label>
            <input id="vol-ends" style={input} type="date" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
          </div>
          <div>
            <label htmlFor="vol-commitment" style={label}>Time commitment</label>
            <input id="vol-commitment" style={input} value={form.timeCommitment} onChange={(e) => set('timeCommitment', e.target.value)} placeholder="4 hrs/week" />
          </div>
          <div>
            <label htmlFor="vol-location" style={label}>Location</label>
            <input id="vol-location" style={input} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Austin, TX" />
          </div>
          <div>
            <label htmlFor="vol-country" style={label}>Country</label>
            <input id="vol-country" style={input} value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="US" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="vol-contact" style={label}>Contact / signup URL</label>
            <input id="vol-contact" style={input} value={form.contactUrl} onChange={(e) => set('contactUrl', e.target.value)} placeholder="https://org.example/volunteer" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="vol-skills" style={label}>Skills needed (comma-separated)</label>
            <input id="vol-skills" style={input} value={form.skills} onChange={(e) => set('skills', e.target.value)} placeholder="logistics, customer service, driving" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="vol-summary" style={label}>Summary</label>
            <textarea id="vol-summary" style={{ ...input, minHeight: 60, resize: 'vertical' }} value={form.summary} onChange={(e) => set('summary', e.target.value)} maxLength={1000} placeholder="One or two sentences shown on the opportunity card." />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="vol-description" style={label}>Full description</label>
            <textarea id="vol-description" style={{ ...input, minHeight: 90, resize: 'vertical' }} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={20000} placeholder="What volunteers will actually do, requirements, what to bring." />
          </div>
        </div>

        <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
            <input type="checkbox" checked={form.isRemote} onChange={(e) => set('isRemote', e.target.checked)} />
            Remote-friendly
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
            <input type="checkbox" checked={form.verified} onChange={(e) => set('verified', e.target.checked)} />
            Verified (trusted badge + ranked first)
          </label>
          <button type="submit" disabled={saving} style={{
            marginLeft: 'auto', padding: '10px 22px', borderRadius: 10, border: 'none',
            background: '#6d35ff', color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
          }}>{saving ? 'Saving…' : editId ? 'Save changes' : 'Publish opportunity'}</button>
        </div>
      </form>

      {/* Existing opportunities */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)', margin: '4px 0 12px' }}>
          All opportunities {loading ? '' : `(${opps.length})`}
        </h3>
        {loading ? (
          <div style={{ color: 'var(--t3)', fontSize: 13, padding: 20 }}>Loading…</div>
        ) : opps.length === 0 ? (
          <div style={{ color: 'var(--t3)', fontSize: 13, padding: 20, background: 'var(--s1)', borderRadius: 12, border: '1px solid var(--line)' }}>
            No opportunities yet. Add your first one above — it goes live on <strong>/volunteer</strong> immediately.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
            {opps.map((o) => {
              const full = o.slots != null && o.slots_filled >= o.slots;
              return (
                <div key={o.id} style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', background: 'var(--s1)', border: '1px solid var(--line)', borderRadius: 12 }}>
                  <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                    <div style={{ display: 'flex', minWidth: 0, gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                        background: o.status === 'open' ? 'var(--green-light)' : o.status === 'upcoming' ? 'var(--s3)' : 'var(--s2)',
                        color: o.status === 'open' ? 'var(--green-text)' : o.status === 'upcoming' ? 'var(--blue-text)' : 'var(--t3)',
                      }}>{o.status}</span>
                      {o.verified && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green-text)' }}>✓ verified</span>}
                      {o.is_remote && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue-text)' }}>remote</span>}
                      <span style={{ fontSize: 12, color: 'var(--t3)' }}>{o.org_name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: full ? 'var(--red-text)' : 'var(--t3)' }}>
                        {o.slots == null ? 'unlimited spots' : `${o.slots_filled}/${o.slots} filled`}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {/* 44px target: the row title is the primary way into an
                          opportunity, and it measured 254x16 — under the WCAG
                          2.2 SC 2.5.8 minimum. */}
                      <a
                        href={`/volunteer/${o.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, maxWidth: '100%' }}
                      >
                        {o.title}
                      </a>
                    </div>
                  </div>
                  <div style={{ display: 'flex', minWidth: 0, gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                    <button onClick={() => startEdit(o)} style={btn('var(--brand-text)')}>Edit</button>
                    {o.status !== 'open' && <button onClick={() => quickStatus(o.id, 'open')} style={btn('var(--green-text)')}>Open</button>}
                    {o.status !== 'closed' && <button onClick={() => quickStatus(o.id, 'closed')} style={btn('var(--t3)')}>Close</button>}
                    <button onClick={() => remove(o.id)} style={btn('var(--red-text)')}>Delete</button>
                  </div>
                </div>
              );
            })}
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
