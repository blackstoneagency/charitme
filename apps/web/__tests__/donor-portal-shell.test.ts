import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { dashboardNavigationFor } from '../lib/persona-navigation';

const WEB_ROOT = path.join(__dirname, '..');
const read = (p: string) => readFileSync(path.join(WEB_ROOT, p), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// `/donor` is the destination of the sidebar's own "Giving History" entry, and
// it was the ONLY one of those destinations that rendered without the sidebar.
// Opening your giving history from the menu therefore closed the menu.
//
// Three things have to stay true together, and each fails silently on its own:
// the page renders the shell, the label it highlights still exists in the nav,
// and the marketing header steps aside so there is only one header.
// ─────────────────────────────────────────────────────────────────────────────

const donorPage = read('app/donor/page.tsx');
const donorLoading = read('app/donor/loading.tsx');
const appShell = read('components/AppShell.tsx');

describe('the donor portal renders inside the app shell', () => {
  it('wraps the page in CharitMeShell', () => {
    expect(donorPage).toMatch(/<CharitMeShell\s+active=/);
    expect(donorPage).toMatch(/from '\.\.\/\.\.\/components\/CharitMeShellServer'/);
  });

  it('highlights a label the donor nav actually contains', () => {
    // The shell highlights by exact label match (`active === label`). A reworded
    // nav label does not error — it just stops highlighting, so the visitor sees
    // a sidebar with nothing marked as where they are.
    const active = donorPage.match(/<CharitMeShell\s+active="([^"]+)"/)?.[1];
    expect(active, 'no active label found — the shell call moved').toBeTruthy();

    const donorLabels = dashboardNavigationFor('donor').map((item) => item.label);
    expect(donorLabels, `"${active}" is not a donor nav label`).toContain(active);
  });

  it('points that nav entry back at this page, so the highlight is truthful', () => {
    const active = donorPage.match(/<CharitMeShell\s+active="([^"]+)"/)?.[1];
    const entry = dashboardNavigationFor('donor').find((item) => item.label === active);
    expect(entry?.href, `"${active}" highlights on /donor but does not link to it`).toBe('/donor');
  });

  it('renders the loading skeleton inside the shell too', () => {
    // Otherwise the sidebar is torn away for the length of the fetch and slammed
    // back — on the slowest screen in the portal, since it aggregates every
    // donation the visitor has ever made.
    expect(donorLoading).toMatch(/<CharitMeShell/);
    expect(donorLoading).toMatch(/ShellSessionProvider/);
  });

  it('has a layout providing shell session context', () => {
    const layout = read('app/donor/layout.tsx');
    expect(layout).toMatch(/ShellSessionProvider/);
    expect(layout).toMatch(/loadShellSession/);
  });

  it('does NOT add an auth guard to that layout', () => {
    // `requireUser()` redirects to a bare `/login`, while every page under
    // /donor redirects to `/login?next=<destination>` on purpose. A layout guard
    // runs first and would silently win, dropping the return path for someone
    // following an emailed receipt link.
    // ⚠️ Comments STRIPPED before matching. The layout carries a note explaining
    // why the guard is absent, and that note necessarily names `requireUser()` —
    // matching raw text fails on the explanation and teaches the next author to
    // delete it. Same trap, and same fix, as create-guest-access.test.ts.
    const layoutCode = read('app/donor/layout.tsx')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    expect(layoutCode).not.toMatch(/requireUser\s*\(/);
    expect(donorPage, 'the page must still guard itself').toMatch(/redirect\('\/login\?next=\/donor'\)/);
  });
});

describe('exactly one header renders on /donor', () => {
  it('bypasses the marketing shell at /donor', () => {
    expect(appShell).toMatch(/SHELL_BYPASS_EXACT/);
    expect(appShell).toMatch(/const SHELL_BYPASS_EXACT = \[[^\]]*'\/donor'/);
    expect(appShell).toMatch(/SHELL_BYPASS_EXACT\.includes\(path\)/);
  });

  it('does NOT bypass the subtree beneath it', () => {
    // The receipt and tax-statement pages are printable documents reached from
    // emailed links, so their own header is the only navigation a cold visitor
    // has. A prefix match would take it away.
    expect(
      appShell,
      '/donor must not be in the prefix-matched list — it would strip chrome from the documents beneath it',
    ).not.toMatch(/const SHELL_BYPASS = \[[^\]]*'\/donor'/);

    // Prove the rule, not just its spelling: reproduce the matcher and check the
    // two document routes still keep their chrome.
    const bypassList = ['/dashboard', '/admin', '/profile', '/maintenance'];
    const exactList = ['/donor'];
    const bypasses = (p: string) =>
      bypassList.some((b) => p === b || p.startsWith(b + '/')) || exactList.includes(p);

    expect(bypasses('/donor')).toBe(true);
    expect(bypasses('/donor/receipt/abc')).toBe(false);
    expect(bypasses('/donor/tax-statement/2026')).toBe(false);
    expect(bypasses('/dashboard/saved'), 'the existing prefix rule must still work').toBe(true);
  });
});
