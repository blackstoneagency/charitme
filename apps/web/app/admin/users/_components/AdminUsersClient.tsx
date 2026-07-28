'use client';

import type React from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { KFIcon, StatusPill, Avatar } from '../../../../components/CharitMeApp';
import { ROLE_DEFINITIONS, ROLE_ORDER } from '../../../../lib/role-capabilities';

function useEscape(onClose: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
}

// ─── Exported Types ───────────────────────────────────────────────────────────

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  roles: string[];
  role: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  plan: string;
  identityVerified: boolean;
  timezone: string;
  currency: string;
  joinedAt: string;
  updatedAt: string;
  campaignsCount: number;
  donationsCount: number;
  totalRaisedCents: number;
  totalDonatedCents: number;
  lastActivityAt: string;
};

export type AdminUserActivity = {
  id: string;
  userId: string;
  userName: string;
  type: string;
  title: string;
  detail: string;
  amount?: string;
  createdAt: string;
};

export type UserRoleSummary = {
  role: string;
  key: string;
  description: string;
  count: number;
  system: boolean;
};

export type GrowthPoint = { label: string; count: number };

type UserDonation = {
  id: string;
  amountCents: number;
  status: string;
  campaignTitle: string;
  createdAt: string;
};

type UserCampaign = {
  id: string;
  title: string;
  status: string;
  raisedAmount: number;
  goalAmount: number;
  backerCount: number;
  createdAt: string;
};

