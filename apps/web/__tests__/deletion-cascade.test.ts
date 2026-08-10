import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  parseForeignKeys,
  cascadeClosure,
  moneyBearingRoots,
  MONEY_BEARING,
  TOMBSTONE_REASSIGNMENTS,
  TOMBSTONE_PROFILE_ID,
} from '../lib/deletion-cascade';

// ─────────────────────────────────────────────────────────────────────────────
// This is a RATCHET on the most dangerous operation in the product.
//
// Deleting one account cascades into 87 tables. Six of them hold money, and the
// paths are long enough that nobody would find them by reading the schema:
//
//   creator_profiles -> digital_products -> product_orders
//   nonprofit_profiles -> tax_receipts
//   campaigns -> fundraising_events -> event_tickets -> ...
//
// Reassigning the FIRST hop to the tombstone severs every path below it. So the
// test is: whatever the schema says today, the reassignment set still covers
// every route to money. A migration that adds one foreign key can open a seventh
// route, and the only symptom in production would be a total that got smaller.
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA = readFileSync(path.join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
const keys = parseForeignKeys(SCHEMA);

describe('the parser is reading the real schema', () => {
  it('finds a substantial number of foreign keys', () => {
    // A regex that silently matched nothing would make every assertion below
    // pass while checking nothing at all.
    expect(keys.length).toBeGreaterThan(200);
  });

  it('reads the two constraints this whole design turns on', () => {
    expect(keys).toContainEqual({ child: 'profiles', column: 'id', parent: 'users', onDelete: 'CASCADE' });
    expect(keys).toContainEqual({ child: 'campaigns', column: 'user_id', parent: 'profiles', onDelete: 'CASCADE' });
    // The one that makes donations RECEIVED the hazard and donations MADE safe.
    expect(keys).toContainEqual({ child: 'donations', column: 'donor_id', parent: 'profiles', onDelete: 'SET NULL' });
  });
});

describe('cascade closure', () => {
  it('reaches donations from a deleted profile', () => {
    const reached = cascadeClosure(keys, 'profiles');
    expect(reached.has('donations')).toBe(true);
    expect(reached.get('donations')).toEqual(['campaigns.user_id', 'donations.campaign_id']);
  });

  it('does not propagate through SET NULL', () => {
    // The distinction the whole fix rests on: a SET NULL edge keeps the row.
    const onlySetNull = [
      { child: 'donations', column: 'donor_id', parent: 'profiles', onDelete: 'SET NULL' as const },
    ];
    expect(cascadeClosure(onlySetNull, 'profiles').has('donations')).toBe(false);
  });
});

describe('the tombstone reassignment set covers every path to money', () => {
  it('leaves no money-bearing table reachable', () => {
    const roots = moneyBearingRoots(keys);
    const covered = new Set(TOMBSTONE_REASSIGNMENTS.map((r) => `${r.table}.${r.column}`));
    const uncovered = roots.filter((root) => !covered.has(root));

    expect(
      uncovered,
      'a foreign key opened a new path from a deleted account to money — reassign this root to the tombstone, or the delete will take those rows with it',
    ).toEqual([]);
  });

  it('reassigns nothing that is not needed', () => {
    // The other direction. Reassigning a table that does NOT protect money hands
    // the tombstone data it should not own — a deleted user's private records
    // surviving under a shared profile.
    const roots = new Set(moneyBearingRoots(keys));
    const surplus = TOMBSTONE_REASSIGNMENTS
      .map((r) => `${r.table}.${r.column}`)
      .filter((pair) => !roots.has(pair));
    expect(surplus).toEqual([]);
  });

  it('names paths that are genuinely non-obvious', () => {
    // Guards the guard: if MONEY_BEARING were trimmed to just `donations`, the
    // assertions above would still pass while three real paths went unprotected.
    const reached = cascadeClosure(keys, 'profiles');
    for (const table of ['product_orders', 'tax_receipts', 'event_tickets']) {
      expect(reached.has(table), `${table} should be reachable — this test is checking the wrong thing`).toBe(true);
      expect(MONEY_BEARING).toContain(table);
    }
  });
});

describe('the tombstone itself', () => {
  const migration = readFileSync(
    path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20260904030000_deleted_user_tombstone.sql'),
    'utf8',
  );

  it('is the id the application reassigns to', () => {
    expect(migration).toContain(TOMBSTONE_PROFILE_ID);
  });

  it('cannot be signed into', () => {
    // ⚠️ A sign-in-able tombstone is an account that owns every deleted user's
    // campaigns, payouts and Stripe subscriptions.
    expect(migration).toMatch(/banned_until/);
    expect(migration).toMatch(/'infinity'::timestamptz/);
    expect(migration, 'a confirmed email would allow a magic-link sign-in').toMatch(/NULL,\s*--\s*never confirmed/);
    expect(migration).not.toMatch(/crypt\(/);
  });

  it('is safe to run twice', () => {
    // Migrations get replayed against existing databases.
    expect((migration.match(/ON CONFLICT \(id\) DO NOTHING/g) ?? []).length).toBe(2);
  });
});
