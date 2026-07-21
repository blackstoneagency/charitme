'use client';

import React, { useState } from 'react';

export type Announcement = {
  id: string; title: string; body: string | null; level: 'info' | 'success' | 'warning' | 'critical';
  link_url: string | null; link_label: string | null; active: boolean;
  starts_at: string | null; ends_at: string | null; created_at: string;
};

const input: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)', fontSize: 13 };
const btn: React.CSSProperties = { padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 };
const btnGhost: React.CSSProperties = { ...btn, background: 'transparent', color: 'var(--t2)', border: '1px solid var(--b2)' };
const LEVEL_COLOR: Record<string, string> = { info: 'var(--blue)', success: 'var(--green)', warning: '#f59e0b', critical: 'var(--red)' };

export default function AnnouncementsClient({ rows: initial }: { rows: Announcement[] }) {
  const [rows, setRows] = useState(initial);
  const blank: Announcement = { id: '', title: '', body: '', level: 'info', link_url: '', link_label: '', active: false, starts_at: null, ends_at: null, created_at: '' };
  const [draft, setDraft] = useState<Announcement>(blank);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  async function save() {
    if (draft.title.trim().length < 2) { flash('Title required'); return; }
    setBusy(true);
    try {
      const editing = !!draft.id;
      const payload = { ...draft, link_url: draft.link_url || null, link_label: draft.link_label || null, body: draft.body || null };
      const res = await fetch('/api/admin/super/announcements', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      setRows((p) => editing ? p.map((r) => (r.id === j.row.id ? j.row : r)) : [j.row, ...p]);
      setDraft(blank); flash('Saved');
    } catch (e) { flash(`Error: ${(e as Error).message}`); } finally { setBusy(false); }
  }
  async function toggle(r: Announcement) {
    const res = await fetch('/api/admin/super/announcements', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, active: !r.active }) });
    const j = await res.json(); if (res.ok) setRows((p) => p.map((x) => (x.id === r.id ? j.row : x)));
  }
  async function del(id: string) { await fetch(`/api/admin/super/announcements?id=${id}`, { method: 'DELETE' }); setRows((p) => p.filter((r) => r.id !== id)); flash('Deleted'); }

  return (
    <div style={{ padding: '0 4px 48px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 18, alignItems: 'start' }}>
      <div className="kf-card" style={{ padding: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Announcements ({rows.length})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ border: `1px solid var(--b1)`, borderLeft: `4px solid ${LEVEL_COLOR[r.level]}`, borderRadius: 10, padding: 12, opacity: r.active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{r.title}</strong>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <span className={`kf-pill ${r.active ? 'green' : 'red'}`}>{r.active ? 'Live' : 'Off'}</span>
                  <button style={{ ...btnGhost, padding: '3px 10px' }} onClick={() => toggle(r)}>{r.active ? 'Disable' : 'Activate'}</button>
                  <button style={{ ...btnGhost, padding: '3px 10px' }} onClick={() => setDraft(r)}>Edit</button>
                  <button style={{ ...btnGhost, padding: '3px 10px', color: 'var(--red)' }} onClick={() => del(r.id)}>Delete</button>
                </div>
              </div>
              {r.body && <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--t2)' }}>{r.body}</p>}
              <small style={{ color: 'var(--t3)' }}>{r.level}{r.link_url ? ` · ${r.link_label || 'link'}` : ''}</small>
            </div>
          ))}
          {rows.length === 0 && <p style={{ color: 'var(--t3)', fontSize: 13 }}>No announcements yet.</p>}
        </div>
      </div>

      <div className="kf-card" style={{ padding: 16, position: 'sticky', top: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{draft.id ? 'Edit' : 'New announcement'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <label style={{ fontSize: 12, color: 'var(--t3)' }}>Title<input style={input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
          <label style={{ fontSize: 12, color: 'var(--t3)' }}>Body<textarea style={{ ...input, minHeight: 70 }} value={draft.body ?? ''} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></label>
          <label style={{ fontSize: 12, color: 'var(--t3)' }}>Level<select style={input} value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value as Announcement['level'] })}><option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label>
          <label style={{ fontSize: 12, color: 'var(--t3)' }}>Link URL<input style={input} value={draft.link_url ?? ''} onChange={(e) => setDraft({ ...draft, link_url: e.target.value })} placeholder="/pricing" /></label>
          <label style={{ fontSize: 12, color: 'var(--t3)' }}>Link label<input style={input} value={draft.link_label ?? ''} onChange={(e) => setDraft({ ...draft, link_label: e.target.value })} /></label>
          <label style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--t2)' }}><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active now</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn} onClick={save} disabled={busy}>{draft.id ? 'Update' : 'Create'}</button>
            {draft.id !== '' && <button style={btnGhost} onClick={() => setDraft(blank)}>Cancel</button>}
          </div>
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--t1)', color: 'var(--bg)', padding: '10px 16px', borderRadius: 10, fontSize: 13, boxShadow: 'var(--shadow-lg)', zIndex: 50 }}>{toast}</div>}
    </div>
  );
}
