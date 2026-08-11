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
  tombstoneProfileId,
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

describe('the tombstone id can be moved without database access', () => {
  // ⚠️ This exists because the live tombstone's auth row is poisoned:
  // `banned_until = 'infinity'` cannot be serialised by GoTrue, so every Admin
  // API call for that id returns 500 and only raw SQL can repair it. The
  // override turns that recovery into one environment variable.
  it('defaults to the migration id', () => {
    expect(tombstoneProfileId({})).toBe(TOMBSTONE_PROFILE_ID);
  });

  it('accepts a well-formed override', () => {
    const fresh = '00000000-0000-4000-8000-00000000dead';
    expect(tombstoneProfileId({ TOMBSTONE_PROFILE_ID: fresh })).toBe(fresh);
  });

  it('IGNORES a malformed override rather than trusting it', () => {
    // A bad id points every reassignment at a row that does not exist and fails
    // on the foreign key — mid-deletion, after the profile has been anonymised.
    for (const bad of ['', '   ', 'not-a-uuid', '123', '00000000-0000-4000-8000']) {
      expect(tombstoneProfileId({ TOMBSTONE_PROFILE_ID: bad })).toBe(TOMBSTONE_PROFILE_ID);
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

  // ⚠️ Strip comments before asserting. The migration EXPLAINS why it avoids
  // `'infinity'` and necessarily quotes it while doing so, so a check against the
  // raw file fails on its own commentary — the same trap that has caught guards
  // in this repo repeatedly.
  const code = migration.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--[^\n]*$/gm, '');

  it('cannot be signed into', () => {
    // ⚠️ A sign-in-able tombstone is an account that owns every deleted user's
    // campaigns, payouts and Stripe subscriptions.
    expect(code).toMatch(/banned_until/);
    // ⚠️ Was `'infinity'::timestamptz`, and this guard PINNED THE BUG. Valid
    // PostgreSQL, but GoTrue cannot serialise infinity to JSON, so the auth row
    // becomes unreadable through the Admin API — getUserById, updateUserById and
    // deleteUser all 500 for that id, permanently. Confirmed against production:
    // a real user id 404s, a random id 404s, only the tombstone 500s.
    // A finite far-future ban is just as unusable for sign-in and stays
    // readable, so it can be audited and repaired.
    expect(code, "'infinity' makes the row unreadable through the Auth API").not.toMatch(/'infinity'::timestamptz/);
    expect(code).toMatch(/'2999-12-31[^']*'::timestamptz/);
    expect(migration, 'a confirmed email would allow a magic-link sign-in').toMatch(/NULL,\s*--\s*never confirmed/);
    expect(migration).not.toMatch(/crypt\(/);
  });

  it('is safe to run twice', () => {
    // Migrations get replayed against existing databases.
    expect((migration.match(/ON CONFLICT \(id\) DO NOTHING/g) ?? []).length).toBe(2);
  });
});
