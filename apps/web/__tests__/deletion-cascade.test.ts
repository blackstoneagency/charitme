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
  // ⚠️ This exists because the FIRST tombstone's auth row is unreadable: it was
  // inserted by raw SQL, which left NULL in the token columns GoTrue scans as
  // non-nullable strings, so every Admin API call for that id returns 500 and
  // only raw SQL can repair it. Production could not be repaired remotely, so
  // the override is the path it actually took — a fresh id provisioned through
  // the Auth API, which populates those columns.
  it('defaults to the migration id', () => {
    expect(tombstoneProfileId({})).toBe(TOMBSTONE_PROFILE_ID);
  });

  it('accepts a well-formed override', () => {
    // ⚠️ Must NOT be the default, or this passes whether or not the override is
    // read at all. It was `…00000000dead` until that became the default.
    const fresh = '11111111-2222-4333-8444-555555555555';
    expect(fresh).not.toBe(TOMBSTONE_PROFILE_ID);
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
    path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20260906000000_tombstone_gotrue_readable.sql'),
    'utf8',
  );

  it('is the id the application reassigns to', () => {
    expect(migration).toContain(TOMBSTONE_PROFILE_ID);
  });

  // ⚠️ Strip comments before asserting. The migration EXPLAINS what it avoids and
  // necessarily quotes it while doing so, so a check against the raw file fails
  // on its own commentary — the trap that has caught guards in this repo
  // repeatedly.
  const code = migration.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--[^\n]*$/gm, '');
  // The first `DO $$ … END $$;` provisions the tombstone; the second repairs
  // rows that already exist. Only the first is asserted on below — the repair
  // block legitimately mentions `'infinity'` in a WHERE clause, and a check
  // against the whole file would read that as the bug it removes.
  const [provision, repair] = code.split('END $$;');

  it('cannot be signed into', () => {
    // ⚠️ A sign-in-able tombstone is an account that owns every deleted user's
    // campaigns, payouts and Stripe subscriptions.
    expect(provision).toMatch(/banned_until/);
    expect(provision).toMatch(/'2999-12-31[^']*'::timestamptz/);
    expect(provision, 'an unbounded ban has no business in a Go time.Time').not.toMatch(/'infinity'/);
    expect(migration, 'a confirmed email would allow a magic-link sign-in').toMatch(/NULL,\s*--\s*never confirmed/);
    expect(migration).not.toMatch(/crypt\(/);
  });

  it('populates every column GoTrue scans as a non-nullable string', () => {
    // ⚠️ THIS is what made the original tombstone unreadable, not the ban value.
    // GoTrue models these as Go `string`; the columns are nullable with no
    // default, so a raw INSERT that omits them stores NULL and every later read
    // of the row fails to scan with "Database error loading user".
    //
    // Measured against production: 502 of 1139 profiles had unreadable auth
    // rows, including one that sets no `banned_until` at all — which is how the
    // `'infinity'` theory was ruled out.
    for (const column of [
      'confirmation_token',
      'recovery_token',
      'email_change',
      'email_change_token_new',
      'email_change_token_current',
      'phone_change',
      'phone_change_token',
      'reauthentication_token',
    ]) {
      expect(provision, `${column} left NULL makes the row unreadable`).toContain(column);
    }
  });

  it('names the tombstone rather than leaving it blank', () => {
    // ⚠️ `handle_new_user` creates the profile from the auth insert BEFORE this
    // statement runs, so DO NOTHING writes no name — which is exactly what the
    // original migration did, leaving production's tombstone with a NULL
    // full_name and reassigned campaigns showing a blank organiser.
    expect(provision).toMatch(/ON CONFLICT \(id\) DO UPDATE[\s\S]{0,120}full_name = 'Deleted User'/);
  });

  it('repairs existing rows without touching working ones', () => {
    // NULL → '' is what the Auth API would have written. Scoping to IS NULL is
    // what keeps this from rewriting a live account's tokens.
    expect(repair).toMatch(/IS NULL/);
    expect(repair).toMatch(/information_schema\.columns/);
  });

  it('is safe to run twice', () => {
    // Migrations get replayed against existing databases.
    expect(provision).toMatch(/ON CONFLICT \(id\) DO NOTHING/);
    expect(provision).toMatch(/ON CONFLICT \(id\) DO UPDATE/);
  });
});
