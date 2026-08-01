import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PAYMENTS_NAV, currentPaymentsHref } from '../lib/payments-nav';

// ─────────────────────────────────────────────────────────────────────────────
// Five of the six payments pages — disputes, owner payouts, processors,
// reconciliation, refunds — shipped fully wired to lib/payment-admin-data.ts and
// linked from NOTHING. adminNav has one entry pointing at campaign-flows, and a
// grep of the whole tree for "/admin/payments/" outside that directory returned
// two hrefs in total.
//
// The sub-nav fixes today's instance. This test is what stops the next one: a
// new page in this section fails here until it is in PAYMENTS_NAV and renders
// the nav that reaches its siblings.
// ─────────────────────────────────────────────────────────────────────────────

const SECTION = join(__dirname, '..', 'app', 'admin', 'payments');

function pageDirs(): string[] {
  return readdirSync(SECTION)
    .filter((entry) => !entry.startsWith('_') && !entry.startsWith('['))
    .filter((entry) => statSync(join(SECTION, entry)).isDirectory())
    .filter((entry) => {
      try {
        return statSync(join(SECTION, entry, 'page.tsx')).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

describe('the payments console reaches all of itself', () => {
  it('scans a real directory', () => {
    // Without this, a broken path would make every assertion below vacuous.
    expect(pageDirs().length).toBeGreaterThanOrEqual(6);
  });

  it('lists every page in the section', () => {
    const onDisk = pageDirs().map((d) => `/admin/payments/${d}`);
    const listed = PAYMENTS_NAV.map((i) => i.href).sort();
    expect(listed, 'a page in this section is missing from PAYMENTS_NAV').toEqual(onDisk);
  });

  it('lists nothing that does not exist', () => {
    const onDisk = new Set(pageDirs().map((d) => `/admin/payments/${d}`));
    const dead = PAYMENTS_NAV.filter((i) => !onDisk.has(i.href)).map((i) => i.href);
    expect(dead, `linked but no page.tsx: ${dead.join(', ')}`).toEqual([]);
  });

  it('is rendered by every page in the section, so any one leads to all', () => {
    const missing = pageDirs().filter((d) => {
      const src = readFileSync(join(SECTION, d, 'page.tsx'), 'utf8');
      return !src.includes('<PaymentsSubnav />');
    });
    expect(missing, `these pages do not render the section nav: ${missing.join(', ')}`).toEqual([]);
  });

  it('gives every entry a label and a blurb', () => {
    for (const item of PAYMENTS_NAV) {
      expect(item.label.length, item.href).toBeGreaterThan(0);
      expect(item.blurb.length, item.href).toBeGreaterThan(0);
    }
  });

  it('has no duplicate hrefs', () => {
    const hrefs = PAYMENTS_NAV.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe('currentPaymentsHref', () => {
  it('marks the exact page', () => {
    expect(currentPaymentsHref('/admin/payments/refunds')).toBe('/admin/payments/refunds');
  });

  it('keeps a section marked from inside a detail route', () => {
    // Exact-match alone would leave a transactions page with nothing
    // highlighted, which reads as "you have left the console".
    expect(
      currentPaymentsHref('/admin/payments/campaign-flows/abc-123/transactions/def-456'),
    ).toBe('/admin/payments/campaign-flows');
  });

  it('returns null outside the section rather than guessing', () => {
    expect(currentPaymentsHref('/admin/donations')).toBeNull();
    expect(currentPaymentsHref('/admin/payments')).toBeNull();
  });

  it('does not match a sibling that merely shares a prefix', () => {
    // "/admin/payments/refunds-archive" must not light up "refunds".
    expect(currentPaymentsHref('/admin/payments/refunds-archive')).toBeNull();
  });
});
