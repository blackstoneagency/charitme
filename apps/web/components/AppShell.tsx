'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '../lib/supabase-browser';

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
const SHELL_BYPASS = ['/dashboard', '/admin', '/profile', '/create'];

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
  const supabase = useMemo(() => createClient(), []);
  const bypass = SHELL_BYPASS.some((p) => path === p || path.startsWith(p + '/'));

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, [supabase]);

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
            {user ? (
              <>
                <Link href="/dashboard" className="kind-start">Dashboard</Link>
                <button
                  className="kind-login kind-signout-btn"
                  onClick={async () => {
                    await fetch('/api/auth/signout', { method: 'POST' });
                    window.location.href = '/login';
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="kind-login">Log in</Link>
                <Link href="/login?mode=signup" className="kind-start">Get Started</Link>
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
                <Link href="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, font: 'inherit', color: 'inherit' }}
                  onClick={async () => {
                    setMenuOpen(false);
                    await fetch('/api/auth/signout', { method: 'POST' });
                    window.location.href = '/login';
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)}>Log in</Link>
                <Link href="/login?mode=signup" onClick={() => setMenuOpen(false)}>Get Started</Link>
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