type Props = {
  users: AdminUser[];
  activities: AdminUserActivity[];
  roles: UserRoleSummary[];
  // total/newUsers are `null` when the count query failed. Unknown is not zero,
  // and it is not the length of a page-limited row read either.
  totals: { total: number | null; newUsers: number | null; active: number; suspended: number };
  weeklyGrowth: GrowthPoint[];
  recentUsers: AdminUser[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
// All possible role values in the jsonb roles array
// Derived from the shared role catalog rather than hand-listed. The previous
// hardcoded copy had already drifted: it offered a 'user' option that is not a
// real role (so the filter could never match once roles are whitelisted) and
// omitted 'super_admin' entirely, leaving no way to filter super admins.
const ROLE_OPTIONS: { value: string; label: string }[] = ROLE_ORDER.map((r) => ({
  value: r,
  label: ROLE_DEFINITIONS[r].label,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function toCsv(rows: AdminUser[]): string {
  const header = ['Name', 'Email', 'Role', 'Status', 'Plan', 'Verified', 'Campaigns', 'Donations', 'Raised', 'Donated', 'Joined'];
  const lines = rows.map((u) => [
    u.name,
    u.email,
    u.role,
    u.status,
    u.plan,
    u.identityVerified ? 'Yes' : 'No',
    String(u.campaignsCount),
    String(u.donationsCount),
    money(u.totalRaisedCents),
    money(u.totalDonatedCents),
    fmtDate(u.joinedAt),
  ]);
  return [header, ...lines]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function download(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function rolePillColor(role: string): React.CSSProperties {
  // Keyed by lowercase so two-word labels work. The previous normaliser did
  // `charAt(0).toUpperCase() + slice(1).toLowerCase()`, which turns 'Super Admin'
  // into 'Super admin' — no map entry, so the platform's most privileged role fell
  // through to the same grey as an unknown one. Super Admin and Admin now read as
  // visibly different, because they are.
  const map: Record<string, { bg: string; color: string }> = {
    'super admin': { bg: 'rgba(190,24,93,.10)',  color: '#9d174d' },
    admin:         { bg: 'rgba(108,53,255,.10)', color: 'var(--violet, #6c35ff)' },
    organizer:     { bg: 'rgba(37,99,235,.08)',  color: 'var(--blue, #0369a1)' },
    nonprofit:     { bg: 'rgba(22,163,74,.10)',  color: 'var(--green-dark, #166534)' },
    beneficiary:   { bg: 'rgba(14,116,144,.10)', color: '#155e75' },
    donor:         { bg: 'rgba(217,119,6,.08)',  color: 'var(--amber, #854d0e)' },
  };
  const c = map[role.trim().toLowerCase()] ?? { bg: '#f1f5f9', color: '#334155' };
  return { background: c.bg, color: c.color, padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 650 };
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

function WeeklyLineChart({ data }: { data: GrowthPoint[] }) {
  const W = 520;
  const H = 160;
  const pad = { top: 14, right: 18, bottom: 28, left: 32 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const maxVal = Math.max(...data.map((d) => d.count), 1);

  const pts = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1)) * chartW,
    y: pad.top + chartH - (d.count / maxVal) * chartH,
    label: d.label,
    count: d.count,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD =
    pathD +
    ` L${pts[pts.length - 1].x.toFixed(1)},${(pad.top + chartH).toFixed(1)}` +
    ` L${pts[0].x.toFixed(1)},${(pad.top + chartH).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((frac) => {
        const y = pad.top + chartH - frac * chartH;
        return (
          <line key={frac} x1={pad.left} y1={y} x2={pad.left + chartW} y2={y} stroke="var(--b1, #eef0f7)" strokeWidth={1} />
        );
      })}
      <path d={areaD} fill="url(#chartGrad)" />
      <path d={pathD} fill="none" stroke="#7c3aed" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => (
        <circle key={p.label} cx={p.x} cy={p.y} r={4} fill="var(--violet, #6c35ff)" stroke="var(--s1, #fff)" strokeWidth={2} />
      ))}
      {pts.map((p) => (
        <text
          key={`lbl-${p.label}`}
          x={p.x}
          y={pad.top + chartH + 16}
          textAnchor="middle"
          fontSize={9}
          fill="var(--t3, #94a3b8)"
          fontWeight={700}
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type View = 'overview' | 'list' | 'detail' | 'add' | 'success';

export default function AdminUsersClient({
  users,
  activities,
  roles: roleSummaries,
  totals,
  weeklyGrowth,
  recentUsers,
}: Props) {
  const [view, setView] = useState<View>('overview');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [joinedFilter, setJoinedFilter] = useState('All Time');
  const [registeredVia, setRegisteredVia] = useState('All');
  const [sort, setSort] = useState('Newest');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [bulkAction, setBulkAction] = useState('');
  const [exportFormat, setExportFormat] = useState('CSV');
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [notice, setNotice] = useState('');
  const [isPending, startTransition] = useTransition();
  const [userDonations, setUserDonations] = useState<UserDonation[]>([]);
  const [userCampaigns, setUserCampaigns] = useState<UserCampaign[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const filtered = useMemo(() => {
    const now = new Date();
    const list = users.filter((u) => {
      const hay = `${u.name} ${u.email} ${u.role} ${u.status} ${u.roles.join(' ')}`.toLowerCase();
      const matchQ = !query || hay.includes(query.toLowerCase());
      // roleFilter is already a lowercase value like 'admin', 'donor', 'user'
      const matchR = roleFilter === 'All Roles' || u.roles.includes(roleFilter);
      // statusFilter values: 'Active', 'Inactive', 'Suspended' — match AdminUser.status exactly
      const matchS = statusFilter === 'All Status' || u.status === statusFilter;
      let matchJ = true;
      if (joinedFilter !== 'All Time') {
        const d = new Date(u.joinedAt);
        const diff = (now.getTime() - d.getTime()) / 86400000;
        if (joinedFilter === 'Last 7 Days') matchJ = diff <= 7;
        else if (joinedFilter === 'Last 30 Days') matchJ = diff <= 30;
        else if (joinedFilter === 'Last 90 Days') matchJ = diff <= 90;
        else if (joinedFilter === 'This Year') matchJ = d.getFullYear() === now.getFullYear();
      }
      return matchQ && matchR && matchS && matchJ;
    });
    return [...list].sort((a, b) => {
      if (sort === 'Name') return a.name.localeCompare(b.name);
      if (sort === 'Most Raised') return b.totalRaisedCents - a.totalRaisedCents;
      return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
    });
  }, [users, query, roleFilter, statusFilter, joinedFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const selectedActivities = useMemo(
    () => activities.filter((a) => !selected || a.userId === selected.id).slice(0, 20),
    [activities, selected],
  );

  function goDetail(user: AdminUser) {
    setSelected(user);
    setActiveTab('Overview');
    setUserDonations([]);
    setUserCampaigns([]);
    setView('detail');
  }

  function mutateUser(url: string, method: string, body: Record<string, unknown>, success: string) {
    startTransition(async () => {
      setNotice('');
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice((data as { error?: string }).error ?? 'The action could not be completed.');
        return;
      }
      // Prefer the server's actual count over the caller's optimistic string —
      // the bulk endpoint used to report the requested count regardless of how
      // many writes really landed.
      const applied = (data as { updated?: number }).updated;
      setNotice(typeof applied === 'number' ? `${applied} user${applied === 1 ? '' : 's'} updated.` : success);
      setView('success');
      setTimeout(() => window.location.reload(), 900);
    });
  }

  function updateUser(body: Record<string, unknown>, success: string) {
    if (!selected) return;
    mutateUser(`/api/admin/users/${selected.id}`, 'PATCH', body, success);
  }

  function deleteUser() {
    if (!selected || !confirm(`Permanently delete ${selected.email}? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${selected.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice((data as { error?: string }).error ?? 'The user could not be deleted.');
        return;
      }
      setNotice('User deleted successfully.');
      setView('success');
      setTimeout(() => window.location.reload(), 900);
    });
  }

  function applyBulk() {
    if (!bulkAction || selectedIds.length === 0) return;
    mutateUser(
      '/api/admin/users/bulk',
      'POST',
      { action: bulkAction, ids: selectedIds },
      `${selectedIds.length} users updated.`,
    );
  }

  // ─── SECTION A: Overview ────────────────────────────────────────────────────
  if (view === 'overview') {
    return (
      <div className="users-layout">
        {notice && <div className="admin-user-notice">{notice}</div>}

        {/* KPI Row */}
        <div className="users-kpi-row">
          {[
            { label: 'Total Users',    value: totals.total === null ? '—' : totals.total.toLocaleString(), sub: totals.total === null ? 'unavailable' : 'all time' },
            // A percentage OF an unknown total is not a number worth printing.
            { label: 'Active Users',   value: totals.active.toLocaleString(),   sub: totals.total && totals.total > 0 ? `${Math.round((totals.active / totals.total) * 100)}% of total` : 'share of total unknown' },
            { label: 'New (30 days)',  value: totals.newUsers === null ? '—' : totals.newUsers.toLocaleString(), sub: totals.newUsers === null ? 'unavailable' : 'last 30 days' },
            { label: 'Suspended',      value: totals.suspended.toLocaleString(), sub: 'requires review' },
          ].map(({ label, value, sub }) => (
            <div className="users-kpi-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small style={{ color: 'var(--t3, #64748b)' }}>{sub}</small>
            </div>
          ))}
        </div>

        {/* Role breakdown — who actually holds what.
            This was computed and passed in but never rendered, so the console had
            no answer to "who has power here?" Admin and Super Admin are shown as
            separate rows because they are genuinely different: only Super Admin
            can grant roles and change platform settings. */}
        <div className="users-chart-card">
          <h3>Roles</h3>
          {/* The wrapper — not the <table> — carries tabIndex/role. Putting
              role="region" on the table itself would override its implicit `table`
              role and strip the row/column semantics screen readers rely on. It
              scrolls under 640px and its cells hold no focusable content, so
              without this a keyboard user cannot reach the "Users" column. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- axe scrollable-region-focusable; must stay on one line to be covered */}
          <div className="users-role-scroll" tabIndex={0} role="region" aria-label="Roles and how many users hold each">
          <table className="users-role-table">
            <caption className="sr-only">Number of users holding each platform role</caption>
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">What it means</th>
                <th scope="col" style={{ textAlign: 'right' }}>Users</th>
              </tr>
            </thead>
            <tbody>
              {roleSummaries.map((r) => (
                <tr key={r.key}>
                  <th scope="row" style={{ whiteSpace: 'nowrap' }}>
                    {r.role}
                    {r.system && (
                      <span className="users-role-tag" title="Granted automatically or reserved for staff">
                        system
                      </span>
                    )}
                  </th>
                  <td style={{ color: 'var(--t3, #64748b)' }}>{r.description}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    {r.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Growth Chart */}
        <div className="users-chart-card">
          <h3>User Growth — Last 8 Weeks</h3>
          <WeeklyLineChart data={weeklyGrowth} />
        </div>

        {/* Recent Users */}
        <div className="users-recent-card">
          <div className="users-recent-head">
            <h3>Recent Users</h3>
            <button onClick={() => setView('list')}>View all users →</button>
          </div>
          <div style={{ display: 'grid' }}>
            <div className="users-recent-row" style={{ fontWeight: 700, fontSize: 11, color: '#66708d', textTransform: 'uppercase' }}>
              <span>User</span><span>Role</span><span>Joined</span>
            </div>
            {recentUsers.map((u) => (
              <div className="users-recent-row" key={u.id} role="button" tabIndex={0} aria-label={`View user ${u.name}`} style={{ cursor: 'pointer' }} onClick={() => goDetail(u)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); goDetail(u); } }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={u.name} imageUrl={u.avatarUrl} />
                  <span>
                    <b style={{ display: 'block', fontSize: 13, color: '#0f1238', fontWeight: 650 }}>{u.name}</b>
                    <span style={{ fontSize: 11, color: '#66708d' }}>{u.email}</span>
                  </span>
                </span>
                <span style={rolePillColor(u.role)}>{u.role}</span>
                <span style={{ color: 'var(--t3, #66708d)', fontSize: 12 }}>{fmtDate(u.joinedAt)}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button className="kf-outline" onClick={() => setView('list')}>View all users →</button>
        </div>
      </div>
    );
  }

  // ─── SECTION B: Users List ──────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div style={{ position: 'relative' }}>
        {notice && <div className="admin-user-notice">{notice}</div>}

        {/* List header */}
        <div className="users-list-header">
          <h3>All Users</h3>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="kf-outline" onClick={() => setShowExport(true)}>Export</button>
            <button className="kf-primary" onClick={() => setView('add')}>+ Add User</button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="users-filter-bar">
          <label className="kf-search" style={{ flex: 1, minWidth: 200, height: 40 }}>
            <KFIcon name="search" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0); }}
              placeholder="Search by name, email..."
            />
          </label>
          <select className="users-filter-select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}>
            <option value="All Roles">All Roles</option>
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select className="users-filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
            <option>Suspended</option>
          </select>
          <select className="users-filter-select" value={joinedFilter} onChange={(e) => { setJoinedFilter(e.target.value); setPage(0); }}>
            <option>All Time</option>
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>Last 90 Days</option>
            <option>This Year</option>
          </select>
          <select className="users-filter-select" value={registeredVia} onChange={(e) => setRegisteredVia(e.target.value)}>
            <option>All</option>
            <option>Web</option>
            <option>Google</option>
            <option>Email</option>
          </select>
          <select className="users-filter-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option>Newest</option>
            <option>Name</option>
            <option>Most Raised</option>
          </select>
        </div>

        <div className="users-count-bar">
          Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} users
        </div>

        {/* Bulk bar */}
        {selectedIds.length > 0 && (
          <div className="users-bulk-bar">
            <strong>{selectedIds.length} users selected</strong>
            <button className="kf-outline" style={{ height: 34, fontSize: 12 }} onClick={() => setSelectedIds([])}>
              Clear Selection
            </button>
            <select className="users-filter-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
              <option value="">Select action</option>
              <option value="activate">Activate Users</option>
              <option value="suspend">Suspend Users</option>
              <option value="organizer">Change Role</option>
              <option value="delete">Delete Users</option>
            </select>
            <button className="kf-primary" style={{ height: 34, fontSize: 12 }} onClick={applyBulk} disabled={isPending || !bulkAction}>
              Apply
            </button>
            <button
              className="kf-outline"
              style={{ height: 34, fontSize: 12, marginLeft: 'auto' }}
              onClick={() => download('CharitMe-users.csv', toCsv(filtered.filter((u) => selectedIds.includes(u.id))))}
            >
              Export Users
            </button>
          </div>
        )}

        {/* Table */}
        <div className="admin-user-table">
          <div className="admin-user-row head">
            <span>
              <input
                type="checkbox"
                checked={selectedIds.length === paginated.length && paginated.length > 0}
                onChange={(e) =>
                  setSelectedIds(e.target.checked ? paginated.map((u) => u.id) : [])
                }
              />
            </span>
            <span>User</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Joined</span>
            <span />
          </div>
          {paginated.map((u) => (
            <div className="admin-user-row" key={u.id}>
              <span>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(u.id)}
                  onChange={(e) =>
                    setSelectedIds((ids) =>
                      e.target.checked ? [...ids, u.id] : ids.filter((id) => id !== u.id),
                    )
                  }
                />
              </span>
              <button onClick={() => goDetail(u)}>
                <Avatar name={u.name} imageUrl={u.avatarUrl} />
                <b>{u.name}</b>
              </button>
              <span>{u.email}</span>
              <span style={rolePillColor(u.role)}>{u.role}</span>
              <StatusPill>{u.status}</StatusPill>
              <span>{fmtDate(u.joinedAt)}</span>
              <button onClick={() => goDetail(u)}>View</button>
            </div>
          ))}
          {paginated.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--t3, #66708d)', fontSize: 14 }}>
              No users match the current filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="users-pagination">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} className={page === i ? 'active' : ''} onClick={() => setPage(i)}>
              {i + 1}
            </button>
          ))}
          <button disabled={page === totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>

        {/* Export overlay */}
        {showExport && (
          <ExportOverlay
            filtered={filtered}
            exportFormat={exportFormat}
            setExportFormat={setExportFormat}
            onClose={() => setShowExport(false)}
            onExport={() => {
              download('CharitMe-users.csv', toCsv(filtered));
              setShowExport(false);
            }}
          />
        )}
      </div>
    );
  }

  // ─── SECTION D: Add User ────────────────────────────────────────────────────
  if (view === 'add') {
    return (
      <div>
        {notice && (
          <div className="admin-user-notice" style={{ margin: '0 32px 16px', color: notice.toLowerCase().includes('success') ? 'var(--green-dark, #166534)' : 'var(--red, #b91c1c)', background: notice.toLowerCase().includes('success') ? 'rgba(22,163,74,.10)' : 'rgba(190,18,60,.08)', borderColor: notice.toLowerCase().includes('success') ? 'rgba(22,163,74,.25)' : 'rgba(190,18,60,.25)' }}>
            {notice}
          </div>
        )}
        <AddUserView
          pending={isPending}
          onCreate={(body) => {
            setNotice('');
            mutateUser('/api/admin/users', 'POST', body, 'User created successfully.');
          }}
          onCancel={() => { setNotice(''); setView('list'); }}
        />
      </div>
    );
  }

  // ─── SECTION E: Success ─────────────────────────────────────────────────────
  if (view === 'success') {
    return (
      <div className="users-success">
        <div className="users-success-icon">
          <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f1238' }}>Success!</h2>
        <p style={{ margin: 0, color: '#66708d', fontSize: 14 }}>
          {notice || 'The user has been updated successfully.'}
        </p>
        <button
          className="kf-primary"
          style={{ width: '100%', maxWidth: 320 }}
          onClick={() => { if (selected) { setView('detail'); } else { setView('list'); } }}
        >
          Back to User Details
        </button>
        <button className="kf-outline" style={{ width: '100%', maxWidth: 320 }} onClick={() => setView('list')}>
          Back to Users
        </button>
      </div>
    );
  }

  // ─── SECTION C: User Detail ─────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    return (
      <div>
        {notice && <div className="admin-user-notice">{notice}</div>}

        {/* Header */}
        <div className="users-detail-header">
          <button className="users-breadcrumb" onClick={() => setView('list')}>
            ← Back to Users
          </button>
          <div className="users-detail-user">
            <Avatar name={selected.name} imageUrl={selected.avatarUrl} />
            <div className="users-detail-name">
              <h2>{selected.name}</h2>
              <p>{selected.email}</p>
              <div className="users-detail-badges">
                <StatusPill>{selected.status}</StatusPill>
                <span style={rolePillColor(selected.role)}>{selected.role}</span>
              </div>
            </div>
          </div>
          {/* Had no handler. The Settings tab below already edits this user, so the
              button now takes you there instead of doing nothing. */}
          <button
            className="kf-outline"
            style={{ height: 38, fontSize: 13, padding: '0 14px' }}
            onClick={() => setActiveTab('Settings')}
          >
            Edit ✏️
          </button>
        </div>

        {/* Tab bar */}
        <div className="users-tabs">
          {['Overview', 'Activity', `Donations (${selected.donationsCount})`, `Campaigns (${selected.campaignsCount})`, 'Settings'].map((tab) => (
            <button
              key={tab}
              className={activeTab === tab || (tab.startsWith('Donations') && activeTab.startsWith('Donations')) || (tab.startsWith('Campaigns') && activeTab.startsWith('Campaigns')) ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {activeTab === 'Overview' && (
          <div className="users-detail-layout">
            {/* Left: User Information */}
            <div>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#0f1238' }}>User Information</h3>
              <div className="users-detail-info">
                {[
                  ['Full Name', selected.name],
                  ['Email', selected.email],
                  ['Timezone', selected.timezone],
                  ['Currency', selected.currency.toUpperCase()],
                  ['Joined Date', fmtDateTime(selected.joinedAt)],
                  ['Last Activity', fmtDateTime(selected.lastActivityAt)],
                  ['Registered Via', 'Web'],
                  ['Status', selected.status],
                  ['Identity Verified', selected.identityVerified ? 'Yes' : 'No'],
                  ['Plan', selected.plan],
                  ['Campaigns', String(selected.campaignsCount)],
                  ['Total Raised', money(selected.totalRaisedCents)],
                  ['Donations', String(selected.donationsCount)],
                  ['Total Donated', money(selected.totalDonatedCents)],
                ].map(([label, val]) => (
                  <div className="users-detail-row" key={label}>
                    <span>{label}</span>
                    <span>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: More Actions panel */}
            <div>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#0f1238' }}>More Actions</h3>
              <div className="users-actions-panel">
                <ActionBtn
                  icon="✏️"
                  title="Edit User"
                  onClick={() => {
                    setActiveTab('Settings');
                  }}
                />
                <ActionBtn
                  icon="👤"
                  title="Change Role"
                  onClick={() => {
                    const newRole = prompt('New role (donor / organizer / nonprofit / admin):');
                    if (newRole && ROLE_OPTIONS.some(o => o.value === newRole.toLowerCase())) {
                      updateUser({ role: newRole.toLowerCase(), action: newRole.toLowerCase() }, `Role changed to ${newRole}.`);
                    }
                  }}
                />
                <ActionBtn
                  icon="🔑"
                  title="Reset Password"
                  onClick={() => updateUser({ action: 'reset-password' }, 'Password reset email sent.')}
                  disabled={isPending}
                />
                <ActionBtn
                  icon="🚫"
                  title="Suspend User"
                  desc="Temporarily restrict user from accessing the platform."
                  onClick={() => updateUser({ action: 'suspend' }, 'User suspended.')}
                  disabled={isPending}
                />
                <ActionBtn
                  icon="✓"
                  title="Activate User"
                  desc="Restore user access to the platform."
                  onClick={() => updateUser({ action: 'activate' }, 'User activated.')}
                  disabled={isPending}
                />
                <ActionBtn
                  icon="🗑️"
                  title="Delete User"
                  desc="Permanently delete this user and all related data."
                  danger
                  onClick={deleteUser}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab: Activity */}
        {activeTab === 'Activity' && (
          <div>
            {/* The "Login History / Actions / Sessions" sub-tabs used to sit here.
                They were <button>s with no handler and the same single activity list
                rendered underneath whichever one you clicked — three tabs pretending
                to be filters. Removed rather than faked; the list below is all of it. */}
            <div className="users-tab-content">
              {selectedActivities.length === 0 && (
                <p style={{ color: 'var(--t3, #66708d)', fontSize: 13 }}>No activity recorded yet.</p>
              )}
              {selectedActivities.map((a) => (
                <div className="users-activity-item" key={a.id}>
                  <div className="users-activity-icon">
                    <KFIcon name={a.type === 'Donation' ? 'gift' : 'stack'} />
                  </div>
                  <div>
                    <b style={{ display: 'block', fontWeight: 650, color: '#0f1238', fontSize: 13 }}>{a.title}</b>
                    <span style={{ fontSize: 12, color: '#66708d' }}>
                      {a.detail}
                      {a.amount ? ` • ${a.amount}` : ''}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--t3, #94a3b8)', whiteSpace: 'nowrap' }}>
                    {fmtDateTime(a.createdAt)}
                  </span>
                </div>
              ))}
              {selectedActivities.length > 0 && (
                <Link
                  href={`/admin/audit-log?target=${encodeURIComponent(selected.id)}`}
                  style={{ display: 'inline-block', marginTop: 12, border: 0, background: 'transparent', color: '#6c35ff', fontSize: 12, fontWeight: 650, cursor: 'pointer', textDecoration: 'none' }}
                >
                  View all activity →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Tab: Donations */}
        {activeTab.startsWith('Donations') && (
          <DonationsTab userId={selected.id} donations={userDonations} setDonations={setUserDonations} loading={loadingDetail} setLoading={setLoadingDetail} />
        )}

        {/* Tab: Campaigns */}
        {activeTab.startsWith('Campaigns') && (
          <CampaignsTab userId={selected.id} campaigns={userCampaigns} setCampaigns={setUserCampaigns} loading={loadingDetail} setLoading={setLoadingDetail} />
        )}

        {/* Tab: Settings */}
        {activeTab === 'Settings' && (
          <SettingsTab user={selected} onSave={updateUser} pending={isPending} />
        )}

        {/* Footer */}
        <div className="users-detail-footer">
          {/* Was a <button> with no handler — it looked like an action and did
              nothing. The public profile already exists at /donors/[id]. */}
          <Link
            href={`/donors/${selected.id}`}
            className="kf-outline"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
          >
            View Public Profile
          </Link>
          <div style={{ position: 'relative' }}>
            <button className="kf-outline" onClick={() => setShowMoreActions((v) => !v)}>
              More Actions ▾
            </button>
            {showMoreActions && (
              <div style={{
                position: 'absolute',
                bottom: '110%',
                left: 0,
                minWidth: 200,
                background: 'var(--s1, #fff)',
                border: '1px solid var(--b1, #eef0f7)',
                borderRadius: 10,
                boxShadow: '0 8px 32px rgba(20,20,80,.14)',
                zIndex: 100,
                overflow: 'hidden',
              }}>
                {[
                  { label: 'Change Role', action: () => { setShowMoreActions(false); const r = prompt('New role (admin/user/donor/organizer/nonprofit):'); if (r && ROLE_OPTIONS.some(o => o.value === r.toLowerCase())) updateUser({ action: r.toLowerCase() }, `Role changed to ${r}.`); } },
                  { label: 'Reset Password', action: () => { setShowMoreActions(false); updateUser({ action: 'reset-password' }, 'Password reset email sent.'); } },
                  { label: 'Suspend User', action: () => { setShowMoreActions(false); updateUser({ action: 'suspend' }, 'User suspended.'); } },
                  { label: 'Activate User', action: () => { setShowMoreActions(false); updateUser({ action: 'activate' }, 'User activated.'); } },
                  { label: 'Delete User', danger: true, action: () => { setShowMoreActions(false); deleteUser(); } },
                ].map(({ label, danger, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 16px',
                      border: 0,
                      background: 'transparent',
                      textAlign: 'left',
                      fontSize: 13,
                      fontWeight: 650,
                      color: danger ? '#e11d48' : '#101842',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = danger ? 'rgba(190,18,60,.08)' : 'rgba(108,53,255,.08)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionBtn({
  icon,
  title,
  desc,
  danger = false,
  onClick,
  disabled = false,
}: {
  icon: string;
  title: string;
  desc?: string;
  danger?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`users-action-btn${danger ? ' danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="icon-wrap">{icon}</div>
      <div>
        <div className="users-action-title">{title}</div>
        {desc && <div className="users-action-desc">{desc}</div>}
      </div>
    </button>
  );
}

function DonationsTab({
  userId,
  donations,
  setDonations,
  loading,
  setLoading,
}: {
  userId: string;
  donations: UserDonation[];
  setDonations: (d: UserDonation[]) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
}) {
  useEffect(() => {
    if (donations.length > 0) return;
    setLoading(true);
    fetch(`/api/admin/users/${userId}/donations`)
      .then((r) => r.json())
      .then((data: { donations?: UserDonation[] }) => {
        setDonations(data.donations ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, donations.length, setDonations, setLoading]);

  return (
    <div className="users-tab-content">
      {loading && <p style={{ color: 'var(--t3, #66708d)', fontSize: 13 }}>Loading donations...</p>}
      {!loading && donations.length === 0 && (
        <p style={{ color: 'var(--t3, #66708d)', fontSize: 13 }}>No donations yet.</p>
      )}
      {!loading && donations.length > 0 && (
        <div className="users-donations-table">
          <div className="users-donations-row head">
            <span>Amount</span>
            <span>Campaign</span>
            <span>Status</span>
            <span>Date</span>
          </div>
          {donations.map((d) => (
            <div className="users-donations-row" key={d.id}>
              <span style={{ color: '#0f1238', fontWeight: 700 }}>{money(d.amountCents)}</span>
              <span>{d.campaignTitle}</span>
              <span>
                <span style={{ background: d.status === 'completed' ? '#dcfce7' : '#fef9c3', color: d.status === 'completed' ? '#166534' : '#854d0e', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 650 }}>
                  {d.status}
                </span>
              </span>
              <span style={{ color: 'var(--t3, #66708d)' }}>{fmtDate(d.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignsTab({
  userId,
  campaigns,
  setCampaigns,
  loading,
  setLoading,
}: {
  userId: string;
  campaigns: UserCampaign[];
  setCampaigns: (c: UserCampaign[]) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
}) {
  useEffect(() => {
    if (campaigns.length > 0) return;
    setLoading(true);
    fetch(`/api/admin/users/${userId}/campaigns`)
      .then((r) => r.json())
      .then((data: { campaigns?: UserCampaign[] }) => {
        setCampaigns(data.campaigns ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, campaigns.length, setCampaigns, setLoading]);

  return (
    <div className="users-tab-content">
      {loading && <p style={{ color: 'var(--t3, #66708d)', fontSize: 13 }}>Loading campaigns...</p>}
      {!loading && campaigns.length === 0 && (
        <p style={{ color: 'var(--t3, #66708d)', fontSize: 13 }}>No campaigns yet.</p>
      )}
      {!loading && campaigns.length > 0 && (
        <div className="users-campaigns-table">
          <div className="users-campaigns-row head">
            <span>Title</span>
            <span>Status</span>
            <span>Raised</span>
            <span>Goal</span>
            <span>Backers</span>
            <span>Date</span>
          </div>
          {campaigns.map((c) => (
            <div className="users-campaigns-row" key={c.id}>
              <span style={{ fontWeight: 650, color: '#0f1238' }}>{c.title}</span>
              <span>
                <span style={{ background: c.status === 'active' ? '#dcfce7' : '#f1f5f9', color: c.status === 'active' ? '#166534' : '#475569', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 650 }}>
                  {c.status}
                </span>
              </span>
              <span>{money(c.raisedAmount)}</span>
              <span>{money(c.goalAmount)}</span>
              <span>{c.backerCount.toLocaleString()}</span>
              <span style={{ color: 'var(--t3, #66708d)' }}>{fmtDate(c.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab({
  user,
  onSave,
  pending,
}: {
  user: AdminUser;
  onSave: (body: Record<string, unknown>, success: string) => void;
  pending: boolean;
}) {
  const [fullName, setFullName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role.toLowerCase());
  const [status, setStatus] = useState<string>(user.status);
  const [timezone, setTimezone] = useState(user.timezone);
  const [currency, setCurrency] = useState(user.currency.toUpperCase());
  const [plan, setPlan] = useState(user.plan);
  const [verified, setVerified] = useState(user.identityVerified);
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  function genPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    const pw = Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setNewPassword(pw);
    setShowPw(true);
  }

  function handleSave() {
    const body: Record<string, unknown> = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      role,
      status,
      timezone,
      currency: currency.toLowerCase(),
      plan: plan.toLowerCase(),
      identityVerified: verified,
    };
    if (newPassword.trim()) body.newPassword = newPassword.trim();
    onSave(body, 'User updated successfully.');
  }

  const pwValid = !newPassword || newPassword.length >= 8;

  return (
    <div className="users-tab-content">
      <div style={{ maxWidth: 480, display: 'grid', gap: 18 }}>

        <div className="users-add-field">
          <label htmlFor="au-fullname">Full Name</label>
          <input id="au-fullname" className="users-add-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
        </div>

        <div className="users-add-field">
          <label htmlFor="au-email">Email Address</label>
          <input id="au-email" className="users-add-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        </div>

        <div className="users-add-field">
          <label htmlFor="au-password">
            New Password
            <span style={{ fontWeight: 600, color: 'var(--t3, #8c9ab5)', marginLeft: 6, fontSize: 11 }}>(leave blank to keep current)</span>
          </label>
          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <input
              id="au-password"
              className="users-add-input"
              type={showPw ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 characters"
              style={{ flex: 1 }}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              style={{ position: 'absolute', right: 90, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3, #8c9ab5)', fontSize: 13, padding: '0 6px' }}>
              {showPw ? '🙈' : '👁'}
            </button>
            <button type="button" onClick={genPassword}
              style={{ height: 42, padding: '0 12px', border: '1.5px solid #dfe3f0', borderRadius: 10, background: '#f8f7ff', color: '#551cf2', fontSize: 12, fontWeight: 650, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Generate
            </button>
          </div>
          {newPassword && (
            <small style={{ color: newPassword.length >= 8 ? 'var(--green-dark, #166534)' : 'var(--red, #b91c1c)', fontSize: 11, marginTop: 3 }}>
              {newPassword.length >= 8 ? `✓ ${newPassword.length} characters` : `⚠ Need at least 8 (${newPassword.length} entered)`}
            </small>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="users-add-field">
            <label htmlFor="au-role">Role</label>
            <select id="au-role" className="users-add-select" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="users-add-field">
            <label htmlFor="au-status">Status</label>
            <select id="au-status" className="users-add-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="users-add-field">
            <label htmlFor="au-plan">Plan</label>
            <select id="au-plan" className="users-add-select" value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="free">Free</option>
              <option value="starter">Plus</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div className="users-add-field">
            <label htmlFor="au-currency">Currency</label>
            <select id="au-currency" className="users-add-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="users-add-field">
          <label htmlFor="au-timezone">Timezone</label>
          <select id="au-timezone" className="users-add-select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {[
              'America/New_York', 'America/Chicago', 'America/Denver',
              'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage',
              'Pacific/Honolulu', 'Europe/London', 'Europe/Paris',
              'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
              'Australia/Sydney', 'UTC',
            ].map((tz) => <option key={tz}>{tz}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label className="users-add-check" style={{ margin: 0 }}>
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            Identity Verified
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, paddingTop: 8, borderTop: '1px solid var(--b1, #f0f2f8)' }}>
          <button className="kf-primary" disabled={pending || !pwValid} onClick={handleSave}>
            {pending ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" className="kf-outline" disabled={pending}
            onClick={() => {
              setFullName(user.name);
              setEmail(user.email);
              setRole(user.role.toLowerCase());
              setStatus(user.status);
              setTimezone(user.timezone);
              setCurrency(user.currency.toUpperCase());
              setPlan(user.plan);
              setVerified(user.identityVerified);
              setNewPassword('');
            }}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function AddUserView({
  pending,
  onCreate,
  onCancel,
}: {
  pending: boolean;
  onCreate: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [sendWelcome, setSendWelcome] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [password, setPassword] = useState('');

  function genPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    setPassword(Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''));
    setShowPw(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      fullName: String(form.get('fullName') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      role: String(form.get('role') ?? 'donor'),
      status: String(form.get('status') ?? 'Active'),
      sendWelcome,
    };
    if (password.trim()) body.password = password.trim();
    onCreate(body);
  }

  return (
    <form className="users-add-form" onSubmit={handleSubmit}>
      <h2>Add New User</h2>

      <div className="users-add-field">
        <label htmlFor="addFullName">Full Name</label>
        <input
          id="addFullName"
          className="users-add-input"
          name="fullName"
          required
          placeholder="Enter full name"
        />
      </div>

      <div className="users-add-field">
        <label htmlFor="addEmail">Email</label>
        <input
          id="addEmail"
          className="users-add-input"
          name="email"
          type="email"
          required
          placeholder="Enter email address"
        />
      </div>

      <div className="users-add-field">
        <label htmlFor="addPassword">
          Password
          <span style={{ fontWeight: 600, color: 'var(--t3, #8c9ab5)', marginLeft: 6, fontSize: 11 }}>(leave blank to auto-generate)</span>
        </label>
        <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
          <input
            id="addPassword"
            className="users-add-input"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            style={{ flex: 1, paddingRight: 44 }}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            style={{ position: 'absolute', right: 90, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3, #8c9ab5)', fontSize: 13, padding: '0 6px' }}
          >
            {showPw ? '🙈' : '👁'}
          </button>
          <button
            type="button"
            onClick={genPassword}
            style={{ height: 42, padding: '0 12px', border: '1.5px solid #dfe3f0', borderRadius: 10, background: '#f8f7ff', color: '#551cf2', fontSize: 12, fontWeight: 650, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Generate
          </button>
        </div>
        {password && (
          <small style={{ color: password.length >= 8 ? 'var(--green-dark, #166534)' : 'var(--red, #b91c1c)', fontSize: 11, marginTop: 3 }}>
            {password.length >= 8 ? `✓ ${password.length} characters` : `⚠ Need at least 8 characters (${password.length} entered)`}
          </small>
        )}
      </div>

      <div className="users-add-field">
        <label htmlFor="addRole">Role</label>
        <select id="addRole" className="users-add-select" name="role">
          {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      <div className="users-add-field">
        <label htmlFor="addStatus">Status</label>
        <select id="addStatus" className="users-add-select" name="status">
          <option>Active</option>
          <option>Inactive</option>
          <option>Suspended</option>
        </select>
      </div>

      <label className="users-add-check">
        <input type="checkbox" checked={sendWelcome} onChange={(e) => setSendWelcome(e.target.checked)} />
        Send welcome / set-password email
      </label>

      <div className="users-add-actions">
        <button className="kf-outline" type="button" onClick={onCancel}>Cancel</button>
        <button className="kf-primary" type="submit" disabled={pending || (password.length > 0 && password.length < 8)}>
          {pending ? 'Creating…' : 'Create User'}
        </button>
      </div>
    </form>
  );
}

function ExportOverlay({
  filtered,
  exportFormat,
  setExportFormat,
  onClose,
  onExport,
}: {
  filtered: AdminUser[];
  exportFormat: string;
  setExportFormat: (v: string) => void;
  onClose: () => void;
  onExport: () => void;
}) {
  useEscape(onClose);

  return (
    // Backdrop dismissal is supplementary; Escape and the close button remain available.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="users-export-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="users-export-panel" role="dialog" aria-modal="true" aria-label="Export users">
        <div className="users-export-header">
          <span style={{ fontSize: 16, fontWeight: 700, color: '#0f1238' }}>Export Users</span>
          <button
            style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 20, color: 'var(--t3, #66708d)' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="users-export-body">
          <div className="users-export-field">
            <label htmlFor="ux-format">File Format</label>
            <select id="ux-format" className="users-export-select" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
              <option>CSV</option>
            </select>
          </div>
          <div className="users-export-field">
            <label htmlFor="ux-fields">Include Fields</label>
            <select id="ux-fields" className="users-export-select">
              <option>All Fields</option>
            </select>
          </div>
          <div className="users-export-field">
            <label htmlFor="ux-filter-role">Filters (Optional)</label>
            <select id="ux-filter-role" className="users-export-select" aria-label="Filter by role">
              <option>All Roles</option>
            </select>
            <select className="users-export-select" style={{ marginTop: 8 }} aria-label="Filter by status">
              <option>All Status</option>
            </select>
          </div>
          <p style={{ fontSize: 13, color: 'var(--t3, #66708d)', margin: 0 }}>
            {filtered.length} users will be exported.
          </p>
        </div>
        <div className="users-export-footer">
          <button className="kf-outline" onClick={onClose}>Cancel</button>
          <button className="kf-primary" onClick={onExport}>Export ↓</button>
        </div>
      </div>
    </div>
  );
}

// Keep unused helpers to avoid lint errors in case they're referenced elsewhere
const _initials = initials;
void _initials;
