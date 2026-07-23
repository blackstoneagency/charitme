'use client';

import React, { useState, useMemo } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface UserRecord {
  id: string;
  full_name: string | null;
  email: string;
  roles: string[];
  created_at: string;
  avatar_url: string | null;
}

export interface WeekPoint {
  week: string;
  count: number;
}

export interface UsersClientProps {
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  suspendedUsers: number;
  users: UserRecord[];
  userGrowth: WeekPoint[];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

function exportUsersCsv(users: UserRecord[]) {
  const header = ['ID', 'Name', 'Email', 'Role', 'Joined'].join(',');
  const rows = users.map(u => [
    u.id,
    u.full_name ?? '',
    u.email,
    getPrimaryRole(u.roles),
    fmtDate(u.created_at),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `users-export-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function getInitials(name: string | null, email: string): string {
  if (name && name.trim()) {
    return name.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function getDisplayName(user: UserRecord): string {
  return user.full_name?.trim() || user.email;
}

function getPrimaryRole(roles: string[]): string {
  if (roles.includes('admin') || roles.includes('super_admin')) return 'Admin';
  if (roles.includes('organizer')) return 'Organizer';
  if (roles.includes('donor')) return 'Donor';
  return 'Donor';
}

// ─────────────────────────────────────────────
// SVG line chart
// ─────────────────────────────────────────────
function GrowthChart({ points }: { points: WeekPoint[] }) {
  if (points.length < 2) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: '#8c9ab5', fontSize: 14 }}>Not enough data</div>;
  }
  const W = 480; const H = 160; const pad = 14;
  const max = Math.max(...points.map(p => p.count), 1);
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (W - pad * 2));
  const ys = points.map(p => pad + (1 - p.count / max) * (H - pad * 2));
  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const areaD = `${pathD} L${xs[xs.length - 1]},${H} L${xs[0]},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 180 }}>
      <defs>
        <linearGradient id="ugGrad" x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#19b86a" stopOpacity="0.16" />
          <stop offset="1" stopColor="#19b86a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#ugGrad)" />
      <path d={pathD} fill="none" stroke="#19b86a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r="4" fill="#19b86a" stroke="#fff" strokeWidth="3" />
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────
// User detail slide-in panel
// ─────────────────────────────────────────────
function UserDetailPanel({ user, onClose }: { user: UserRecord; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionDone, setActionDone] = useState('');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [pendingRole, setPendingRole] = useState(getPrimaryRole(user.roles).toLowerCase());

  async function handleAction(action: string) {
    setActionError(''); setActionDone('');
    if (action === 'delete' && !confirm(`Permanently delete ${user.email}? This cannot be undone.`)) return;
    setActionLoading(action);
    try {
      let res: Response;
      if (action === 'delete') {
        res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      } else if (action === 'change-role') {
        res = await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: pendingRole }) });
      } else {
        res = await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      }
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setActionError(data.error ?? 'Action failed.'); return; }
      const msgs: Record<string, string> = {
        'change-role': `Role changed to ${pendingRole}.`,
        'reset-password': 'Password reset email sent.',
        'suspend': 'User suspended.',
        'delete': 'User deleted.',
      };
      setActionDone(msgs[action] ?? 'Done.');
      setShowRolePicker(false);
      if (action === 'delete') setTimeout(onClose, 1500);
    } catch {
      setActionError('Something went wrong.');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', background: 'rgba(10,15,60,.38)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ marginLeft: 'auto', width: 480, maxWidth: '100vw', background: '#fff', height: '100%', overflowY: 'auto', boxShadow: '-12px 0 56px rgba(20,20,80,.14)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '22px 24px', borderBottom: '1px solid #eef0f7', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#efe8ff,#6c35ff)', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {getInitials(user.full_name, user.email)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f0f30' }}>{getDisplayName(user)}</div>
            <div style={{ fontSize: 13, color: '#66708d', marginTop: 2 }}>{user.email}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <span className="kf-pill green">Active</span>
              <span className="kf-pill violet">{getPrimaryRole(user.roles)}</span>
            </div>
          </div>
          <button type="button" onClick={onClose}
            style={{ width: 32, height: 32, border: '1px solid #e6e9f2', borderRadius: '50%', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#8c9ab5', lineHeight: 1, flexShrink: 0 }}>
            ×
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #eef0f7', padding: '0 24px' }}>
          {['overview', 'activity', 'settings'].map(t => (
            <button key={t} type="button" onClick={() => setActiveTab(t)}
              style={{ height: 44, border: 0, borderBottom: `2px solid ${activeTab === t ? '#6c35ff' : 'transparent'}`, background: 'none', fontWeight: activeTab === t ? 950 : 750, fontSize: 13, color: activeTab === t ? '#551cf2' : '#66708d', marginRight: 20, cursor: 'pointer' }}>
              {capitalize(t)}
            </button>
          ))}
        </div>

        <div style={{ padding: '20px 24px', flex: 1 }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gap: 2 }}>
              {[
                ['Full Name', user.full_name || '—'],
                ['Email', user.email],
                ['Role', getPrimaryRole(user.roles)],
                ['Joined', fmtDate(user.created_at)],
                ['User ID', user.id.slice(0, 18) + '...'],
                ['Status', 'Active'],
                ['Registered Via', 'Email'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #f0f2f8', fontSize: 13 }}>
                  <span style={{ color: '#66708d', fontWeight: 700 }}>{label}</span>
                  <span style={{ color: '#101944', fontWeight: 600 }}>{val}</span>
                </div>
              ))}
              <div style={{ marginTop: 16 }}>
                <button type="button" style={{ width: '100%', height: 42, border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>View Public Profile</button>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div style={{ display: 'grid', gap: 12 }}>
              <div className="kf-tabs compact" style={{ marginBottom: 12 }}>
                {['Login History', 'Actions'].map((t, i) => (
                  <button key={t} className={i === 0 ? 'active' : ''} style={{ fontSize: 12 }}>{t}</button>
                ))}
              </div>
              <p style={{ color: '#8c9ab5', fontSize: 14 }}>Activity history will appear here once user performs actions.</p>
            </div>
          )}

          {activeTab === 'settings' && (
            <div style={{ display: 'grid', gap: 10 }}>
              {actionError && <div style={{ padding: '10px 14px', background: '#fff0f3', borderRadius: 9, color: 'var(--red-text)', fontSize: 13, fontWeight: 700 }}>{actionError}</div>}
              {actionDone && <div style={{ padding: '10px 14px', background: '#f0fdf5', borderRadius: 9, color: '#15803d', fontSize: 13, fontWeight: 700 }}>{actionDone}</div>}
              {showRolePicker ? (
                <div style={{ padding: 14, border: '1px solid #dfe3ee', borderRadius: 10, display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 650, color: '#26335c' }}>Select New Role</div>
                  <select value={pendingRole} onChange={e => setPendingRole(e.target.value)}
                    style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }}>
                    <option value="donor">Donor</option>
                    <option value="organizer">Organizer</option>
                    <option value="admin">Admin</option>
                  </select>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => handleAction('change-role')} disabled={actionLoading === 'change-role'}
                      style={{ flex: 1, height: 38, border: 0, borderRadius: 9, background: '#2563eb', color: '#fff', fontWeight: 650, fontSize: 13, cursor: 'pointer', opacity: actionLoading === 'change-role' ? 0.6 : 1 }}>
                      {actionLoading === 'change-role' ? 'Saving…' : 'Confirm'}
                    </button>
                    <button type="button" onClick={() => setShowRolePicker(false)}
                      style={{ flex: 1, height: 38, border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setShowRolePicker(true)}
                  style={{ width: '100%', height: 44, border: '1px solid #2563eb20', borderRadius: 10, background: '#eaf1ff', color: '#2563eb', fontWeight: 650, fontSize: 13, cursor: 'pointer' }}>
                  Change Role
                </button>
              )}
              <button type="button" disabled={!!actionLoading} onClick={() => handleAction('reset-password')}
                style={{ width: '100%', height: 44, border: '1px solid #f9731620', borderRadius: 10, background: '#fff0e4', color: '#f97316', fontWeight: 650, fontSize: 13, cursor: 'pointer', opacity: actionLoading === 'reset-password' ? 0.6 : 1 }}>
                {actionLoading === 'reset-password' ? 'Sending…' : 'Reset Password'}
              </button>
              <button type="button" disabled={!!actionLoading} onClick={() => handleAction('suspend')}
                style={{ width: '100%', height: 44, border: '1px solid #ff3b5f20', borderRadius: 10, background: '#fff0f3', color: 'var(--red-text)', fontWeight: 650, fontSize: 13, cursor: 'pointer', opacity: actionLoading === 'suspend' ? 0.6 : 1 }}>
                {actionLoading === 'suspend' ? 'Updating…' : 'Suspend User'}
              </button>
              <button type="button" disabled={!!actionLoading} onClick={() => handleAction('delete')}
                style={{ width: '100%', height: 44, border: '1px solid #ff3b5f', borderRadius: 10, background: '#fff0f3', color: 'var(--red-text)', fontWeight: 650, fontSize: 13, cursor: 'pointer', opacity: actionLoading === 'delete' ? 0.6 : 1 }}>
                {actionLoading === 'delete' ? 'Deleting…' : '⚠ Delete User'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Add user panel
// ─────────────────────────────────────────────
function AddUserPanel({ onClose }: { onClose: () => void }) {
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('donor');
  const [newStatus, setNewStatus] = useState('active');
  const [sendWelcome, setSendWelcome] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!newEmail.trim() || !newName.trim()) { setError('Name and email are required.'); return; }
    setCreating(true); setError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: newName, email: newEmail, role: newRole, status: newStatus, send_welcome: sendWelcome }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? 'Failed to create user.');
        return;
      }
      onClose();
    } catch {
      setError('Something went wrong.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', background: 'rgba(10,15,60,.38)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ marginLeft: 'auto', width: 460, maxWidth: '100vw', background: '#fff', height: '100%', overflowY: 'auto', boxShadow: '-12px 0 56px rgba(20,20,80,.14)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '22px 24px', borderBottom: '1px solid #eef0f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0f0f30' }}>Add New User</div>
          <button type="button" onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #e6e9f2', borderRadius: '50%', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#8c9ab5', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '24px', display: 'grid', gap: 16, flex: 1 }}>
          {error && <div style={{ padding: '10px 14px', background: '#fff0f3', borderRadius: 9, color: 'var(--red-text)', fontSize: 13, fontWeight: 700 }}>{error}</div>}
          {[
            { label: 'Full Name', value: newName, onChange: setNewName, type: 'text', placeholder: 'Jane Smith' },
            { label: 'Email Address', value: newEmail, onChange: setNewEmail, type: 'email', placeholder: 'jane@example.com' },
          ].map(f => (
            <label key={f.label} style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
              {f.label}
              <input type={f.type} value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder}
                style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14, outline: 'none' }} />
            </label>
          ))}
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
            Role
            <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }}>
              <option value="donor">Donor</option>
              <option value="organizer">Organizer</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
            Status
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#26335c' }}>
            <input type="checkbox" checked={sendWelcome} onChange={e => setSendWelcome(e.target.checked)} />
            Send welcome email
          </label>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #eef0f7', display: 'flex', gap: 12 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, height: 42, border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={handleCreate} disabled={creating} style={{ flex: 1, height: 42, border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: creating ? 0.6 : 1 }}>
            {creating ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function UsersClient({ totalUsers, activeUsers, newUsersThisMonth, suspendedUsers, users, userGrowth }: UsersClientProps) {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [activeSection, setActiveSection] = useState('users');

  const PAGE_SIZE = 10;

  const filtered = useMemo(() => {
    let list = users;
    if (filterRole !== 'all') {
      list = list.filter(u => {
        const role = getPrimaryRole(u.roles).toLowerCase();
        return role === filterRole;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        (u.full_name ?? '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, filterRole, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const sectionTabs = ['users', 'roles', 'export', 'audit'];

  return (
    <div style={{ padding: '0 32px 40px' }}>
      {/* KPI row */}
      <div className="kf-metrics" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Users', value: totalUsers.toLocaleString(), tone: 'violet', icon: 'users' },
          { label: 'Active Users', value: activeUsers.toLocaleString(), tone: 'green', icon: 'check' },
          { label: 'New This Month', value: newUsersThisMonth.toLocaleString(), tone: 'blue', icon: 'chart' },
          { label: 'Suspended', value: suspendedUsers.toLocaleString(), tone: 'orange', icon: 'gear' },
        ].map(m => (
          <article key={m.label} className="kf-card kf-metric">
            <div className={`kf-square ${m.tone}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22} strokeLinecap="round" strokeLinejoin="round">
                {m.icon === 'users' && <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>}
                {m.icon === 'check' && <path d="M20 6L9 17l-5-5"/>}
                {m.icon === 'chart' && <><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></>}
                {m.icon === 'gear' && <><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.36.3.74.5 1.1.6H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.4Z"/></>}
              </svg>
            </div>
            <div>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
            </div>
          </article>
        ))}
      </div>

      {/* Growth chart + recent users */}
      <div className="kf-two-col" style={{ marginBottom: 24 }}>
        <section className="kf-card kf-chart">
          <div className="kf-card-head">
            <h2>User Growth</h2>
            <span style={{ fontSize: 12, color: '#8c9ab5' }}>Last 8 weeks</span>
          </div>
          <div style={{ padding: '0 18px 12px' }}>
            <GrowthChart points={userGrowth} />
          </div>
        </section>

        <section className="kf-card">
          <div className="kf-card-head"><h2>Recent Users</h2></div>
          {users.slice(0, 5).map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: '1px solid #f0f2f8', cursor: 'pointer' }}
              onClick={() => setSelectedUser(u)}
              onMouseEnter={e => (e.currentTarget.style.background = '#fbf9ff')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#e7f8ed,#19b86a)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {getInitials(u.full_name, u.email)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 650, color: '#101944', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getDisplayName(u)}</div>
                <div style={{ fontSize: 11, color: '#66708d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span className="kf-pill violet" style={{ fontSize: 10 }}>{getPrimaryRole(u.roles)}</span>
                <div style={{ fontSize: 11, color: '#8c9ab5', marginTop: 3 }}>{fmtDate(u.created_at)}</div>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* Main section */}
      <section className="kf-card">
        {/* Section tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #eef0f7', padding: '0 20px' }}>
          {sectionTabs.map(t => (
            <button key={t} type="button" onClick={() => setActiveSection(t)}
              style={{ height: 50, padding: '0 16px', border: 0, borderBottom: `2px solid ${activeSection === t ? '#6c35ff' : 'transparent'}`, background: 'none', fontWeight: activeSection === t ? 950 : 750, fontSize: 13, color: activeSection === t ? '#551cf2' : '#202b55', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {capitalize(t)}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, paddingRight: 0 }}>
            <button type="button" onClick={() => setShowAdd(true)}
              style={{ height: 40, padding: '0 18px', border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              + Add User
            </button>
          </div>
        </div>

        {activeSection === 'users' && (
          <div>
            {/* Search + filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid #eef0f7', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, height: 42, border: '1px solid #e0e4ef', borderRadius: 9, padding: '0 14px', background: '#fff' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#8c9ab5" strokeWidth={2} width={15} height={15} aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Search by name or email…"
                  aria-label="Search users by name or email"
                  style={{ border: 0, outline: 0, background: 'transparent', fontSize: 13, width: '100%' }} />
              </div>
              <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(0); }}
                style={{ height: 42, border: '1px solid #e0e4ef', borderRadius: 9, padding: '0 14px', fontSize: 13, background: '#fff' }}>
                <option value="all">All Roles</option>
                <option value="donor">Donor</option>
                <option value="organizer">Organizer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 130px 130px', gap: 12, padding: '10px 20px', background: '#f8f9fc', borderBottom: '1px solid #eef0f7', fontSize: 11, fontWeight: 700, color: '#8c9ab5', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <span>User</span>
              <span>Role</span>
              <span>Status</span>
              <span>Joined</span>
            </div>

            {/* Table rows */}
            {currentPage.map(u => (
              <div key={u.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr 140px 130px 130px', gap: 12, padding: '14px 20px', borderBottom: '1px solid #f0f2f8', cursor: 'pointer', alignItems: 'center' }}
                onClick={() => setSelectedUser(u)}
                onMouseEnter={e => (e.currentTarget.style.background = '#fbf9ff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#e7f8ed,#19b86a)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {getInitials(u.full_name, u.email)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 650, color: '#101944', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getDisplayName(u)}</div>
                    <div style={{ fontSize: 11, color: '#8c9ab5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  </div>
                </div>
                <span className="kf-pill violet" style={{ fontSize: 11 }}>{getPrimaryRole(u.roles)}</span>
                <span className="kf-pill green" style={{ fontSize: 11 }}>Active</span>
                <div style={{ fontSize: 12, color: '#8c9ab5' }}>{fmtDate(u.created_at)}</div>
              </div>
            ))}

            {currentPage.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#8c9ab5', fontSize: 14 }}>No users found</div>
            )}

            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #eef0f7' }}>
              <span style={{ fontSize: 13, color: '#66708d' }}>
                Showing {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} users
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  style={{ height: 34, padding: '0 14px', border: '1px solid #e0e4ef', borderRadius: 8, background: '#fff', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1, fontSize: 13 }}>
                  ← Prev
                </button>
                <button type="button" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}
                  style={{ height: 34, padding: '0 14px', border: '1px solid #e0e4ef', borderRadius: 8, background: '#fff', cursor: page >= pages - 1 ? 'default' : 'pointer', opacity: page >= pages - 1 ? 0.4 : 1, fontSize: 13 }}>
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'roles' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Roles & Permissions</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { role: 'Super Admin', desc: 'Full access to all platform features and settings.', color: 'var(--red-text)' },
                { role: 'Admin', desc: 'Manage users, campaigns, donations, and view reports.', color: '#6c35ff' },
                { role: 'Organizer', desc: 'Create and manage campaigns, view donations.', color: '#2563eb' },
                { role: 'Donor', desc: 'Make donations and view campaign details.', color: '#19b86a' },
              ].map(r => (
                <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', border: '1px solid #e6e9f2', borderRadius: 12, background: '#fff' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#101944' }}>{r.role}</div>
                    <div style={{ fontSize: 13, color: '#66708d', marginTop: 2 }}>{r.desc}</div>
                  </div>
                  <button type="button" style={{ height: 34, padding: '0 14px', border: '1px solid #e0e4ef', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'export' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Export Users</h3>
            <div style={{ maxWidth: 420, display: 'grid', gap: 16 }}>
              {[
                { label: 'File Format', options: ['CSV', 'Excel', 'JSON'] },
                { label: 'Include Fields', options: ['All Fields', 'Basic Info', 'Custom'] },
              ].map(f => (
                <label key={f.label} style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                  {f.label}
                  <select style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }}>
                    {f.options.map(o => <option key={o}>{o}</option>)}
                  </select>
                </label>
              ))}
              <button type="button" style={{ height: 44, border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }} onClick={() => exportUsersCsv(users)}>
                Export Users
              </button>
            </div>
          </div>
        )}

        {activeSection === 'audit' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Audit Log</h3>
            <div style={{ padding: '16px', background: '#f8f9fc', borderRadius: 10, fontSize: 14, color: '#66708d', lineHeight: 1.6 }}>
              User activity is recorded in the platform-wide audit log.{' '}
              <a href="/admin/audit-log" style={{ color: '#551cf2', fontWeight: 600, textDecoration: 'none' }}>
                View full Audit Log →
              </a>
            </div>
          </div>
        )}
      </section>

      {/* Panels */}
      {selectedUser && <UserDetailPanel user={selectedUser} onClose={() => setSelectedUser(null)} />}
      {showAdd && <AddUserPanel onClose={() => setShowAdd(false)} />}
    </div>
  );
}
