'use client';

import React, { useState } from 'react';

export type Flag = { id: string; key: string; enabled: boolean; description: string | null; rollout_pct: number };

const input: React.CSSProperties = { padding: '9px 12px', borderRadius: 9, border: '1px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)', fontSize: 13 };
const btn: React.CSSProperties = { padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--green-btn)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 };

export default function FlagsClient({ flags: initial }: { flags: Flag[] }) {
  const [flags, setFlags] = useState(initial);
  const [nk, setNk] = useState(''); const [nd, setNd] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  async function patch(id: string, patch: Partial<Flag>) {
    setFlags((p) => p.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    const res = await fetch('/api/admin/super/flags', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
    if (!res.ok) { const j = await res.json(); flash(`Error: ${j.error}`); }
  }
  async function create() {
    if (!/^[a-z0-9_]{2,}$/.test(nk)) { flash('Key must be lowercase/digits/underscore'); return; }
    const res = await fetch('/api/admin/super/flags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: nk, description: nd, enabled: false, rollout_pct: 100 }) });
    const j = await res.json();
    if (!res.ok) { flash(`Error: ${j.error}`); return; }
    setFlags((p) => [...p, j.row].sort((a, b) => a.key.localeCompare(b.key))); setNk(''); setNd(''); flash('Flag created');
  }

  return (
    <div style={{ padding: '0 4px 48px' }}>
      <div className="kf-card" style={{ padding: 16, marginBottom: 16, display: 'flex', minWidth: 0, gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 12, color: 'var(--t3)' }}>New flag key<br /><input style={{ ...input, width: 200 }} value={nk} onChange={(e) => setNk(e.target.value)} placeholder="new_feature" /></label>
        <label style={{ fontSize: 12, color: 'var(--t3)', flex: 1, minWidth: 200 }}>Description<br /><input style={{ ...input, width: '100%' }} value={nd} onChange={(e) => setNd(e.target.value)} /></label>
        <button style={btn} onClick={create}>Add flag</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
        {flags.map((f) => (
          <div key={f.id} className="kf-card" style={{ padding: 14, display: 'flex', minWidth: 0, alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => patch(f.id, { enabled: !f.enabled })}
              aria-pressed={f.enabled}
              style={{ width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', background: f.enabled ? 'var(--green)' : 'var(--b3)', position: 'relative', flexShrink: 0 }}
            >
              <span style={{ position: 'absolute', top: 3, left: f.enabled ? 23 : 3, width: 20, height: 20, borderRadius: 999, background: 'var(--s1)', transition: 'left .15s' }} />
            </button>
            <div style={{ flex: 1, minWidth: 180 }}>
              <code style={{ fontSize: 13, fontWeight: 700 }}>{f.key}</code>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>{f.description || 'No description'}</div>
            </div>
            <label style={{ fontSize: 12, color: 'var(--t3)', display: 'flex', minWidth: 0, alignItems: 'center', gap: 8 }}>
              Rollout
              <input type="range" min={0} max={100} value={f.rollout_pct} onChange={(e) => setFlags((p) => p.map((x) => x.id === f.id ? { ...x, rollout_pct: Number(e.target.value) } : x))} onMouseUp={(e) => patch(f.id, { rollout_pct: Number((e.target as HTMLInputElement).value) })} onTouchEnd={(e) => patch(f.id, { rollout_pct: Number((e.target as HTMLInputElement).value) })} />
              <b style={{ width: 38, textAlign: 'right' }}>{f.rollout_pct}%</b>
            </label>
            <span className={`kf-pill ${f.enabled ? 'green' : 'red'}`}>{f.enabled ? 'On' : 'Off'}</span>
          </div>
        ))}
        {flags.length === 0 && <p style={{ color: 'var(--t3)' }}>No feature flags yet.</p>}
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--t1)', color: 'var(--bg)', padding: '10px 16px', borderRadius: 10, fontSize: 13, boxShadow: 'var(--shadow-lg)', zIndex: 50 }}>{toast}</div>}
    </div>
  );
}
