import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLATFORM_MODULES } from '../lib/feature-catalog';

// ─────────────────────────────────────────────────────────────────────────────
// A module may not advertise itself as shipped while nothing reads its tables.
//
// /features renders each module under its `status` badge, and the detail page
// carries an action CTA. Two modules shipped as "Production Ready" with **every**
// declared table unwired — Memberships and Community (5/5) and Creator Commerce
// and Tips (6/6) — each with a button ("Create membership tiers", "Build a
// creator page") that dropped the visitor on /create/choose-path, the ordinary
// campaign wizard, where none of it exists.
//
// The root cause was the type: `status` was 'Live' | 'Production Ready', with no
// way to say "designed but not built", so every module had to claim one. 'Planned'
// now exists; this stops the old state from returning silently.
//
// The rule is deliberately weak — a module fails only when **none** of its
// declared tables is reachable. Partial gaps are legitimate: a feature can be
// implemented without every table it was designed around.
// ─────────────────────────────────────────────────────────────────────────────

const APP_WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['app', 'lib', 'components'];
const SKIP = new Set(['node_modules', '.next', '__tests__', 'e2e', 'test-stubs']);

function readAllSource(): string {
  const parts: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      if (SKIP.has(e)) continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e) && !/feature-catalog\.ts$/.test(e)) parts.push(readFileSync(p, 'utf8'));
    }
  };
  for (const d of SCAN_DIRS) walk(join(APP_WEB_ROOT, d));
  return parts.join('\n');
}

const SOURCE = readAllSource();

/** Tables reachable through a PostgREST call, or through an RPC the code calls. */
function wiredTables(): Set<string> {
  const wired = new Set<string>(
    [...SOURCE.matchAll(/from\('([a-z_]+)'\)/g)].map((m) => m[1]),
  );
  const rpcs = new Set([...SOURCE.matchAll(/rpc\('([a-z_]+)'/g)].map((m) => m[1]));
  // A table written only inside a SQL function still counts as wired — this is
  // how rate_limit_hits is reached, and a from()-only check wrongly flagged it.
  let schema = '';
  try { schema = readFileSync(join(APP_WEB_ROOT, '../../supabase/schema.sql'), 'utf8'); } catch { /* optional */ }
  for (const fn of rpcs) {
    const re = new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${fn}\\b([\\s\\S]*?)\\$\\$;`, 'g');
    for (const m of schema.matchAll(re)) {
      for (const t of m[1].matchAll(/\b(?:from|into|update|join)\s+(?:public\.)?([a-z_]{4,})/gi)) wired.add(t[1]);
    }
  }
  return wired;
}

describe('feature status honesty', () => {
  const wired = wiredTables();

  it('no module claims to be shipped while none of its tables is reachable', () => {
    const offenders = PLATFORM_MODULES.filter((m) => {
      if (m.status === 'Planned') return false;
      const tables = m.databaseTables ?? [];
      if (tables.length === 0) return false;
      return tables.every((t) => !wired.has(t));
    }).map((m) => `${m.slug} (status "${m.status}") — none of ${m.databaseTables.length} declared tables reachable: ${m.databaseTables.join(', ')}`);

    expect(
      offenders,
      `A module advertises itself as shipped on /features while no code reads any of\n` +
        `its declared tables. Either build it, or set status: 'Planned' so the badge\n` +
        `and the CTA stop implying it is available:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  it('the wiring check finds real tables and is not vacuous', () => {
    // Sanity: core tables must register as wired, or the whole check is useless.
    expect(wired.has('campaigns')).toBe(true);
    expect(wired.has('donations')).toBe(true);
    expect(wired.has('profiles')).toBe(true);
    // And a table with no reader must not.
    //
    // This fixture has now gone stale THREE times, which is the test working: it
    // names a table nothing reads, and the moment someone builds that feature the
    // assertion correctly fails. `auction_bids` was the first (auctions shipped);
    // `membership_tiers` was the second — Codex built the creator/membership
    // surface (`app/api/creators/tiers/route.ts`, `app/creators/[handle]/page.tsx`);
    // `giving_days` was the third, wired by lib/giving-days-server.ts,
    // /giving-days, /giving-days/[slug], /dashboard/giving-days and
    // /api/giving-days.
    //
    // If this fails again, do NOT weaken it — check whether the table just
    // acquired a reader, and if so move the fixture to one that still has none.
    // Verified reader-less by crossing every CREATE TABLE in the schema mirror
    // against every `.from()` call site (2026-08-02): livestreams, brands,
    // donor_segments, donor_segment_members, admin_notes, admin_settings,
    // analytics_snapshots, giving_days→WIRED, creator_tips, digital_products,
    // product_orders, organizations, platform_fees, processor_accounts.
    expect(wired.has('livestreams')).toBe(false);
  });

  it('the two known-unbuilt modules are marked Planned', () => {
    for (const slug of ['memberships', 'creator-commerce']) {
      const mod = PLATFORM_MODULES.find((m) => m.slug === slug);
      expect(mod, `${slug} should exist in the catalog`).toBeDefined();
      expect(mod!.status, `${slug} has no implementation and must stay Planned`).toBe('Planned');
    }
  });
});
