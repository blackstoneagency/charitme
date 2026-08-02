import { describe, expect, it } from 'vitest';
import { en } from '../lib/locales/en';
import { FOOTER_SECTIONS, FOOTER_SECTION_ORDER } from '../lib/footer-nav';
import { MAIN_NAV, EXPLORE_CAUSES, RESOURCES } from '../lib/main-nav';

// ─────────────────────────────────────────────────────────────────────────────
// Every `labelKey` used by the global chrome must exist in the ENGLISH
// dictionary.
//
// This exists because a real bug walked straight through a green suite. Adding
// a footer link with `labelKey: 'footer.link.signup'` and no dictionary entry
// left `t()` returning its `?? key` fallback — so the footer would have rendered
// the literal string "footer.link.signup" to every visitor, in every language.
// 2400 tests passed.
//
// `i18n-coverage.test.ts` could not catch it, and the reason is worth stating:
// it iterates the ENGLISH KEY SET and asks whether each key is translated
// everywhere. A key that is missing from English is not in that set, so it is
// never asked about. Coverage measured the translations of the keys that exist;
// nothing measured whether a key the UI actually renders exists at all.
//
// So this checks the other direction — from what the chrome RENDERS back to the
// dictionary — which is the direction a user experiences.
// ─────────────────────────────────────────────────────────────────────────────

/** Every labelKey/headingKey reachable from the header and footer data. */
function chromeKeys(): { key: string; where: string }[] {
  const out: { key: string; where: string }[] = [];

  for (const item of MAIN_NAV) {
    if (item.labelKey) out.push({ key: item.labelKey, where: `MAIN_NAV ${item.label}` });
  }
  // EXPLORE_CAUSES and RESOURCES are each a single menu NavItem holding columns,
  // not arrays of columns.
  for (const menu of [EXPLORE_CAUSES, RESOURCES]) {
    if (menu.labelKey) out.push({ key: menu.labelKey, where: `menu ${menu.label}` });
    if (menu.kind !== 'menu') continue; // NavItem is a union; only 'menu' has columns
    for (const col of menu.columns) {
      if (col.headingKey) out.push({ key: col.headingKey, where: `column ${col.heading}` });
      for (const link of col.links) {
        if (link.labelKey) out.push({ key: link.labelKey, where: `link ${link.label}` });
      }
      if (col.footer?.labelKey) {
        out.push({ key: col.footer.labelKey, where: `column footer ${col.footer.label}` });
      }
    }
  }
  for (const section of FOOTER_SECTION_ORDER) {
    for (const link of FOOTER_SECTIONS[section]) {
      if (link.labelKey) out.push({ key: link.labelKey, where: `footer ${section} / ${link.label}` });
    }
  }
  return out;
}

describe('global chrome label keys resolve', () => {
  it('finds keys to check (non-vacuity)', () => {
    // Without this, a refactor that made chromeKeys() return [] would turn the
    // assertion below into a permanent pass — the same failure mode this file
    // was written to fix.
    expect(chromeKeys().length).toBeGreaterThan(40);
  });

  it('every header and footer labelKey exists in the English dictionary', () => {
    const dictionary = en as Record<string, string>;
    const missing = chromeKeys()
      .filter(({ key }) => typeof dictionary[key] !== 'string' || dictionary[key].length === 0)
      .map(({ key, where }) => `${key}  (${where})`);

    expect(
      missing,
      'These labelKeys are rendered by the header or footer but have no English ' +
        'entry, so t() returns the raw key and users see it verbatim:\n  ' +
        missing.join('\n  '),
    ).toEqual([]);
  });

  it('catches a planted missing key', () => {
    // Mutation test: the check must be able to go red.
    const dictionary = { 'footer.link.real': 'Real' } as Record<string, string>;
    const planted = [
      { key: 'footer.link.real', where: 'ok' },
      { key: 'footer.link.absent', where: 'planted' },
    ];
    const missing = planted.filter(({ key }) => typeof dictionary[key] !== 'string');
    expect(missing.map((m) => m.key)).toEqual(['footer.link.absent']);
  });
});
