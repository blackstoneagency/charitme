'use client';

import type React from 'react';
import { useMemo, useState, useTransition } from 'react';
import { KFIcon, StatusPill, Avatar } from '../../../../components/KindFundApp';

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

type Props = {
  users: AdminUser[];
  activities: AdminUserActivity[];
  roles: UserRoleSummary[];
  totals: { total: number; newUsers: number; active: number; suspended: number };
};

type View = 'list' | 'detail' | 'edit' | 'add' | 'activity' | 'roles' | 'export' | 'import' | 'success';

const ROLE_OPTIONS = ['donor', 'organizer', 'nonprofit', 'beneficiary', 'admin'];
const STATUS_OPTIONS = ['All Status', 'Active', 'Inactive', 'Suspended'];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

function toCsv(users: AdminUser[]): string {
  const header = ['Name', 'Email', 'Role', 'Status', 'Plan', 'Verified', 'Campaigns', 'Donations', 'Raised', 'Donated', 'Joined'];
  const rows = users.map((user) => [
    user.name,
    user.email,
    user.role,
    user.status,
    user.plan,
    user.identityVerified ? 'Yes' : 'No',
    String(user.campaignsCount),
    String(user.donationsCount),
    money(user.totalRaisedCents),
    money(user.totalDonatedCents),
    fmtDate(user.joinedAt),
  ]);
  return [header, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
}

function download(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminUsersClient({ users, activities, roles, totals }: Props) {
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<AdminUser | null>(users[0] ?? null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [sort, setSort] = useState('Newest');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const list = users.filter((user) => {
      const haystack = `${user.name} ${user.email} ${user.role} ${user.status}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query.toLowerCase());
      const matchesRole = roleFilter === 'All Roles' || user.roles.includes(roleFilter.toLowerCase());
      const matchesStatus = statusFilter === 'All Status' || user.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
    return [...list].sort((a, b) => {
      if (sort === 'Name') return a.name.localeCompare(b.name);
      if (sort === 'Most Raised') return b.totalRaisedCents - a.totalRaisedCents;
      return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
    });
  }, [users, query, roleFilter, statusFilter, sort]);

  const selectedActivities = useMemo(
    () => activities.filter((activity) => !selected || activity.userId === selected.id).slice(0, 20),
    [activities, selected],
  );

  const mutateUser = (url: string, body: Record<string, unknown>, success: string) => {
    startTransition(async () => {
      setNotice('');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(data.error ?? 'The action could not be completed.');
        return;
      }
      setNotice(success);
      setView('success');
      setTimeout(() => window.location.reload(), 900);
    });
  };

  const updateUser = (body: Record<string, unknown>, success: string) => {
    if (!selected) return;
    startTransition(async () => {
      setNotice('');
      const response = await fetch(`/api/admin/users/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(data.error ?? 'The user could not be updated.');
        return;
      }
      setNotice(success);
      setView('success');
      setTimeout(() => window.location.reload(), 900);
    });
  };

  const deleteUser = () => {
    if (!selected || !confirm(`Permanently delete ${selected.email}? This cannot be undone.`)) return;
    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${selected.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(data.error ?? 'The user could not be deleted.');
        return;
      }
      setNotice('User deleted successfully.');
      setView('success');
      setTimeout(() => window.location.reload(), 900);
    });
  };

  const bulkAction = (action: string) => {
    mutateUser('/api/admin/users/bulk', { action, ids: selectedIds }, `${selectedIds.length} users updated.`);
  };

  return (
    <div className="admin-users">
      <section className="admin-user-metrics">
        {[
          ['All Users', totals.total.toLocaleString(), 'users'],
          ['Active', totals.active.toLocaleString(), 'active accounts'],
          ['New', totals.newUsers.toLocaleString(), 'last 30 days'],
          ['Suspended', totals.suspended.toLocaleString(), 'restricted'],
        ].map(([label, value, meta], index) => (
          <article className="kf-card kf-metric" key={label}>
            <div className={`kf-square ${['violet', 'green', 'blue', 'orange'][index]}`}><KFIcon name={index === 0 ? 'users' : index === 1 ? 'check' : index === 2 ? 'team' : 'audit'} /></div>
            <div><span>{label}</span><strong>{value}</strong><small>{meta}</small></div>
          </article>
        ))}
      </section>

      <section className="admin-user-shell">
        <aside className="admin-user-rail">
          {[
            ['list', 'Users', 'users'],
            ['add', 'Add User', 'plus'],
            ['activity', 'Activity', 'audit'],
            ['roles', 'Roles', 'sliders'],
            ['export', 'Export', 'upload'],
            ['import', 'Import', 'upload'],
          ].map(([key, label, icon]) => (
            <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key as View)}>
              <KFIcon name={icon} /> {label}
            </button>
          ))}
        </aside>

        <main className="admin-user-panel">
          {notice && <div className="admin-user-notice">{notice}</div>}
          {view === 'list' && (
            <>
              <div className="admin-user-toolbar">
                <label className="kf-search"><KFIcon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users..." /></label>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                  <option>All Roles</option>
                  {ROLE_OPTIONS.map((role) => <option key={role}>{role}</option>)}
                </select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
                </select>
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option>Newest</option>
                  <option>Name</option>
                  <option>Most Raised</option>
                </select>
                <button className="kf-primary" onClick={() => setView('add')}><KFIcon name="plus" /> Add User</button>
              </div>
              {selectedIds.length > 0 && (
                <div className="admin-user-bulk">
                  <strong>{selectedIds.length} users selected</strong>
                  <button onClick={() => bulkAction('activate')}>Activate Users</button>
                  <button onClick={() => bulkAction('suspend')}>Suspend Users</button>
                  <button onClick={() => bulkAction('organizer')}>Change Role</button>
                  <button onClick={() => download('kindfund-users.csv', toCsv(filtered.filter((user) => selectedIds.includes(user.id))))}>Export Users</button>
                </div>
              )}
              <div className="admin-user-table">
                <div className="admin-user-row head"><span><input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={(event) => setSelectedIds(event.target.checked ? filtered.map((user) => user.id) : [])} /></span><span>User</span><span>Email</span><span>Role</span><span>Status</span><span>Joined</span><span /></div>
                {filtered.map((user) => (
                  <div className="admin-user-row" key={user.id}>
                    <span><input type="checkbox" checked={selectedIds.includes(user.id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, user.id] : ids.filter((id) => id !== user.id))} /></span>
                    <button onClick={() => { setSelected(user); setView('detail'); }}><Avatar name={user.name} imageUrl={user.avatarUrl} /><b>{user.name}</b></button>
                    <span>{user.email}</span>
                    <span>{user.role}</span>
                    <StatusPill>{user.status}</StatusPill>
                    <span>{fmtDate(user.joinedAt)}</span>
                    <button onClick={() => { setSelected(user); setView('detail'); }}>View</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {view === 'detail' && selected && (
            <UserDetails user={selected} activities={selectedActivities} onEdit={() => setView('edit')} onActivity={() => setView('activity')} onAction={updateUser} onDelete={deleteUser} pending={isPending} />
          )}

          {view === 'edit' && selected && (
            <EditUser user={selected} onCancel={() => setView('detail')} onSave={updateUser} pending={isPending} />
          )}

          {view === 'add' && <AddUser pending={isPending} onCreate={(body) => mutateUser('/api/admin/users', body, 'User created successfully.')} />}

          {view === 'activity' && <ActivityView activities={selected ? selectedActivities : activities.slice(0, 80)} selected={selected} onBack={() => setView(selected ? 'detail' : 'list')} />}

          {view === 'roles' && <RolesView roles={roles} />}

          {view === 'export' && <ExportView users={filtered} onExport={(rows) => download('kindfund-users.csv', toCsv(rows))} />}

          {view === 'import' && <ImportView pending={isPending} onImport={(rows) => mutateUser('/api/admin/users/bulk', { action: 'import', users: rows }, `${rows.length} users imported.`)} />}

          {view === 'success' && (
            <div className="admin-user-success">
              <div><KFIcon name="check" /></div>
              <h2>Success!</h2>
              <p>{notice || 'Your changes have been saved.'}</p>
              <button className="kf-primary" onClick={() => setView(selected ? 'detail' : 'list')}>Back to User Details</button>
              <button className="kf-outline" onClick={() => setView('list')}>Back to Users</button>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}

function UserDetails({ user, activities, onEdit, onActivity, onAction, onDelete, pending }: { user: AdminUser; activities: AdminUserActivity[]; onEdit: () => void; onActivity: () => void; onAction: (body: Record<string, unknown>, success: string) => void; onDelete: () => void; pending: boolean }) {
  return (
    <div className="admin-user-detail">
      <div className="admin-user-profile">
        <Avatar name={user.name} imageUrl={user.avatarUrl} />
        <div><h2>{user.name}</h2><p>{user.email}</p></div>
        <StatusPill>{user.status}</StatusPill>
      </div>
      <div className="admin-user-tabs"><button className="active">Overview</button><button onClick={onActivity}>Activity</button><button>Donations ({user.donationsCount})</button><button>Campaigns ({user.campaignsCount})</button></div>
      <div className="admin-user-facts">
        <span>Role <b>{user.role}</b></span>
        <span>Member Since <b>{fmtDate(user.joinedAt)}</b></span>
        <span>Status <b>{user.status}</b></span>
        <span>Plan <b>{user.plan}</b></span>
        <span>Total Donations <b>{money(user.totalDonatedCents)}</b></span>
        <span>Total Raised <b>{money(user.totalRaisedCents)}</b></span>
        <span>Last Activity <b>{fmtDateTime(user.lastActivityAt)}</b></span>
        <span>Identity <b>{user.identityVerified ? 'Verified' : 'Unverified'}</b></span>
      </div>
      <div className="admin-user-actions">
        <button className="kf-primary" onClick={onEdit}>Edit User</button>
        <button className="kf-outline" disabled={pending} onClick={() => onAction({ action: 'reset-password' }, 'Password reset email requested.')}>Reset Password</button>
        <button className="kf-outline" disabled={pending} onClick={() => onAction({ action: user.status === 'Suspended' ? 'activate' : 'suspend' }, user.status === 'Suspended' ? 'User activated.' : 'User suspended.')}>{user.status === 'Suspended' ? 'Activate User' : 'Suspend User'}</button>
        <button className="kf-danger" disabled={pending} onClick={onDelete}>Delete User</button>
      </div>
      <section className="kf-card">
        <div className="kf-card-head"><h2>Recent Activity</h2><button onClick={onActivity}>View all</button></div>
        {activities.slice(0, 5).map((activity) => <ActivityItem key={activity.id} activity={activity} />)}
        {activities.length === 0 && <p className="admin-empty">No activity recorded yet.</p>}
      </section>
    </div>
  );
}

function EditUser({ user, onCancel, onSave, pending }: { user: AdminUser; onCancel: () => void; onSave: (body: Record<string, unknown>, success: string) => void; pending: boolean }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.roles.find((item) => item !== 'suspended' && item !== 'inactive') ?? 'donor');
  const [status, setStatus] = useState(user.status);
  const [verified, setVerified] = useState(user.identityVerified);
  return (
    <div className="admin-user-form">
      <h2>Edit User</h2>
      <label>Full Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Role<select value={role} onChange={(event) => setRole(event.target.value)}>{ROLE_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as AdminUser['status'])}><option>Active</option><option>Inactive</option><option>Suspended</option></select></label>
      <label className="admin-check"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} /> Identity verified</label>
      <div><button className="kf-outline" onClick={onCancel}>Cancel</button><button className="kf-primary" disabled={pending} onClick={() => onSave({ fullName: name, email, role, status, identityVerified: verified }, 'User updated successfully.')}>Save Changes</button></div>
    </div>
  );
}

function AddUser({ pending, onCreate }: { pending: boolean; onCreate: (body: Record<string, unknown>) => void }) {
  const [sendWelcome, setSendWelcome] = useState(true);
  const formSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onCreate({
      fullName: String(form.get('fullName') ?? ''),
      email: String(form.get('email') ?? ''),
      role: String(form.get('role') ?? 'donor'),
      status: String(form.get('status') ?? 'Active'),
      sendWelcome,
    });
  };
  return (
    <form className="admin-user-form" onSubmit={formSubmit}>
      <h2>Add User</h2>
      <label>Full Name<input name="fullName" required placeholder="Enter full name" /></label>
      <label>Email<input name="email" type="email" required placeholder="Enter email address" /></label>
      <label>Role<select name="role">{ROLE_OPTIONS.map((role) => <option key={role}>{role}</option>)}</select></label>
      <label>Status<select name="status"><option>Active</option><option>Inactive</option><option>Suspended</option></select></label>
      <label className="admin-check"><input type="checkbox" checked={sendWelcome} onChange={(event) => setSendWelcome(event.target.checked)} /> Send welcome email</label>
      <div><button className="kf-outline" type="button">Cancel</button><button className="kf-primary" disabled={pending}>Create User</button></div>
    </form>
  );
}

function ActivityView({ activities, selected, onBack }: { activities: AdminUserActivity[]; selected: AdminUser | null; onBack: () => void }) {
  return (
    <div className="admin-user-activity">
      <button className="admin-back" onClick={onBack}>Back</button>
      <h2>{selected ? `${selected.name} Activity` : 'User Activity'}</h2>
      {activities.map((activity) => <ActivityItem key={activity.id} activity={activity} />)}
      {activities.length === 0 && <p className="admin-empty">No activity recorded yet.</p>}
    </div>
  );
}

function ActivityItem({ activity }: { activity: AdminUserActivity }) {
  return (
    <article className="admin-activity-item">
      <span><KFIcon name={activity.type === 'Donation' ? 'gift' : 'stack'} /></span>
      <div><b>{activity.title}</b><small>{activity.detail} {activity.amount ? `• ${activity.amount}` : ''}</small></div>
      <em>{fmtDateTime(activity.createdAt)}</em>
    </article>
  );
}

function RolesView({ roles }: { roles: UserRoleSummary[] }) {
  return (
    <div className="admin-role-grid">
      <div className="admin-section-head"><h2>Roles & Permissions</h2><button className="kf-primary"><KFIcon name="plus" /> Add Role</button></div>
      {roles.map((role) => (
        <article className="kf-card admin-role-card" key={role.key}>
          <div className="kf-square violet"><KFIcon name={role.key === 'admin' ? 'crown' : 'users'} /></div>
          <div><h3>{role.role}</h3><p>{role.description}</p><small>{role.count.toLocaleString()} users</small></div>
          <StatusPill>{role.system ? 'System' : 'Custom'}</StatusPill>
        </article>
      ))}
    </div>
  );
}

function ExportView({ users, onExport }: { users: AdminUser[]; onExport: (rows: AdminUser[]) => void }) {
  return (
    <div className="admin-user-form">
      <h2>Export Users</h2>
      <label>File Format<select><option>CSV</option></select></label>
      <label>Include Fields<select><option>All Fields</option></select></label>
      <p>{users.length.toLocaleString()} users match the current filters.</p>
      <div><button className="kf-outline" type="button">Cancel</button><button className="kf-primary" onClick={() => onExport(users)}>Export</button></div>
    </div>
  );
}

function ImportView({ pending, onImport }: { pending: boolean; onImport: (rows: Record<string, string>[]) => void }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const [head, ...lines] = text.split(/\r?\n/).filter(Boolean);
    const headers = head.split(',').map((item) => item.trim().toLowerCase());
    setRows(lines.map((line) => {
      const cells = line.split(',').map((item) => item.trim());
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
    }));
  };
  return (
    <div className="admin-user-form">
      <h2>Import Users</h2>
      <label className="admin-drop"><KFIcon name="upload" /><input type="file" accept=".csv" onChange={(event) => handleFile(event.target.files?.[0])} />Drag and drop CSV file here or click to browse</label>
      <p>{rows.length > 0 ? `${rows.length} users ready to import.` : 'CSV headers supported: fullName, email, role, status'}</p>
      <div><button className="kf-outline" type="button">Cancel</button><button className="kf-primary" disabled={pending || rows.length === 0} onClick={() => onImport(rows)}>Import</button></div>
    </div>
  );
}
