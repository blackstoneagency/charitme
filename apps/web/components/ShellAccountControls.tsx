'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from './ThemeProvider';

type Props = {
  name?: string | null;
  email?: string | null;
};

const ACCOUNT_MENU = [
  ['Dashboard', '/dashboard'],
  ['Profile', '/profile'],
  ['Your fundraisers', '/dashboard/campaigns'],
  ['Your impact', '/donor'],
  ['Messages', '/dashboard/messages'],
  ['Account settings', '/dashboard/settings'],
] as const;

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function ShellAccountControls({ name, email }: Props) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sessionAccount, setSessionAccount] = useState<Props>({});
  const accountRef = useRef<HTMLDivElement | null>(null);
  const resolvedName = name || sessionAccount.name;
  const resolvedEmail = email || sessionAccount.email;
  const displayName = (resolvedName || resolvedEmail?.split('@')[0] || 'Account').split(' ')[0] ?? 'Account';
  const avatarInitial = (displayName[0] ?? 'A').toUpperCase();

  useEffect(() => {
    if (name || email) return;
    let cancelled = false;
    // Plain fetch instead of supabase-browser: keeps @supabase/supabase-js
    // out of the client bundle of every page that renders the shell.
    fetch('/api/profile')
      .then((response) => response.ok ? response.json() : null)
      .then((data: { profile?: { full_name?: string | null }; email?: string | null } | null) => {
        if (cancelled || !data) return;
        setSessionAccount({
          name: data.profile?.full_name ?? null,
          email: data.email ?? null,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [email, name]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/notifications/count')
      .then((response) => response.ok ? response.json() : { count: 0 })
      .then((data: { count?: number }) => {
        if (!cancelled) setUnreadCount(data.count ?? 0);
      })
      .catch(() => {
        if (!cancelled) setUnreadCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountOpen]);

  const signOut = async (): Promise<void> => {
    await fetch('/api/auth/signout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="kind-auth kf-shell-account-controls">
      <ThemeToggle />
      <Link href="/campaigns" className="kind-search-btn" aria-label="Search campaigns">
        <SearchIcon />
      </Link>
      <Link
        href="/dashboard/notifications"
        className="kind-bell"
        aria-label={unreadCount > 0 ? `${unreadCount} notifications` : 'Notifications'}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="kind-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </Link>
      <div className="kind-user-wrap" ref={accountRef}>
        <button
          type="button"
          className="kind-user-btn"
          aria-expanded={accountOpen}
          aria-haspopup="menu"
          onClick={() => setAccountOpen((open) => !open)}
        >
          <span className="kind-avatar-sm">{avatarInitial}</span>
          <span className="kind-user-name">{displayName}</span>
          <svg className={`kind-user-caret${accountOpen ? ' open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {accountOpen && (
          <div className="kind-user-menu" role="menu">
            {ACCOUNT_MENU.map(([label, href]) => (
              <Link key={href} href={href} role="menuitem" onClick={() => setAccountOpen(false)}>
                {label}
              </Link>
            ))}
            <button type="button" role="menuitem" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
