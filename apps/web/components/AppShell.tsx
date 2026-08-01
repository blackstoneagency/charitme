'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '../lib/supabase-browser';
import { ThemeToggle } from './ThemeProvider';
import AnnouncementBanner, { type Announcement, type BannerAppearance } from './AnnouncementBanner';
import FooterLocalePicker from './FooterLocalePicker';
import { useT } from './LocaleProvider';
import { FOOTER_LEGAL_BAR, FOOTER_SETTINGS_DEFAULTS, resolveFooterSections, type FooterSettings } from '../lib/footer-nav';
import { MAIN_NAV, flattenNav, type NavItem } from '../lib/main-nav';

// Structure lives in lib/main-nav.ts so the desktop bar and the mobile sheet
// render from ONE source. When each held its own list, a link added to one
// silently missed the other; `flattenNav()` derives the mobile list instead.

const ACCOUNT_MENU = [
  ['Dashboard', '/dashboard'],
  ['Profile', '/profile'],
  ['Your fundraisers', '/dashboard/campaigns'],
  ['Your impact', '/donor'],
  ['Achievements', '/achievements'],
  ['Messages', '/dashboard/messages'],
  ['Account settings', '/dashboard/settings'],
] as const;

// Footer structure lives in lib/footer-nav.ts, which DERIVES the rendered
// columns by removing whatever the legal bar already links to. Keeping the two
// lists here by hand is how "Terms of Service" and "Terms" ended up as two links
// to /terms in the same footer.
const FOOTER_SECTIONS_RENDERED = resolveFooterSections();

// Bypass the public marketing shell for routes that have their own shell (dashboard/admin)
// NOTE: /campaigns is intentionally NOT bypassed — public campaign pages need the header
// NOTE: /create is intentionally NOT bypassed — it now shows the global nav above its wizard
const SHELL_BYPASS = ['/dashboard', '/admin', '/profile'];

// Campaign embed widgets (/campaigns/[slug]/embed) are designed to run inside an
// <iframe> on third-party sites — they render their own minimal layout and must
// never include the site nav/footer.
//
// Exported because BackToTop needs the same rule and is mounted in the root
// layout rather than here. Two copies of this regex would eventually disagree,
// and the failure mode is a floating button appearing inside somebody else's
// page.
export function isEmbedRoute(path: string): boolean {
  return /^\/campaigns\/[^/]+\/embed\/?$/.test(path);
}

/**
 * One header dropdown.
 *
 * Opens on hover AND on click/keyboard, because hover alone is unusable by
 * keyboard and touch. The trigger is a real <button> with aria-expanded and
 * aria-controls so assistive tech announces the panel as an expandable region;
 * a <div> with a click handler would announce nothing.
 *
 * `onDismiss` returns focus to the trigger — Escape that drops focus to the top
 * of the document strands a keyboard user who was midway through the header.
 */
