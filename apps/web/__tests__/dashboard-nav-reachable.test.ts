import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Every dashboard route must be reachable from the sidebar.
//
// Shipped-and-orphaned is a real failure mode, not a hypothetical: both
// /dashboard/beneficiary and /dashboard/nonprofit went out complete and tested
// but absent from `dashboardNav`, so the only way to reach them was typing the
// URL. A nonprofit would never have found its own verification and tax-receipt
// page. The build stays green either way, which is exactly why it needs a test.
//
// Role-scoped entries live in `roleScopedNav` and are appended for users holding
// that role — they count as reachable.
// ─────────────────────────────────────────────────────────────────────────────

const APP = join(__dirname, '..', 'components', 'CharitMeApp.tsx');
const src = readFileSync(APP, 'utf8');

/** Every '/dashboard/...' href mentioned in the shell's nav definitions. */
function navHrefs(): Set<string> {
  return new Set([...src.matchAll(/'(\/dashboard\/[a-z0-9/-]*)'/g)].map((m) => m[1]));
}

describe('dashboard nav reachability', () => {
  it('the nav actually defines dashboard links (guard is not vacuous)', () => {
    expect(navHrefs().size).toBeGreaterThan(10);
  });

  it('exposes the role-scoped entries for beneficiary and nonprofit', () => {
    // These two exist only for users holding the role; without them the pages
    // are orphaned for exactly the people they were built for.
    expect(src).toMatch(/roleScopedNav/);
    expect(src).toMatch(/beneficiary:\s*\[[^\]]*\/dashboard\/beneficiary/);
    expect(src).toMatch(/nonprofit:\s*\[[^\]]*\/dashboard\/nonprofit/);
  });

  it('appends role-scoped entries to the rendered nav, not just declares them', () => {
    // Declaring the map but never spreading it would still leave the pages
    // unreachable — the bug this test exists to catch.
    expect(src).toMatch(/\.\.\.navRoles\.flatMap/);
  });

  it('every role-scoped nav target is a real page', () => {
    for (const route of ['/dashboard/beneficiary', '/dashboard/nonprofit']) {
      const page = join(__dirname, '..', 'app', route.replace(/^\//, ''), 'page.tsx');
      expect(existsSync(page), `${route} has a nav entry but no page.tsx`).toBe(true);
    }
  });
});
