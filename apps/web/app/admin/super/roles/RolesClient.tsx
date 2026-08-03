'use client';

import React, { useMemo, useState } from 'react';
import { ROLE_DEFINITIONS, ROLE_ORDER } from '../../../../lib/role-capabilities';

export type RoleUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  roles: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Derived from lib/role-capabilities.ts — the single source of truth for what a
// role MEANS. This screen used to carry its own hardcoded copy, which had already
// drifted into telling the operator something false: it described `nonprofit` as
// "Manage a nonprofit org", while the capability map records that the role grants
// no tax-deductibility at all (that comes from per-campaign `nonprofit_verified`).
// Same drift pattern as the campaign categories and the six route lists.
//
// `enforced` is surfaced deliberately. Toggling `admin` really does open the admin
// console; toggling `nonprofit` changes nothing in code today. Rendering the two
// identically invites an owner to believe they have granted or revoked access they
// have not.
// ─────────────────────────────────────────────────────────────────────────────
const ALL_ROLES = ROLE_ORDER.map((key) => {
  const def = ROLE_DEFINITIONS[key];
  return {
    key: key as string,
    label: def.label,
    desc: def.description,
    enforced: def.capabilities.some((c) => c.enforced),
  };
});

const ADVISORY_ROLES = ALL_ROLES.filter((r) => !r.enforced).map((r) => r.label);

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export default function RolesClient({ users: initial }: { users: RoleUser[] }) {
  const [users, setUsers] = useState(initial);
  const [query, setQuery] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users.slice(0, 200);
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)).slice(0, 200);
  }, [users, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of ALL_ROLES) c[r.key] = users.filter((u) => u.roles.includes(r.key)).length;
    return c;
  }, [users]);

  async function toggleRole(user: RoleUser, roleKey: string) {
    const has = user.roles.includes(roleKey);
    let next = has ? user.roles.filter((r) => r !== roleKey) : [...user.roles, roleKey];
    if (next.length === 0) next = ['donor'];
    setSavingId(user.id);
    try {
      const res = await fetch('/api/admin/super/roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, roles: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, roles: json.roles } : u)));
      setToast(`Updated ${user.name}`);
    } catch (e) {
      setToast(`Error: ${(e as Error).message}`);
    } finally {
      setSavingId(null);
      setTimeout(() => setToast(null), 2500);
    }
  }

  return (
    <div style={{ padding: '0 4px 48px' }}>
      {ADVISORY_ROLES.length > 0 && (
        <div
          role="note"
          style={{
            margin: '0 0 18px', padding: '14px 16px', borderRadius: 12,
            background: 'var(--s2)', border: '1px solid var(--b2)', color: 'var(--t1)',
          }}
        >
          <strong style={{ display: 'block', marginBottom: 4 }}>
            Only Admin and Super Admin currently gate access
          </strong>
          <span style={{ fontSize: 13.5, lineHeight: 1.55 }}>
            {ADVISORY_ROLES.join(', ')} are descriptive labels today — granting or removing
            them changes how a user is described, not what they can do. In particular,
            tax-deductibility comes from per-campaign verification, <em>not</em> from the
            Nonprofit role. Hover a column heading for what each role means.
          </span>
        </div>
      )}

      <div className="kf-metrics" style={{ marginBottom: 20 }}>
        {ALL_ROLES.map((r) => (
          <article key={r.key} className="kf-card kf-metric">
            <div className={`kf-square ${r.key === 'super_admin' ? 'orange' : r.key === 'admin' ? 'pink' : 'violet'}`}>
              <span style={{ fontWeight: 800 }}>{r.label.slice(0, 1)}</span>
            </div>
            <div>
              <span>{r.label}</span>
              <strong>{counts[r.key] ?? 0}</strong>
              <small style={{ display: 'block', fontSize: 11, color: 'var(--t3)', fontWeight: 600 }}>
                {r.enforced ? 'Gates access' : 'Label only'}
              </small>
            </div>
          </article>
        ))}
      </div>

      <div className="kf-card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', minWidth: 0, gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            aria-label="Search users by name or email"
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 220, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)' }}
          />
          <span style={{ color: 'var(--t3)', fontSize: 13 }}>{filtered.length} shown</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--t3)', fontSize: 12 }}>
                <th style={{ padding: '8px 10px' }}>User</th>
                {ALL_ROLES.map((r) => (
                  <th key={r.key} style={{ padding: '8px 6px', textAlign: 'center' }} title={r.desc}>{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} style={{ borderTop: '1px solid var(--b1)', opacity: savingId === u.id ? 0.55 : 1 }}>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 10 }}>
                      <span className="kf-avatar" style={{ width: 34, height: 34, fontSize: 12 }}>{initials(u.name)}</span>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{u.name}</strong>
                        <small style={{ color: 'var(--t3)', fontSize: 11 }}>{u.email}</small>
                      </div>
                    </div>
                  </td>
                  {ALL_ROLES.map((r) => {
                    const on = u.roles.includes(r.key);
                    return (
                      <td key={r.key} style={{ textAlign: 'center', padding: '6px' }}>
                        <button
                          type="button"
                          onClick={() => toggleRole(u, r.key)}
                          disabled={savingId === u.id}
                          aria-pressed={on}
                          aria-label={`${r.label} — ${on ? 'granted' : 'not granted'} to ${u.name}`}
                          title={`${on ? 'Remove' : 'Add'} ${r.label}${r.enforced ? '' : ' (label only — gates nothing)'}`}
                          style={{
                            width: 26, height: 26, borderRadius: 7, cursor: 'pointer',
                            border: on ? 'none' : '1.5px solid var(--b2)',
                            background: on ? (r.key === 'super_admin' ? 'linear-gradient(135deg,#7c3aed,#ff8a1e)' : r.key === 'admin' ? '#ec3fb4' : 'var(--green)') : 'transparent',
                            color: '#fff', fontWeight: 800, fontSize: 13, lineHeight: 1,
                          }}
                        >
                          {on ? '✓' : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--t1)', color: 'var(--bg)', padding: '10px 16px', borderRadius: 10, fontSize: 13, boxShadow: 'var(--shadow-lg)', zIndex: 50 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
