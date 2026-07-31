'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '../lib/supabase-browser';
import { ThemeToggle } from './ThemeProvider';
import AnnouncementBanner, { type Announcement, type BannerAppearance } from './AnnouncementBanner';

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
  ['Achievements', '/achievements'],
  ['Messages', '/dashboard/messages'],
  ['Account settings', '/dashboard/settings'],
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Footer navigation. This renders on EVERY public page, so every defect here is
// a site-wide defect. What was wrong:
//
//  * 13 links under "Platform" against 6 / 6 / 8 elsewhere, so the column ran
//    twice as long as its neighbours and left a large dead area beside them.
//  * TWO links went to auth-gated routes — `/impact/manage` and
//    `/privacy-center` — so a signed-out visitor clicking either was bounced to
//    /login with no explanation. Checked by __tests__/footer-links.test.ts now,
//    against the same e2e/public-routes.json the sweeps use.
//  * "Fundraising Guides" and "How It Works" pointed at the same URL.
//  * /give, /crisis, /nearby and /developers all shipped and were reachable
//    from nowhere in the footer.
//
// Groups are kept to a similar length on purpose: four ragged columns is the
// layout problem, and balancing the CONTENT fixes it at the source rather than
// papering over it with CSS.
// ─────────────────────────────────────────────────────────────────────────────
const FOOTER_LINKS = {
  Platform: [
    ['How It Works', '/how-it-works'],
    ['AI Fundraising', '/ai-fundraising'],
    ['AI Campaign Builder', '/ai-campaign'],
    ['Platform Features', '/features'],
    ['Fast Payouts', '/fast-payouts'],
    ['Pricing', '/pricing'],
    ['Success Stories', '/success-stories'],
    ['Leaderboard', '/leaderboard'],
    ['Developers & API', '/developers'],
  ],
  'Ways to Give': [
    ['Browse Campaigns', '/campaigns'],
    ['Give to Many Causes', '/give'],
    ['Crisis Relief', '/crisis'],
    ['Fundraisers Near You', '/nearby'],
    ['Volunteer', '/volunteer'],
    ['Sponsor a Cause', '/sponsor'],
    ['Matching Gifts', '/matching'],
    ['Grants', '/grants'],
    ['Events', '/events'],
  ],
  Company: [
    ['About Us', '/about-us'],
    ['Contact Us', '/contact'],
    ['For Nonprofits', '/for-nonprofits'],
    ['For Individuals', '/for-individuals'],
    ['For Donors', '/for-donors'],
    ['Blog', '/blog'],
    ['Help Center', '/help'],
    ['FAQ', '/faq'],
    ['Supported Countries', '/supported-countries'],
  ],
  'Legal & Trust': [
    ['Trust & Safety', '/trust-safety'],
    // `/impact`, not `/impact/manage` — the latter requires a session.
    ['Our Impact', '/impact'],
    ['Transparency Center', '/transparency'],
    ['Fee Policy', '/fees'],
    ['Refund Policy', '/refunds'],
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

// Campaign embed widgets (/campaigns/[slug]/embed) are designed to run inside an
// <iframe> on third-party sites — they render their own minimal layout and must
// never include the site nav/footer.
function isEmbedRoute(path: string): boolean {
  return /^\/campaigns\/[^/]+\/embed\/?$/.test(path);
}

function Logo() {
  return (
    <Link href="/" className="kind-logo" aria-label="CharitMe home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="kind-logo-img" width={34} height={34} />
      <strong>CharitMe</strong>
    </Link>
  );
}

export function AppShell({ children, initialAnnouncements, bannerAppearance }: { children: React.ReactNode; initialAnnouncements?: Announcement[]; bannerAppearance?: BannerAppearance }) {
  const path = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const bypass = SHELL_BYPASS.some((p) => path === p || path.startsWith(p + '/')) || isEmbedRoute(path);

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
      {/* WCAG 2.4.1 (Bypass Blocks): lets keyboard/AT users jump the header nav,
          which is otherwise ~15 tab stops on every page. Visually hidden until
          focused — it is the first thing Tab reaches. */}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <AnnouncementBanner initial={initialAnnouncements} appearance={bannerAppearance} />
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

      <main id="main-content" tabIndex={-1}>{children}</main>

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
