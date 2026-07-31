import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FOOTER_LEGAL_BAR,
  FOOTER_SECTIONS,
  FOOTER_SECTION_ORDER,
  FOOTER_SETTINGS_DEFAULTS,
  resolveFooterSections,
  resolveFooterSettings,
  safeEmail,
  safeExternalUrl,
} from '../lib/footer-nav';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Does `href` resolve to a real page file?
 *
 * Route GROUPS are the wrinkle: `/events` is served by
 * `app/events/(list)/page.tsx`, because the segment `(list)` is organisational
 * and contributes nothing to the URL. A naive `app/<href>/page.tsx` check calls
 * four live routes broken — which is exactly what the first version of this
 * test did.
 */
function routeHasPage(href: string): boolean {
  const dir = join(WEB_ROOT, 'app', href.replace(/^\//, ''));
  if (!existsSync(dir)) return false;
  if (existsSync(join(dir, 'page.tsx')) || existsSync(join(dir, 'page.ts'))) return true;
  return readdirSync(dir, { withFileTypes: true }).some(
    (entry) =>
      entry.isDirectory() &&
      entry.name.startsWith('(') &&
      entry.name.endsWith(')') &&
      (existsSync(join(dir, entry.name, 'page.tsx')) || existsSync(join(dir, entry.name, 'page.ts'))),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The footer showed the same destination twice: "Terms of Service" in the Legal
// column and "Terms" in the bottom bar, both pointing at /terms; likewise
// "Privacy Policy" / "Privacy Notice" → /privacy. The fix is to DERIVE the
// columns from the legal bar rather than maintain two hand-written lists, so
// these assertions are about the derivation, not about a snapshot of the links.
// ─────────────────────────────────────────────────────────────────────────────

describe('the footer never links to the same place twice', () => {
  it('renders no href more than once across the whole footer', () => {
    const hrefs = [
      ...resolveFooterSections().flatMap((s) => s.links.map((l) => l.href)),
      ...FOOTER_LEGAL_BAR.map((l) => l.href),
    ];
    const seen = new Map<string, number>();
    for (const href of hrefs) seen.set(href, (seen.get(href) ?? 0) + 1);
    const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([href]) => href);
    expect(duplicates, `duplicated in the footer: ${duplicates.join(', ')}`).toEqual([]);
  });

  it('drops the column entry, keeping the legal bar as the canonical link', () => {
    const legalColumn = resolveFooterSections().find((s) => s.name === 'Legal');
    const hrefs = legalColumn?.links.map((l) => l.href) ?? [];
    // Authored in FOOTER_SECTIONS.Legal, removed because the bar owns them.
    expect(hrefs).not.toContain('/terms');
    expect(hrefs).not.toContain('/privacy');
    expect(FOOTER_LEGAL_BAR.map((l) => l.href)).toContain('/terms');
    expect(FOOTER_LEGAL_BAR.map((l) => l.href)).toContain('/privacy');
  });

  it('keeps the Legal entries the bar does NOT own', () => {
    const hrefs = resolveFooterSections().find((s) => s.name === 'Legal')?.links.map((l) => l.href);
    // `/privacy-center` was in this list and has been removed from the footer:
    // it requires a session, so every signed-out visitor who clicked it from any
    // page landed on /login with no explanation. Enumerating it here was
    // incidental to what this test is about — that the bar strips ONLY what it
    // owns — and footer-links.test.ts now fails the build if any gated route
    // reappears in the footer.
    expect(hrefs).toEqual(
      expect.arrayContaining(['/transparency', '/fees', '/refunds', '/security', '/prohibited-use']),
    );
  });

  // Non-vacuity: the derivation must actually be doing work. If someone
  // hand-edits FOOTER_SECTIONS.Legal to remove /terms, the dedup test above
  // would still pass while the mechanism had quietly stopped mattering.
  it('the authored Legal column still contains what the bar removes', () => {
    const authored = FOOTER_SECTIONS.Legal.map((l) => l.href);
    expect(authored).toContain('/terms');
    expect(authored).toContain('/privacy');
  });

  it('never renders a section heading with no links under it', () => {
    for (const section of resolveFooterSections()) {
      expect(section.links.length, `${section.name} rendered empty`).toBeGreaterThan(0);
    }
  });

  it('normalizes trailing slashes and case when comparing', () => {
    // /terms and /Terms/ are the same page; the dedup must not be defeated by
    // an author writing one of them differently.
    const owned = FOOTER_LEGAL_BAR.map((l) => l.href.toLowerCase().replace(/\/$/, ''));
    expect(owned).toContain('/terms');
  });
});

describe('every footer link points at a route that exists', () => {
  const hrefs = [
    ...FOOTER_SECTION_ORDER.flatMap((name) => FOOTER_SECTIONS[name].map((l) => l.href)),
    ...FOOTER_LEGAL_BAR.map((l) => l.href),
  ];

  it.each([...new Set(hrefs)])('%s has a page', (href) => {
    // Dynamic segments are out of scope for a filesystem check.
    if (href.includes('[')) return;
    expect(
      routeHasPage(href),
      `${href} is linked from the global footer but has no page under app${href}`,
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Operator-configurable values land in href/mailto attributes on every page of
// the site, so they are validated on READ — a row edited directly in the
// database has never passed through the write path.
// ─────────────────────────────────────────────────────────────────────────────

describe('footer settings cannot inject a hostile href', () => {
  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://insecure.example',   // downgrade
    '//protocol-relative.example',
    'not a url',
  ])('rejects %s', (hostile) => {
    expect(safeExternalUrl(hostile)).toBe('');
  });

  it('accepts a normal https profile URL', () => {
    expect(safeExternalUrl('https://www.facebook.com/charitme')).toBe('https://www.facebook.com/charitme');
  });

  it('rejects a malformed contact address', () => {
    expect(safeEmail('not-an-email')).toBe('');
    expect(safeEmail('a@b')).toBe('');
    expect(safeEmail('"><script>@x.com')).toBe('');
    expect(safeEmail('hello@charitme.com')).toBe('hello@charitme.com');
  });

  it('falls back to the default when a stored value is invalid', () => {
    const resolved = resolveFooterSettings({ facebookUrl: 'javascript:alert(1)' });
    expect(resolved.facebookUrl).toBe(FOOTER_SETTINGS_DEFAULTS.facebookUrl);
  });

  it('treats an explicitly empty string as "hide this link"', () => {
    expect(resolveFooterSettings({ facebookUrl: '' }).facebookUrl).toBe('');
  });

  it('drops unknown keys rather than passing them through', () => {
    const resolved = resolveFooterSettings({ evil: 'x', facebookUrl: 'https://ok.example' });
    expect(Object.keys(resolved).sort()).toEqual(Object.keys(FOOTER_SETTINGS_DEFAULTS).sort());
  });

  it.each([null, undefined, 'a string', 42, []])('survives a %s config value', (raw) => {
    expect(resolveFooterSettings(raw)).toEqual(FOOTER_SETTINGS_DEFAULTS);
  });

  it('ships the app store badges unset — the apps do not exist yet', () => {
    // Rendering a store badge that goes nowhere is worse than showing none.
    expect(FOOTER_SETTINGS_DEFAULTS.appStoreUrl).toBe('');
    expect(FOOTER_SETTINGS_DEFAULTS.googlePlayUrl).toBe('');
  });
});
