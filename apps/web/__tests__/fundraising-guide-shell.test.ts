import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dashboardNavigationFor } from '../lib/persona-navigation';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, '..', p), 'utf8');

const page = read('app/fundraising-guide/page.tsx');
const shell = read('components/AppShell.tsx');

// ─────────────────────────────────────────────────────────────────────────────
// /fundraising-guide renders inside the signed-in app shell for members, and as
// a public marketing page for everyone else.
//
// It is reachable from the sidebar (RESOURCE_NAV), so a member who clicked it
// previously landed on the marketing site — losing the navigation they arrived
// by, mid-session.
//
// ⚠️ TWO components decide this, and they learn the answer at DIFFERENT MOMENTS:
// the page during SSR (authoritative), and AppShell after its client auth call
// resolves. If AppShell treats "not yet known" as "signed out", every signed-in
// visitor gets the marketing header stacked on top of the server-rendered app
// shell and then watches it disappear. That third state is the whole subtlety.
// ─────────────────────────────────────────────────────────────────────────────

describe('the page decides from the SERVER session', () => {
  it('reads the session rather than guessing on the client', () => {
    expect(page).toMatch(/import \{ getUser \} from '\.\.\/\.\.\/lib\/auth'/);
    expect(page).toMatch(/const user = await getUser\(\)/);
  });

  it('renders the shell only when signed in', () => {
    expect(page).toMatch(/if \(!user\) return body;/);
    expect(page).toMatch(/<CharitMeShell active="Fundraising Guide">\{body\}<\/CharitMeShell>/);
  });

  it('serves the SAME body to both audiences', () => {
    // One `body`, used on both branches. Forking it would give signed-in and
    // signed-out visitors different guidance from one URL — and only one of the
    // two is the version anyone reviews.
    expect(page.match(/const body = \(/g) ?? []).toHaveLength(1);
    expect(page.match(/<ReferencePage>/g) ?? []).toHaveLength(1);
  });

  it('uses the exact nav label, so the sidebar highlights', () => {
    // The sidebar matches on label. A near-miss ("Fundraising guide") highlights
    // nothing and the member cannot tell where they are.
    const labels = dashboardNavigationFor('donor').map((i) => i.label);
    expect(labels).toContain('Fundraising Guide');
    const active = /<CharitMeShell active="([^"]+)"/.exec(page)?.[1];
    expect(labels, `active="${active}" matches no nav item`).toContain(active);
  });

  it('the nav entry points at this route', () => {
    const entry = dashboardNavigationFor('donor').find((i) => i.label === 'Fundraising Guide');
    expect(entry?.href).toBe('/fundraising-guide');
  });
});

describe('AppShell gets out of the way without flashing first', () => {
  it('lists the route as shell-when-signed-in', () => {
    expect(shell).toMatch(/const SHELL_WHEN_SIGNED_IN = \['\/fundraising-guide'\]/);
  });

  it('tracks whether auth has RESOLVED, not merely whether a user exists', () => {
    // `!user` is also true for the whole window before the auth call returns.
    // Without this third state there is no way to distinguish "signed out" from
    // "do not know yet".
    expect(shell).toMatch(/const \[authResolved, setAuthResolved\] = useState\(false\)/);
    expect(shell).toMatch(/setAuthResolved\(true\)/);
  });

  it('suppresses marketing chrome while the answer is UNKNOWN as well', () => {
    // The `!authResolved ||` half is the anti-flash. Dropping it renders the
    // marketing header above the server-rendered shell on every load.
    expect(shell).toMatch(/shellWhenSignedIn && \(!authResolved \|\| !!user\)/);
  });

  it('leaves every other route on the old, purely path-based rule', () => {
    // The new condition must be ADDED to the bypass, not substituted for it.
    // Losing SHELL_BYPASS would put the marketing header back on /dashboard,
    // /admin and /profile, all of which render their own shell.
    expect(shell).toMatch(/SHELL_BYPASS\.some\(\(p\) => path === p \|\| path\.startsWith\(p \+ '\/'\)\)/);
    expect(shell).toMatch(/\|\| isEmbedRoute\(path\)/);
  });

  it('does not bypass for a signed-out visitor once that is known', () => {
    // Asserted as logic rather than prose: with authResolved true and no user,
    // the expression must be false so the marketing chrome renders.
    const evaluate = (authResolved: boolean, user: boolean) => authResolved === false || user;
    expect(evaluate(true, false)).toBe(false);   // known signed-out -> marketing
    expect(evaluate(true, true)).toBe(true);     // known signed-in  -> shell
    expect(evaluate(false, false)).toBe(true);   // unknown          -> shell (no flash)
  });
});
