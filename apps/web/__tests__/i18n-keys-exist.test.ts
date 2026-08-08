import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Does every key the code asks for actually exist?
//
// `t()` falls back to the KEY when it does not recognise one:
//
//   let out = MARKET_OVERRIDES[...] ?? DICTIONARIES[language]?.[key]
//             ?? DICTIONARIES['en']?.[key] ?? key;
//
// so a typo does not throw, does not warn, and does not fall back to English —
// it renders the raw dotted string into the page. `/thank-you` shipped
// `t('causes.browse_all')` against a dictionary whose key is `cause.browse_all`,
// which put a button labelled "causes.browse_all" under every completed
// donation, in all seven languages.
//
// i18n-coverage.test.ts cannot catch this. It walks the dictionaries and asks
// whether every English key is translated — a key no dictionary has is not in
// its key set at all, so a call site referring to one is invisible to it. This
// test walks in the other direction: from the CALL SITES to the dictionary.
// ─────────────────────────────────────────────────────────────────────────────

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Keys defined in the English dictionary — the source every locale mirrors. */
function definedKeys(): Set<string> {
  const en = readFileSync(join(WEB_ROOT, 'lib', 'locales', 'en.ts'), 'utf8');
  return new Set([...en.matchAll(/^\s*'([a-z0-9_.]+)':/gim)].map((m) => m[1]));
}

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(full)) out.push(full);
    }
  };
  for (const root of ['app', 'components', 'lib']) walk(join(WEB_ROOT, root));
  // The dictionaries define keys; they do not consume them.
  return out.filter((f) => !f.includes(`${'lib'}/locales/`) && !f.includes('__tests__'));
}

/** `t('some.key')` call sites. Dotted keys only — `t(variable)` is not checkable. */
function requestedKeys(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of sourceFiles()) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)'/gi)) {
      const list = found.get(m[1]) ?? [];
      list.push(file.slice(WEB_ROOT.length + 1));
      found.set(m[1], list);
    }
  }
  return found;
}

describe('every translation key a component asks for is defined', () => {
  const defined = definedKeys();
  const requested = requestedKeys();

  it('reads both sides — not an empty scan', () => {
    // Without this, a broken regex makes the sweep below pass while checking
    // nothing, which is exactly the failure mode it exists to prevent.
    expect(defined.size).toBeGreaterThan(300);
    expect(requested.size).toBeGreaterThan(100);
    expect(defined.has('thanks.title')).toBe(true);
  });

  it('no call site refers to a key the dictionary does not have', () => {
    const missing = [...requested.entries()]
      .filter(([key]) => !defined.has(key))
      .map(([key, files]) => `${key} — ${files[0]}${files.length > 1 ? ` (+${files.length - 1} more)` : ''}`);

    expect(
      missing,
      't() renders the KEY ITSELF when it does not recognise one, so each of\n' +
        'these puts a raw dotted string on the page instead of a label:\n  ' +
        missing.join('\n  '),
    ).toEqual([]);
  });

  it('detects a missing key when one is planted', () => {
    // A guard that has never fired proves nothing.
    const planted = 'thanks.this_key_does_not_exist';
    expect(defined.has(planted)).toBe(false);
    expect([planted].filter((k) => !defined.has(k))).toEqual([planted]);
  });
});
