import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';

// ─────────────────────────────────────────────────────────────────────────────
// Guard against re-declaring canonical constants.
//
// The most damaging bugs found in the 2026-07-26 audit all shared one cause: a
// hand-maintained copy of a list that had drifted from `@shared/fees`.
//
//   - `lib/campaign-followups.ts` carried 11 of the 18 campaign categories, so a
//     sports team, cheer squad, event, family need, travel, volunteering or wish
//     campaign had no matching option and had to be filed as "Other".
//   - `lib/marketing-goals.ts` and `AdminCampaignsClient.tsx` each held a third
//     and fourth copy — correct at the time, equally free to drift, and the admin
//     one shadowed the shared export with a local `const CAMPAIGN_CATEGORIES`.
//
// Each copy was individually reasonable and the drift was invisible in review.
// This test makes the next copy fail loudly instead, at the moment it is added.
// ─────────────────────────────────────────────────────────────────────────────

const APP_WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['app', 'lib', 'components'];

function listSourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue;
      const p = join(dir, entry);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p);
    }
  };
  walk(root);
  return out;
}

/**
 * Detect a re-declared category *list*, not merely a file that names categories.
 *
 * The discriminator is a run of comma-separated string literals — `['Medical',
 * 'Memorial', 'Emergency', …]`. That is what a drifted copy looks like. It
 * deliberately does NOT flag a map keyed by category (`{ category: 'Medical',
 * keywords: [...] }`, `Medical: 'medical expenses'`), because those name
 * categories as a legitimate part of their structure — `campaign-intake.ts` and
 * `campaign-title.ts` must do exactly that, and an earlier, cruder version of
 * this check produced seven false positives on them.
 */
function findCategoryListLiteral(source: string): string | null {
  // A file that imports the canonical list is USING it, not re-declaring it — an
  // adjacent literal there is an exclusion/filter set, which is the correct
  // pattern (`lib/home-data.ts` does exactly this).
  if (/CAMPAIGN_CATEGORIES/.test(source)) return null;
  const stripped = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // Runs of ≥4 comma-separated quoted strings with nothing else between them.
  const runs = stripped.match(/(['"][A-Za-z][\w -]*['"]\s*,\s*){3,}['"][A-Za-z][\w -]*['"]/g) ?? [];
  for (const run of runs) {
    const names = (run.match(/['"]([^'"]+)['"]/g) ?? []).map((q) => q.slice(1, -1));
    const hits = new Set(names.filter((n) => (CAMPAIGN_CATEGORIES as readonly string[]).includes(n)));
    // Require enough overlap to mean a copy of the FULL list rather than a
    // different taxonomy that happens to share names (`SPONSORSHIP_CATEGORIES`
    // shares Community/Education/Environment/Sports but is its own domain).
    // The real drifted copy carried 11 of 18, so this still catches it.
    if (hits.size >= 8) return run.slice(0, 80);
  }
  return null;
}

describe('canonical constants are not re-declared', () => {
  it('no file outside @shared/fees hardcodes the campaign category list', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of listSourceFiles(join(APP_WEB_ROOT, dir))) {
        const src = readFileSync(file, 'utf8');
        const hit = findCategoryListLiteral(src);
        if (hit) offenders.push(`${relative(APP_WEB_ROOT, file)}  →  ${hit}…`);
      }
    }
    expect(
      offenders,
      `These files appear to hardcode campaign categories instead of importing\n` +
        `CAMPAIGN_CATEGORIES from '@shared/fees'. A drifted copy in\n` +
        `campaign-followups.ts once left sports/cheer/event/family/travel/volunteer/\n` +
        `wish campaigns with no category to pick:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  it('the guard is non-vacuous — it detects a planted duplicate', () => {
    // Proves the detector actually fires, so a passing suite means "no copies"
    // rather than "the scan silently matched nothing".
    const planted = `const X = ['Medical', 'Memorial', 'Emergency', 'Nonprofit', 'Education',
      'Animal', 'Environment', 'Business', 'Community', 'Creative', 'Faith'];`; // the real 11-of-18 copy
    expect(findCategoryListLiteral(planted)).not.toBeNull();
    // A single mention, and a map keyed by category, must NOT trip it — those are
    // legitimate (campaign-intake's keyword signals, campaign-title's phrase map).
    expect(findCategoryListLiteral(`const y = 'Medical';`)).toBeNull();
    expect(findCategoryListLiteral(
      `const m = { category: 'Medical', keywords: ['surgery','hospital','chemo','icu'] };`,
    )).toBeNull();
    expect(findCategoryListLiteral(
      `const P = { Medical: 'medical expenses', Sports: 'the team', Creative: 'a project' };`,
    )).toBeNull();
  });
});
