'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '../lib/supabase-browser';

const NAV = [
  ['Home', '/'],
  ['About Us', '/about-us'],
  ['How It Works', '/how-it-works'],
  ['AI Fundraising', '/ai-fundraising'],
  ['Success Stories', '/success-stories'],
  ['Pricing', '/pricing'],
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
    ['Guides', '/how-it-works'],
    ['Help Center', '/faq'],
    ['Webinars', '/contact'],
  ],
  Company: [
    ['About Us', '/about-us'],
    ['Careers', '/contact'],
    ['Press', '/contact'],
    ['Contact', '/contact'],
  ],
  Legal: [
    ['Trust & Safety', '/trust-safety'],
    ['Privacy Policy', '/contact'],
    ['Terms of Service', '/contact'],
    ['Security', '/trust-safety'],
  ],
} as const;

const SHELL_BYPASS = ['/dashboard', '/admin', '/profile', '/create'];

function Logo() {
  return (
    <Link href="/" className="kind-logo" aria-label="KindFund home">
      <span>
        <i />
        <b />
      </span>
      <strong>KindFund</strong>
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

  const shellClass = path === '/contact' ? 'kind-shell-contact' : '';

  return (
    <>
      <header className={`kind-header ${shellClass}`}>
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
            {user && <Link href="/dashboard" className="kind-login">Dashboard</Link>}
            {!user && <Link href="/login" className="kind-login">Log in</Link>}
            <Link href={user ? '/create' : '/login?mode=signup'} className="kind-start">Get Started</Link>
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
            <Link href="/login" onClick={() => setMenuOpen(false)}>Log in</Link>
            <Link href="/login?mode=signup" onClick={() => setMenuOpen(false)}>Get Started</Link>
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
            <h3>Get the app</h3>
            <div>
              <Link href="/">App Store</Link>
              <Link href="/">Google Play</Link>
            </div>
          </div>
          <div className="kind-social">
            <h3>Follow us</h3>
            <div>
              {['f', 'ig', 'in', 'tk', 'yt'].map((item) => <Link key={item} href="/">{item}</Link>)}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