function NavMenu({
  item,
  open,
  onOpen,
  onClose,
  align,
}: {
  item: Extract<NavItem, { kind: 'menu' }>;
  open: boolean;
  onOpen: () => void;
  onClose: (returnFocus?: boolean) => void;
  align: 'left' | 'right';
}) {
  const t = useT();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  // Whether the panel currently open was opened by hover rather than by a click.
  //
  // Without this, a mouse user hovers the trigger (panel opens), clicks it, and
  // the click handler sees `open === true` and closes it again — the menu
  // flickers shut at the exact moment they tried to use it. It also made the
  // e2e spec non-deterministic: Playwright moves the pointer before clicking,
  // so whether the hover landed first decided the result, and the suite failed
  // at 1440px while passing at 1280/1366/1920.
  const hoverOpened = useRef(false);

  // Escape is bound at the document rather than via onKeyDown on the wrapper:
  // the wrapper is a plain <div>, and hanging a key handler on it makes it a
  // non-native interactive element that keyboard users cannot reach in the
  // first place. Bound here rather than in AppShell so this component can
  // return focus to its own trigger — an Escape that drops focus to the top of
  // the document strands someone midway through the header.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose(true);
      triggerRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    // Hover here is a pure enhancement layered on top of a fully operable
    // <button> — the menu opens and closes by click, Enter, Space and Escape
    // without it, and the panel's links are ordinary anchors. The rule fires on
    // any handler on a static element; adding a role to a div that exists only
    // to scope mouseleave across trigger+panel would announce a widget that
    // isn't one.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="kind-menu-wrap"
      onMouseEnter={() => { hoverOpened.current = !open; onOpen(); }}
      onMouseLeave={() => { hoverOpened.current = false; onClose(false); }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`kind-menu-trigger${open ? ' open' : ''}`}
        aria-expanded={open}
        aria-controls={`nav-panel-${item.id}`}
        onClick={() => {
          // A click on a panel that hover already opened means "I want this
          // open", not "close it". Claiming it for the click makes the NEXT
          // click close it, so the toggle still works.
          if (open && !hoverOpened.current) { onClose(false); return; }
          hoverOpened.current = false;
          onOpen();
        }}
      >
        {item.labelKey ? t(item.labelKey) : item.label}
        <svg className="kind-menu-caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Rendered only when open. Keeping it mounted and hidden with CSS would
          leave up to 20 links in the tab order on every page of the site. */}
      {open && (
        <div id={`nav-panel-${item.id}`} className={`kind-menu-panel align-${align}`}>
          <div className="kind-menu-cols" data-cols={item.columns.length}>
            {item.columns.map((col) => (
              <div key={col.heading} className="kind-menu-col">
                <h2 className="kind-menu-heading">{col.headingKey ? t(col.headingKey) : col.heading}</h2>
                <ul>
                  {col.links.map((link) => (
                    <li key={`${col.heading}-${link.href}-${link.label}`}>
                      <Link href={link.href} onClick={() => onClose(false)}>
                        <span className="kind-menu-label">{link.labelKey ? t(link.labelKey) : link.label}</span>
                        {link.description && (
                          <span className="kind-menu-desc">{link.description}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
                {col.footer && (
                  <Link className="kind-menu-more" href={col.footer.href} onClick={() => onClose(false)}>
                    {col.footer.labelKey ? t(col.footer.labelKey) : col.footer.label} <span aria-hidden="true">→</span>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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

/** The CPRA "Your Privacy Choices" mark. Decorative — the link text carries it. */
function PrivacyChoicesIcon() {
  return (
    <svg className="foot-pc-icon" viewBox="0 0 30 14" width="26" height="12" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="30" height="14" rx="7" fill="#06f" />
      <rect x="15" y="0" width="15" height="14" rx="7" fill="#fff" />
      <path d="M20.2 3.6h5.6l-5.6 6.8h5.6" fill="none" stroke="#06f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.5" cy="7" r="4.2" fill="#fff" />
      <path d="M5.6 7l1.5 1.5 2.8-3" fill="none" stroke="#06f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SOCIAL_ICONS: Record<string, JSX.Element> = {
  Facebook: <path d="M17 2h-3a5 5 0 0 0-5 5v3H6v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  YouTube: (
    <>
      <path d="M22.5 6.5a2.8 2.8 0 0 0-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 5.5 2.8 2.8 0 0 0 2 2C5.3 20 12 20 12 20s6.7 0 8.5-.5a2.8 2.8 0 0 0 2-2A29 29 0 0 0 23 12a29 29 0 0 0-.5-5.5z" />
      <polygon points="9.8,15.3 15.6,12 9.8,8.7" fill="var(--s1, #fff)" stroke="none" />
    </>
  ),
  X: <path d="M18.9 2H22l-7 8 8.2 12h-6.4l-5-7.3L5.9 22H2.8l7.5-8.6L2.4 2h6.6l4.5 6.6zM17.8 20h1.7L8.3 3.8H6.5z" />,
  Instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.2" />
    </>
  ),
};

function SocialLinks({ settings }: { settings: FooterSettings }) {
  // An empty URL means "not configured" — the icon is omitted rather than
  // rendered pointing at '#', which scrolls to top and reads as a broken site.
  const links = ([
    ['Facebook', settings.facebookUrl],
    ['YouTube', settings.youtubeUrl],
    ['X', settings.twitterUrl],
    ['Instagram', settings.instagramUrl],
  ] as const).filter(([, url]) => Boolean(url));

  if (links.length === 0) return null;

  return (
    <ul className="foot-social">
      {links.map(([name, url]) => (
        <li key={name}>
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`CharitMe on ${name}`}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {SOCIAL_ICONS[name]}
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}

function AppBadges({ settings }: { settings: FooterSettings }) {
  const badges = ([
    ['Google Play', settings.googlePlayUrl, 'Get it on Google Play'],
    ['App Store', settings.appStoreUrl, 'Download on the App Store'],
  ] as const).filter(([, url]) => Boolean(url));

  // The apps are not shipped yet. Advertising a store badge that goes nowhere
  // is worse than not showing one, so the whole row is omitted until a super
  // admin sets the URLs in Settings → Footer.
  if (badges.length === 0) return null;

  return (
    <div className="foot-badges">
      {badges.map(([name, url, label]) => (
        <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="foot-badge">
          <span className="foot-badge-sub">{label.split(' ').slice(0, -2).join(' ')}</span>
          <span className="foot-badge-name">{name}</span>
          <span className="sr-only">{label}</span>
        </a>
      ))}
    </div>
  );
}

export function AppShell({
  children,
  initialAnnouncements,
  bannerAppearance,
  footerSettings,
  initialLocale,
}: {
  children: React.ReactNode;
  initialAnnouncements?: Announcement[];
  bannerAppearance?: BannerAppearance;
  footerSettings?: FooterSettings;
  initialLocale?: string;
}) {
  const t = useT();
  const footer = footerSettings ?? FOOTER_SETTINGS_DEFAULTS;
  const path = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
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

  // Close both menus on navigation — a dropdown left open across a route change
  // hangs over the new page. Done during render rather than in an effect: the
  // effect version calls setState synchronously on every path change, which
  // triggers a second render pass (and trips the lint rule that exists to catch
  // exactly that). This is React's documented "adjust state while rendering"
  // pattern, and it discards the stale render instead of committing it.
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    setLastPath(path);
    setOpenMenu(null);
    setMenuOpen(false);
  }

  // Outside click closes whichever mega-menu is open. Escape is handled inside
  // NavMenu so it can also restore focus to the trigger it came from.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openMenu]);

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
          {/* Theme toggle sits immediately after the wordmark, per the design.
              Grouped with the account controls on the far right it read as an
              account setting rather than the site-wide control it is — and a
              signed-out visitor had no reason to look there for it. */}
          <ThemeToggle />
          {/*
            The design specifies two mega-dropdowns (Explore Causes, Resources).
            This replaces the grouped `PrimaryNavMenu` that landed on master in
            parallel: same goal — the header exposed 8 destinations while the
            footer carried 41 — but the design's structure, and hit-tested at
            every desktop width. Their groups' unique destinations (Crisis
            Relief, Grants, Give, Leaderboard) are preserved one click deeper on
            /get-involved rather than dropped.

            aria-label is translated; the link labels resolve through `t()` with
            keys registered in lib/locales/en.ts, so untranslated markets fall
            back to English text rather than raw key strings.
          */}
          <nav ref={navRef} aria-label={t('nav.menu')}>
            {MAIN_NAV.map((item) =>
              item.kind === 'link' ? (
                <Link key={item.href} href={item.href} className={path === item.href ? 'active' : ''}>
                  {item.labelKey ? t(item.labelKey) : item.label}
                  {item.isNew && <span className="kind-new">New</span>}
                </Link>
              ) : (
                <NavMenu
                  key={item.id}
                  item={item}
                  open={openMenu === item.id}
                  onOpen={() => setOpenMenu(item.id)}
                  onClose={() => setOpenMenu(null)}
                  // Resources is three columns wide; left-aligning it under a
                  // trigger that sits near the end of the bar pushes the panel
                  // off the right edge of the viewport.
                  align={item.id === 'resources' ? 'right' : 'left'}
                />
              ),
            )}
          </nav>
          <div className="kind-auth">
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
            {/* Derived from MAIN_NAV, not a second hand-kept list. The headings
                come through so the twenty cause links and twelve resource links
                are not one undifferentiated column. */}
            {flattenNav().map((link, i, all) => (
              <React.Fragment key={`${link.heading ?? ''}-${link.href}-${link.label}`}>
                {link.heading && link.heading !== all[i - 1]?.heading && (
                  <span className="kind-mobile-heading">{link.headingKey ? t(link.headingKey) : link.heading}</span>
                )}
                <Link href={link.href} onClick={() => setMenuOpen(false)}>{link.labelKey ? t(link.labelKey) : link.label}</Link>
              </React.Fragment>
            ))}
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
            {FOOTER_SECTIONS_RENDERED.map(({ name, links }) => (
              <div key={name}>
                <h3>{name}</h3>
                {links.map(({ label, href, labelKey }) => <Link key={label} href={href}>{t(labelKey)}</Link>)}
              </div>
            ))}
          </div>
          {footer.contactEmail && (
            <div className="kind-footer-apps">
              <h3>Contact</h3>
              <div>
                <a href={`mailto:${footer.contactEmail}`}>{footer.contactEmail}</a>
              </div>
            </div>
          )}
        </div>

        <div className="container foot-bottom">
          <div className="foot-bottom-top">
            <FooterLocalePicker initialLocale={initialLocale} />
            <SocialLinks settings={footer} />
          </div>

          <div className="foot-bottom-main">
            <nav className="foot-legal" aria-label="Legal">
              <span className="foot-copy">© {new Date().getFullYear()} CharitMe</span>
              {FOOTER_LEGAL_BAR.map(({ href, labelKey }) => (
                <Link key={href} href={href}>{t(labelKey)}</Link>
              ))}
            </nav>
            <AppBadges settings={footer} />
          </div>

          <div className="foot-bottom-prefs">
            {/* Both anchors land on /cookies, which is public. They must not point
                at /privacy-center — it calls requireUser(), so a visitor would be
                bounced to a login wall by a privacy control. */}
            <Link href="/cookies#preferences">Manage Cookie Preferences</Link>
            <Link href="/cookies#your-privacy-choices" className="foot-privacy-choices">
              Your Privacy Choices
              <PrivacyChoicesIcon />
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
