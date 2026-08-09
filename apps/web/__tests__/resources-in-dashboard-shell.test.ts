import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WEB = resolve(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const page = read('app/resources/page.tsx');
const appShell = read('components/AppShell.tsx');
const middleware = read('middleware.ts');
const layout = read('app/layout.tsx');

/**
 * `/resources` is in the dashboard sidebar for every persona (`RESOURCE_NAV` in
 * lib/persona-navigation.ts) but is also a public marketing page. Signed in it
 * must render inside the dashboard shell; signed out it must stay exactly the
 * public page search engines and share links see.
 */
describe('/resources renders in the shell that matches the session', () => {
  it('draws the dashboard shell only when there is a user', () => {
    expect(page).toContain("const user = await getUser();");
    expect(page).toContain('if (!user) return <ResourcesContent />;');
    expect(page).toContain('<CharitMeShell active="Resources">');
  });

  it('renders the same content in both, from one definition', () => {
    // Two copies of this markup is the duplication this repo keeps paying for.
    expect((page.match(/function ResourcesContent\(\)/g) ?? []).length).toBe(1);
    expect((page.match(/<ResourcesContent \/>/g) ?? []).length).toBe(2);
  });

  it('keeps the public page indexable and unchanged', () => {
    // The signed-out render is what gets crawled. Its canonical must not move
    // just because the signed-in frame changed.
    expect(page).toContain("canonical: 'https://www.charitme.com/resources'");
  });

  it('marks the sidebar entry active', () => {
    // Without this the sidebar highlights whatever matched last — the reported
    // screenshot showed "Settings" lit while viewing Resources.
    expect(page).toContain('active="Resources"');
  });

  it('does not stack two <h1>s', () => {
    // TopBar renders its title as an <h1>, and the page's hero already has one.
    // The account controls are rendered without it for exactly this reason.
    expect(page).not.toMatch(/<TopBar[^>]*title=/);
    expect(page).toContain('ShellAccountControls');
  });
});

describe('the public chrome steps aside without a flash', () => {
  it('AppShell bypasses on a server-provided session flag', () => {
    // NOT on its own `user` state: that is filled by an effect, so the public
    // header would render and be stripped a moment later — a visible flash of
    // two navigations and two logos.
    expect(appShell).toContain('SHELL_BYPASS_WHEN_SIGNED_IN');
    expect(appShell).toContain("SHELL_BYPASS_WHEN_SIGNED_IN = ['/resources']");
    expect(appShell).toMatch(/hasSession && SHELL_BYPASS_WHEN_SIGNED_IN\.some/);
  });

  it('the flag comes from middleware, which already resolved the session', () => {
    expect(middleware).toContain('SESSION_HINT_HEADER');
    expect(middleware).toMatch(/requestHeaders\.set\(SESSION_HINT_HEADER, user \? '1' : '0'\)/);
    expect(layout).toContain('SESSION_HINT_HEADER');
    expect(layout).toContain('hasSession={hasSession}');
  });

  it('rebuilds the response after setting it', () => {
    // ⚠️ The failure this pins: `NextResponse.next({ request })` snapshots the
    // headers at CALL time, and the first call happens before the session is
    // known. Setting the header afterwards changed nothing — the first attempt
    // at this silently did nothing at all, and the page kept both navigations.
    const at = middleware.indexOf('requestHeaders.set(SESSION_HINT_HEADER');
    expect(at).toBeGreaterThan(-1);
    expect(middleware.slice(at, at + 1400)).toContain('response = nextResponse();');
  });

  it('carries already-written cookies across the rebuild', () => {
    // The Supabase client may have set refreshed auth cookies on the old
    // response object. Dropping them would sign people out on any request that
    // happened to refresh a token.
    const at = middleware.indexOf('requestHeaders.set(SESSION_HINT_HEADER');
    const region = middleware.slice(at, at + 1400);
    expect(region).toContain('response.cookies.getAll()');
    expect(region).toMatch(/for \(const c of carried\) response\.cookies\.set\(c\)/);
  });
});

describe('every card on /resources points at a page that exists', () => {
  /** Static route paths from app/**\/page.tsx, honouring (groups). */
  function routeExists(path: string): boolean {
    const segs = path.replace(/^\//, '').split('/').filter(Boolean);
    const walk = (dir: string, rest: string[]): boolean => {
      if (!existsSync(dir)) return false;
      if (rest.length === 0) return existsSync(join(dir, 'page.tsx'));
      const [head, ...tail] = rest;
      if (existsSync(join(dir, head))) return walk(join(dir, head), tail);
      // Route groups are transparent in the URL.
      for (const entry of readdirSync(dir)) {
        if (!entry.startsWith('(')) continue;
        const abs = join(dir, entry);
        if (statSync(abs).isDirectory() && walk(abs, rest)) return true;
      }
      // A dynamic segment matches anything.
      for (const entry of readdirSync(dir)) {
        if (!entry.startsWith('[')) continue;
        const abs = join(dir, entry);
        if (statSync(abs).isDirectory() && walk(abs, tail)) return true;
      }
      return false;
    };
    return walk(join(WEB, 'app'), segs);
  }

  // The page's own comment claims "Every card here points at a page that
  // EXISTS". Nothing enforced it, and a card linking to a 404 is worse than no
  // card: the index is the page's entire purpose.
  const hrefs = [...page.matchAll(/href: '(\/[^']*)'/g)].map((m) => m[1]);

  it('finds the cards at all', () => {
    expect(hrefs.length).toBeGreaterThanOrEqual(16);
  });

  it.each(hrefs)('%s resolves to a real route', (href) => {
    expect(routeExists(href), `${href} has no page.tsx`).toBe(true);
  });
});
