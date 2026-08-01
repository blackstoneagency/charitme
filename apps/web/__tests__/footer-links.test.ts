import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FOOTER_SECTIONS,
  FOOTER_SECTION_ORDER,
  FOOTER_LEGAL_BAR,
  resolveFooterSections,
  type FooterSectionName,
} from '../lib/footer-nav';

// ─────────────────────────────────────────────────────────────────────────────
// The footer renders on EVERY public page, so a defect here is a site-wide
// defect — and these are all invisible to typecheck, lint and rendering tests,
// because a link to a gated page is perfectly valid JSX that renders and even
// navigates. It just lands the visitor on a login wall.
//
// Found by measuring rather than review: `/impact/manage` and `/privacy-center`
// were both in the footer and both auth-gated.
// ─────────────────────────────────────────────────────────────────────────────

const WEB = join(__dirname, '..');
const ROUTES = JSON.parse(readFileSync(join(WEB, 'e2e', 'public-routes.json'), 'utf8')) as {
  public: string[];
  authGated: { routes: string[]; consoles: string[] };
};

const gated = new Set([...ROUTES.authGated.routes, ...ROUTES.authGated.consoles]);
const publicRoutes = new Set(ROUTES.public);

/** Everything a visitor can click in the footer: columns as rendered, plus the legal bar. */
const allLinks = [...resolveFooterSections().flatMap((s) => s.links), ...FOOTER_LEGAL_BAR];

describe('global footer links', () => {
  it('resolves a real link table (so this file cannot pass by finding nothing)', () => {
    expect(allLinks.length).toBeGreaterThan(20);
    expect(resolveFooterSections().length).toBe(FOOTER_SECTION_ORDER.length);
  });

  it('never links a signed-out visitor to an auth-gated route', () => {
    const bad = allLinks.filter((l) => gated.has(l.href));
    expect(
      bad.map((l) => `${l.label} → ${l.href}`),
      'these bounce a signed-out visitor to /login from every page on the site',
    ).toEqual([]);
  });

  it('only links routes the sweeps know are public', () => {
    const unknown = allLinks.filter((l) => !publicRoutes.has(l.href) && !gated.has(l.href));
    expect(
      unknown.map((l) => `${l.label} → ${l.href}`),
      'add the route to e2e/public-routes.json, or fix the href — an unlisted ' +
        'route is also one no contrast/a11y/responsive sweep ever visits',
    ).toEqual([]);
  });

  it('shows no destination twice anywhere in the footer', () => {
    // resolveFooterSections() already strips whatever the legal bar owns; this
    // asserts the result, so a new duplicate INSIDE the columns is caught too.
    const byHref = new Map<string, string[]>();
    for (const l of allLinks) byHref.set(l.href, [...(byHref.get(l.href) ?? []), l.label]);
    const dupes = [...byHref.entries()].filter(([, v]) => v.length > 1);
    expect(dupes.map(([h, v]) => `${h} ← ${v.join(' + ')}`)).toEqual([]);
  });

  it('is authored with columns of equal length, net of the legal bar', () => {
    // The layout problem was CONTENT: 13 links against 5/6/8 made one column run
    // roughly twice as long as its neighbours and left dead space beside it.
    // Balancing here fixes it at the source, so no CSS has to compensate.
    //
    // The count that matters is what SURVIVES de-duplication, not what is
    // authored. Legal deliberately authors /terms and /privacy that the legal
    // bar then strips, so a raw authored count reports Legal as two links longer
    // than it renders — and "fixing" that by deleting two real links would make
    // the rendered footer ragged in the other direction.
    const owned = new Set(FOOTER_LEGAL_BAR.map((l) => l.href));
    const net = (n: FooterSectionName) => FOOTER_SECTIONS[n].filter((l) => !owned.has(l.href)).length;
    const counts = FOOTER_SECTION_ORDER.map(net);
    const named = Object.fromEntries(FOOTER_SECTION_ORDER.map((n) => [n, net(n)]));
    expect(Math.max(...counts) - Math.min(...counts), `ragged columns: ${JSON.stringify(named)}`)
      .toBeLessThanOrEqual(1);
  });

  it('renders columns close enough in length to look deliberate', () => {
    // Rendered length is allowed to differ by more than authored length: the
    // legal bar owns /terms and /privacy, so resolveFooterSections() strips two
    // entries from Legal by design. Two is the real tolerance — the defect being
    // guarded is a column running twice as long as its neighbours, not a
    // one-or-two-row difference nobody can see.
    const sections = resolveFooterSections();
    const counts = sections.map((s) => s.links.length);
    const named = Object.fromEntries(sections.map((s) => [s.name, s.links.length]));
    expect(Math.max(...counts) - Math.min(...counts), `ragged rendered columns: ${JSON.stringify(named)}`)
      .toBeLessThanOrEqual(2);
  });

  it('authors every section that the render order expects', () => {
    for (const name of FOOTER_SECTION_ORDER) {
      expect(FOOTER_SECTIONS[name], `${name} has no links`).toBeTruthy();
      expect(FOOTER_SECTIONS[name].length).toBeGreaterThan(0);
    }
  });
});
