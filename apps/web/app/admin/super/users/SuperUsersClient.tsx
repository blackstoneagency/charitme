'use client';

import React, { useMemo, useState } from 'react';

export type DirUser = {
  id: string; name: string; email: string; roles: string[]; suspended: boolean;
  plan: string; verified: boolean; joinedAt: string;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}
const btnGhost: React.CSSProperties = { padding: '5px 12px', borderRadius: 8, background: 'transparent', color: 'var(--t2)', border: '1px solid var(--b2)', cursor: 'pointer', fontSize: 12, fontWeight: 600 };

export default function SuperUsersClient({ users: initial, total }: { users: DirUser[]; total: number }) {
  const [users, setUsers] = useState(initial);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'admins' | 'suspended' | 'verified'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === 'admins' && !u.roles.includes('admin') && !u.roles.includes('super_admin')) return false;
      if (filter === 'suspended' && !u.suspended) return false;
      if (filter === 'verified' && !u.verified) return false;
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      return true;
    }).slice(0, 250);
  }, [users, query, filter]);

  async function action(u: DirUser, act: 'suspend' | 'restore' | 'set_plan', plan?: string) {
    setBusyId(u.id);
    try {
      const res = await fetch('/api/admin/super/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: u.id, action: act, plan }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      setUsers((p) => p.map((x) => x.id === u.id ? { ...x, suspended: act === 'suspend' ? true : act === 'restore' ? false : x.suspended, plan: act === 'set_plan' ? (plan ?? x.plan) : x.plan } : x));
      flash(act === 'set_plan' ? `Plan → ${plan}` : act === 'suspend' ? 'Suspended' : 'Restored');
    } catch (e) { flash(`Error: ${(e as Error).message}`); } finally { setBusyId(null); }
  }

  const stats = {
    total,
    admins: users.filter((u) => u.roles.includes('admin') || u.roles.includes('super_admin')).length,
    verified: users.filter((u) => u.verified).length,
    suspended: users.filter((u) => u.suspended).length,
  };

  return (
    <div style={{ padding: '0 4px 48px' }}>
      <div className="kf-metrics" style={{ marginBottom: 18 }}>
        {[['Total', stats.total, 'violet'], ['Admins', stats.admins, 'orange'], ['Verified', stats.verified, 'green'], ['Suspended', stats.suspended, 'pink']].map(([l, v, t]) => (
          <article key={l as string} className="kf-card kf-metric">
            <div className={`kf-square ${t}`}><span style={{ fontWeight: 800 }}>{String(l).slice(0, 1)}</span></div>
            <div><span>{l}</span><strong>{Number(v).toLocaleString()}</strong></div>
          </article>
        ))}
      </div>

      <div className="kf-card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <input aria-label="Search users by name or email" placeholder="Search name or email…" value={query} onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)' }} />
          <div className="kf-tabs">
            {(['all', 'admins', 'verified', 'suspended'] as const).map((f) => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>{f}</button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--t3)', fontSize: 12 }}>
              <th style={{ padding: '8px 10px' }}>User</th><th>Roles</th><th>Plan</th><th>Joined</th><th style={{ textAlign: 'right' }}>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} style={{ borderTop: '1px solid var(--b1)', opacity: busyId === u.id ? 0.5 : 1 }}>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="kf-avatar" style={{ width: 34, height: 34, fontSize: 12 }}>{initials(u.name)}</span>
                      <div><strong style={{ display: 'block', fontSize: 13 }}>{u.name} {u.verified && <span title="Identity verified" style={{ color: 'var(--green)' }}>✓</span>}{u.suspended && <span className="kf-pill red" style={{ marginLeft: 6 }}>Suspended</span>}</strong><small style={{ color: 'var(--t3)', fontSize: 11 }}>{u.email}</small></div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{u.roles.map((r) => <span key={r} className={`kf-pill ${r === 'super_admin' ? 'orange' : r === 'admin' ? 'pink' : 'violet'}`} style={{ marginRight: 4 }}>{r}</span>)}</td>
                  <td>
                    <select aria-label={`Plan for ${u.email}`} value={u.plan} disabled={busyId === u.id} onChange={(e) => action(u, 'set_plan', e.target.value)}
                      style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)', fontSize: 12 }}>
                      <option value="free">free</option><option value="starter">starter</option><option value="pro">pro</option>
                    </select>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--t3)' }}>{new Date(u.joinedAt).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    {u.suspended
                      ? <button style={{ ...btnGhost, color: 'var(--green-dark)' }} onClick={() => action(u, 'restore')} disabled={busyId === u.id}>Restore</button>
                      : <button style={{ ...btnGhost, color: 'var(--red)' }} onClick={() => action(u, 'suspend')} disabled={busyId === u.id}>Suspend</button>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--t3)' }}>No matching users.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--t1)', color: 'var(--bg)', padding: '10px 16px', borderRadius: 10, fontSize: 13, boxShadow: 'var(--shadow-lg)', zIndex: 50 }}>{toast}</div>}
    </div>
  );
}
