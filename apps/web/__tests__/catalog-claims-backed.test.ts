import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// lib/feature-catalog.ts states its own rule, in a comment explaining why
// 'auctions' is deliberately not listed:
//
//   "there is no auction API, lib or UI — only tables. A 'Production Ready'
//    module must not advertise a capability this same file says is unbuilt."
//
// That rule was being applied by hand, and by hand it drifted: peer_fundraisers,
// trust_scores, donation_forms and creator_profiles were all advertised by modules
// claiming shipped status while nothing in the app issued a `.from()` against them,
// and `reward_tiers` named an empty table when the perks it described are read from
// `campaign_rewards`. This makes the rule mechanical.
//
// Modules marked 'Planned' are deliberately EXEMPT. Listing the intended schema for
// something you are openly saying is not built yet is honest — it is the shipped
// statuses that turn an unread table into a false promise. Two whole modules
// (memberships, creator-commerce) are Planned with no backed tables at all, and
// that is fine; folding them into the count would have turned a precise 4-claim
// problem into a misleading "13 of 31 tables are unbacked" headline.

const WEB_ROOT = join(__dirname, '..');
const CATALOG = join(WEB_ROOT, 'lib', 'feature-catalog.ts');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const APP_SOURCE = [
  ...walk(join(WEB_ROOT, 'app')),
  ...walk(join(WEB_ROOT, 'lib')),
  ...walk(join(WEB_ROOT, 'components')),
]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

function hasReader(table: string): boolean {
  return new RegExp(`\\.from\\(\\s*['"]${table}['"]\\s*\\)`).test(APP_SOURCE);
}

type Module = { slug: string; status: string; tables: string[] };

function parseModules(): Module[] {
  const src = readFileSync(CATALOG, 'utf8');
  const mods: Module[] = [];
  const re = /slug:\s*'([^']+)'[\s\S]*?status:\s*'([^']+)'[\s\S]*?databaseTables:\s*\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    mods.push({
      slug: m[1],
      status: m[2],
      tables: [...m[3].matchAll(/'([a-z0-9_]+)'/g)].map((t) => t[1]),
    });
  }
  return mods;
}

describe('feature catalog only advertises tables the app actually reads', () => {
  const modules = parseModules();

  it('parsed a plausible catalog', () => {
    // Without this, a regex that silently matches nothing makes every assertion
    // below vacuously true — the exact failure mode that let these claims drift.
    expect(modules.length).toBeGreaterThanOrEqual(5);
    expect(modules.some((m) => m.status !== 'Planned')).toBe(true);
    expect(modules.flatMap((m) => m.tables).length).toBeGreaterThan(15);
  });

  it('detects a reader that genuinely exists (the matcher is not always-false)', () => {
    expect(hasReader('campaigns')).toBe(true);
    expect(hasReader('donations')).toBe(true);
    expect(hasReader('table_that_does_not_exist_anywhere')).toBe(false);
  });

  const shipped = modules.filter((m) => m.status !== 'Planned');

  for (const mod of shipped) {
    it(`${mod.slug} [${mod.status}] — every advertised table has a reader`, () => {
      const unbacked = mod.tables.filter((t) => !hasReader(t));
      expect(unbacked).toEqual([]);
    });
  }

  it('Planned modules are exempt, and that exemption is actually load-bearing', () => {
    // If no Planned module ever listed an unbacked table, the exemption above would
    // be untested scaffolding. Asserting it is used keeps the carve-out honest.
    const planned = modules.filter((m) => m.status === 'Planned');
    const plannedUnbacked = planned.flatMap((m) => m.tables.filter((t) => !hasReader(t)));
    expect(plannedUnbacked.length).toBeGreaterThan(0);
  });
});
