'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '../lib/supabase-browser';
import { ThemeToggle } from './ThemeProvider';

const NAV = [
  ['Home', '/'],
  ['AI Fundraising', '/ai-fundraising'],
  ['How It Works', '/how-it-works'],
  ['Pricing', '/pricing'],
  ['Success Stories', '/success-stories'],
  ['About Us', '/about-us'],
  ['Blog', '/blog'],
  ['Contact Us', '/contact'],
] as const;

const ACCOUNT_MENU = [
  ['Dashboard', '/dashboard'],
  ['Profile', '/profile'],
  ['Your fundraisers', '/dashboard/campaigns'],
  ['Your impact', '/donor'],
  ['Messages', '/dashboard/messages'],
  ['Account settings', '/dashboard/settings'],
] as const;

const FOOTER_LINKS = {
  Platform: [
    ['How It Works', '/how-it-works'],
    ['AI Fundraising', '/ai-fundraising'],
    ['Success Stories', '/success-stories'],
    ['Pricing', '/pricing'],
  ],
  Resources: [
    ['Blog', '/blog'],
    ['Help Center', '/help'],
    ['FAQ', '/faq'],
    ['Fundraising Guides', '/how-it-works'],
  ],
  Company: [
    ['About Us', '/about-us'],
    ['Contact Us', '/contact'],
    ['Pricing', '/pricing'],
    ['Trust & Safety', '/trust-safety'],
  ],
  Legal: [
    ['Privacy Policy', '/privacy'],
    ['Terms of Service', '/terms'],
    ['Security', '/security'],
    ['Prohibited Use', '/prohibited-use'],
  ],
} as const;

// Bypass the public marketing shell for routes that have their own shell (dashboard/admin)
// NOTE: /campaigns is intentionally NOT bypassed — public campaign pages need the header
// NOTE: /create is intentionally NOT bypassed — it now shows the global nav above its wizard
const SHELL_BYPASS = ['/dashboard', '/admin', '/profile'];

function Logo() {
  return (
    <Link href="/" className="kind-logo" aria-label="CharitMe home">
      <span>
        <i />
        <b />
      </span>
      <strong>CharitMe</strong>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const bypass = SHELL_BYPASS.some((p) => path === p || path.startsWith(p + '/'));

  const displayName = ((user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'Account').split(' ')[0];
  const avatarInitial = (displayName[0] ?? 'A').toUpperCase();

  const signOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    window.location.href = '/login';
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    if (user) {
      fetch('/api/notifications/count')
        .then(r => r.ok ? r.json() : { count: 0 })
        .then((d: { count?: number }) => { if (!cancelled) setUnreadCount(d.count ?? 0); })
        .catch(() => { if (!cancelled) setUnreadCount(0); });
    } else {
      Promise.resolve().then(() => { if (!cancelled) setUnreadCount(0); });
    }
    return () => { cancelled = true; };
  }, [user, path]);

  // Close the account dropdown on outside click
  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [accountOpen]);

  if (bypass) return <>{children}</>;

  return (
    <>
      <header className="kind-header">
        <div className="container">
          <Logo />
          <nav>
            {NAV.map(([label, href]) => (
              <Link key={href} href={href} className={path === href ? 'active' : ''}>
                {label}
                {label === 'AI Fundraising' && <span className="kind-new">New</span>}
              </Link>
            ))}
          </nav>
          <div className="kind-auth">
            <ThemeToggle />
            <Link href="/campaigns" className="kind-search-btn" aria-label="Search campaigns">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
              </svg>
            </Link>
            <Link
              href={user ? '/dashboard/notifications' : '/login'}
              className="kind-bell"
              aria-label={unreadCount > 0 ? `${unreadCount} notifications` : 'Notifications'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="kind-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </Link>
            {user ? (
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
                  <svg className={`kind-user-caret${accountOpen ? ' open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
            ) : (
              <>
                <Link href="/login" className="kind-signin">Sign in</Link>
                <Link href="/login?mode=signup" className="kind-start-pill">Start a CharitMe</Link>
              </>
            )}
          </div>
          <button className="kind-menu" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation">
            <span />
            <span />
            <span />
          </button>
        </div>
        {menuOpen && (
          <div className="kind-mobile">
            {NAV.map(([label, href]) => <Link key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</Link>)}
            {user ? (
              <>
                {ACCOUNT_MENU.map(([label, href]) => (
                  <Link key={href} href={href} onClick={() => setMenuOpen(false)}>
                    {label}{label === 'Dashboard' && unreadCount > 0 ? ` (${unreadCount > 99 ? '99+' : unreadCount})` : ''}
                  </Link>
                ))}
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, font: 'inherit', color: 'inherit' }}
                  onClick={() => {
                    setMenuOpen(false);
                    void signOut();
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)}>Sign in</Link>
                <Link href="/login?mode=signup" onClick={() => setMenuOpen(false)}>Start a CharitMe</Link>
              </>
            )}
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer className="kind-footer">
        <div className="container kind-footer-grid">
          <div className="kind-footer-brand">
            <Logo />
            <p>Intelligent fundraising.<br />Real world impact.</p>
          </div>
          <div className="kind-footer-links">
            {(Object.entries(FOOTER_LINKS) as [string, readonly (readonly [string, string])[]][]).map(([section, links]) => (
              <div key={section}>
                <h3>{section}</h3>
                {links.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
              </div>
            ))}
          </div>
          <div className="kind-footer-apps">
            <h3>Contact</h3>
            <div>
              <a href="mailto:hello@charitme.com">hello@charitme.com</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
