import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SUPPORTED_CURRENCIES, SUPPORTED_CURRENCY_CODES } from '@shared/currencies';

const WEB_ROOT = join(__dirname, '..');

// ─────────────────────────────────────────────────────────────────────────────
// `@shared/currencies` is the single source of truth for currency, the same way
// CAMPAIGN_CATEGORIES is for categories — and it drifted the same way.
//
// The campaign settings panel offered a hand-written list of FIVE currencies:
//
//     {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map(...)}
//
// while the platform supports 28 and the API accepts every one of them
// (`isSupportedCurrency`). So 23 currencies were reachable by the backend and
// unreachable by the organizer — a limit with no rule behind it, invisible from
// either side on its own.
//
// This is the CAMPAIGN_CATEGORIES failure CLAUDE.md already documents ("three
// hand-maintained copies had already drifted"), which is why it gets a test
// rather than just a fix.
// ─────────────────────────────────────────────────────────────────────────────

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

describe('currency lists are never re-declared locally', () => {
  it('the shared list is the broad one', () => {
    // Guards the assertion below from passing because the shared list shrank.
    expect(SUPPORTED_CURRENCY_CODES.length).toBeGreaterThanOrEqual(20);
    expect(SUPPORTED_CURRENCY_CODES).toContain('USD');
  });

  it('no file hardcodes an array of currency codes', () => {
    // An array literal of 3+ quoted ISO-4217 codes that are all real currencies.
    const literal = /\[\s*((?:'[A-Z]{3}'\s*,\s*){2,}'[A-Z]{3}')\s*,?\s*\]/g;
    const offenders: string[] = [];

    for (const file of [...sourceFiles(join(WEB_ROOT, 'app')), ...sourceFiles(join(WEB_ROOT, 'lib'))]) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(literal)) {
        const codes = [...m[1].matchAll(/'([A-Z]{3})'/g)].map((c) => c[1]);
        // Only currency codes count — an array of country codes or HTTP verbs is
        // not a currency list.
        if (!codes.every((c) => SUPPORTED_CURRENCY_CODES.includes(c))) continue;
        // A local list is only a defect when it is NARROWER than the shared one.
        if (codes.length >= SUPPORTED_CURRENCY_CODES.length) continue;
        offenders.push(`${file.slice(WEB_ROOT.length + 1)}: [${codes.join(', ')}]`);
      }
    }

    expect(
      offenders,
      'hardcoded currency list narrower than @shared/currencies — the backend will ' +
        'accept codes this UI cannot offer',
    ).toEqual([]);
  });

  it('the campaign settings panel renders every supported currency', () => {
    const src = readFileSync(
      join(WEB_ROOT, 'app/dashboard/campaigns/[id]/_components/SettingsPanel.tsx'),
      'utf8',
    );
    expect(src).toMatch(/SUPPORTED_CURRENCIES\.map/);
    expect(SUPPORTED_CURRENCIES.length).toBe(SUPPORTED_CURRENCY_CODES.length);
  });
});
