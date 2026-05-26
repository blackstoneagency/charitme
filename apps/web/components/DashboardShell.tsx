'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type ShellVariant = 'dashboard' | 'admin';

type NavItem = {
  label: string;
  href: string;
  icon: string;
  badge?: number;
};

const DASHBOARD_NAV: NavItem[] = [
  { label: 'Dashboard',        href: '/dashboard',           icon: '⊞' },
  { label: 'My Campaigns',     href: '/campaigns',           icon: '📋' },
  { label: 'AI Growth Engine', href: '/ai-fundraising',      icon: '🚀' },
  { label: 'Donations',        href: '/dashboard/donations', icon: '💰' },
  { label: 'Donors',           href: '/dashboard/donor',     icon: '👥' },
  { label: 'Updates',          href: '/dashboard/updates',   icon: '📝' },
  { label: 'Payouts',          href: '/dashboard/payouts',   icon: '💳' },
  { label: 'Analytics',        href: '/dashboard/analytics', icon: '📊' },
  { label: 'Messages',         href: '/dashboard/messages',  icon: '✉️', badge: 8 },
  { label: 'Team',             href: '/dashboard/team',      icon: '🫂' },
  { label: 'Integrations',     href: '/dashboard/integrations', icon: '🔗' },
  { label: 'Settings',         href: '/profile',             icon: '⚙️' },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard',        href: '/admin',              icon: '⊞' },
  { label: 'Users',            href: '/admin/users',        icon: '👤' },
  { label: 'Campaigns',        href: '/admin/campaigns',    icon: '📋' },
  { label: 'Donations',        href: '/admin/donations',    icon: '💰' },
  { label: 'Payouts',          href: '/admin/payouts',      icon: '💳' },
  { label: 'Content',          href: '/admin/content',      icon: '📄' },
  { label: 'Reports',          href: '/admin/reports',      icon: '📊' },
  { label: 'Settings',         href: '/admin/settings',     icon: '⚙️' },
  { label: 'Audit Log',        href: '/admin/audit-log',    icon: '🗂️' },
  { label: 'System Settings',  href: '/admin/system',       icon: '🔧' },
];

type Props = {
  children: React.ReactNode;
  variant?: ShellVariant;
  user: { email: string; name?: string | null };
};

function NavLink({ item }: { item: NavItem }) {
  const path = usePathname();
  const active = path === item.href || (item.href !== '/' && path.startsWith(item.href + '/'));
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors"
      style={active
        ? { background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' }
        : { color: '#6b7280' }}
    >
      <span className="w-5 text-center text-base leading-none">{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black text-white" style={{ background: '#7c3aed' }}>
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function DashboardShell({ children, variant = 'dashboard', user }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const nav = variant === 'admin' ? ADMIN_NAV : DASHBOARD_NAV;
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">

      {/* ── SIDEBAR ── */}
      <aside
        className="flex shrink-0 flex-col border-r border-slate-200 bg-white"
        style={{ width: '220px', minHeight: '100vh' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          >
            ♥
          </div>
          <div>
            <div className="text-sm font-black leading-none text-slate-950">GiveRise</div>
            <div className="mt-0.5 text-[10px] text-slate-400">Fundraising that thinks for you.</div>
          </div>
        </div>

        {/* Create button (dashboard only) */}
        {variant === 'dashboard' && (
          <div className="px-3 pt-4">
            <Link
              href="/create"
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black text-white transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              <span className="text-lg leading-none">+</span>
              Create New Campaign
            </Link>
          </div>
        )}

        {/* Admin label */}
        {variant === 'admin' && (
          <div className="px-4 pt-4 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Admin
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {nav.map((item) => <NavLink key={item.href} item={item} />)}
        </nav>

        {/* Upgrade card (dashboard only) */}
        {variant === 'dashboard' && (
          <div className="mx-3 mb-3 rounded-2xl border border-violet-200 bg-violet-50 p-3">
            <div className="flex items-center gap-2 text-sm font-black text-violet-700">
              <span>♟</span> GiveRise Pro
            </div>
            <p className="mt-1 text-xs leading-4 text-violet-600">
              Unlock advanced AI tools, premium insights, and priority support.
            </p>
            <Link
              href="/pricing"
              className="mt-2.5 block rounded-lg py-1.5 text-center text-xs font-black text-violet-700 transition hover:bg-violet-200"
              style={{ background: 'rgba(124,58,237,0.12)' }}
            >
              Upgrade Now
            </Link>
          </div>
        )}

        {/* User */}
        <div className="flex items-center gap-2.5 border-t border-slate-100 px-4 py-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-black text-slate-950">{user.name ?? 'My Account'}</div>
            <div className="text-xs text-slate-400">{variant === 'admin' ? 'Super Admin' : 'Organizer'}</div>
          </div>
          <span className="text-slate-400 text-xs">▾</span>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile hamburger (hidden on desktop) */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-500">☰</button>
          <span className="text-sm font-black text-slate-950">GiveRise</span>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
