import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// The footer renders on EVERY public page, so a defect here is a site-wide
// defect — and every one of these is invisible to typecheck, lint and rendering
// tests, because a link to a gated page is perfectly valid JSX that renders and
// even navigates. It just lands the visitor on a login wall.
//
// Found by measuring, not review: `/impact/manage` and `/privacy-center` were
// both in the footer and both auth-gated.
// ─────────────────────────────────────────────────────────────────────────────

const WEB = join(__dirname, '..');
const SRC = readFileSync(join(WEB, 'components', 'AppShell.tsx'), 'utf8');
const ROUTES = JSON.parse(readFileSync(join(WEB, 'e2e', 'public-routes.json'), 'utf8')) as {
  public: string[];
  authGated: { routes: string[]; consoles: string[] };
};

function footerLinks(): { label: string; href: string }[] {
  const start = SRC.indexOf('const FOOTER_LINKS');
  const end = SRC.indexOf('} as const', start);
  const block = SRC.slice(start, end);
  return [...block.matchAll(/\['([^']+)',\s*'([^']+)'\]/g)].map((m) => ({ label: m[1], href: m[2] }));
}

const links = footerLinks();
const gated = new Set([...ROUTES.authGated.routes, ...ROUTES.authGated.consoles]);
const publicRoutes = new Set(ROUTES.public);

describe('global footer links', () => {
  it('finds the link table at all (guards this test against silently passing)', () => {
    expect(links.length).toBeGreaterThan(20);
  });

  it('never links a signed-out visitor to an auth-gated route', () => {
    const bad = links.filter((l) => gated.has(l.href));
    expect(
      bad.map((l) => `${l.label} → ${l.href}`),
      'these bounce a signed-out visitor to /login from every page on the site',
    ).toEqual([]);
  });

  it('only links routes the sweeps know are public', () => {
    const unknown = links.filter((l) => !publicRoutes.has(l.href) && !gated.has(l.href));
    expect(
      unknown.map((l) => `${l.label} → ${l.href}`),
      'add the route to e2e/public-routes.json, or fix the href — an unlisted ' +
        'route is also one no contrast/a11y/responsive sweep ever visits',
    ).toEqual([]);
  });

  it('has no two labels pointing at the same page', () => {
    // "Fundraising Guides" and "How It Works" both went to /how-it-works, which
    // wastes a slot and makes the site look larger than it is.
    const byHref = new Map<string, string[]>();
    for (const l of links) byHref.set(l.href, [...(byHref.get(l.href) ?? []), l.label]);
    const dupes = [...byHref.entries()].filter(([, v]) => v.length > 1);
    expect(dupes.map(([h, v]) => `${h} ← ${v.join(' + ')}`)).toEqual([]);
  });

  it('keeps the columns within one item of each other', () => {
    // The layout problem was CONTENT: 13 links against 6/6/8 made one column run
    // twice as long as its neighbours. Balancing here fixes it at the source, so
    // no CSS has to compensate.
    const counts = new Map<string, number>();
    const start = SRC.indexOf('const FOOTER_LINKS');
    const block = SRC.slice(start, SRC.indexOf('} as const', start));
    let section: string | null = null;
    for (const line of block.split('\n')) {
      const head = /^ {2}'?([\w &]+)'?:\s*\[/.exec(line);
      if (head) {
        section = head[1];
        counts.set(section, 0);
      } else if (section && /\['/.test(line)) {
        counts.set(section, (counts.get(section) ?? 0) + 1);
      }
    }
    const values = [...counts.values()];
    expect(values.length, 'no sections parsed').toBeGreaterThan(2);
    expect(
      Math.max(...values) - Math.min(...values),
      `column lengths ${JSON.stringify(Object.fromEntries(counts))} are ragged`,
    ).toBeLessThanOrEqual(1);
  });
});
