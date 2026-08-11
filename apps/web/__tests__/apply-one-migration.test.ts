import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// `apply-one-migration.mjs` writes DDL to a database holding real donations, so
// its refusals are the feature.
//
// It exists because `supabase db push` is all-or-nothing: applying the deletion
// tombstone — additive, two inserts — otherwise means running all 49 pending
// migrations, including three their own authors flagged as needing staging
// verification and two that delete rows from payment-adjacent tables.
//
// Run as a subprocess rather than by importing internals: what matters is what
// the command actually does when someone types it, including its exit code.
// ─────────────────────────────────────────────────────────────────────────────

const SCRIPT = path.join(__dirname, '..', 'scripts', 'apply-one-migration.mjs');
const MIGRATIONS = path.join(__dirname, '..', '..', '..', 'supabase', 'migrations');

function run(args: string[]): { status: number; out: string } {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], {
      encoding: 'utf8',
      // Never inherit a real token from the developer's shell: this test must
      // not be able to touch production, whatever the environment holds.
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: '' },
    });
    return { status: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { status: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

describe('it accepts the additive migration it was written for', () => {
  it('passes the safety check on the tombstone', () => {
    const { status, out } = run(['20260904030000_deleted_user_tombstone']);
    expect(out).toContain('additive only');
    expect(status).toBe(0);
  });

  it('does nothing without a token, and says how to get one', () => {
    // Silently succeeding while applying nothing is the failure mode that makes
    // someone believe a migration is live when it is not.
    const { out } = run(['20260904030000_deleted_user_tombstone']);
    expect(out).toMatch(/SUPABASE_ACCESS_TOKEN is not set/);
    expect(out).toMatch(/dashboard\/account\/tokens/);
  });

  it('exits non-zero when --commit was asked for but is impossible', () => {
    const { status } = run(['20260904030000_deleted_user_tombstone', '--commit']);
    expect(status).not.toBe(0);
  });
});

describe('it refuses migrations that remove data', () => {
  it('refuses the dedupe migration', () => {
    // Deletes duplicate rows from campaign_processor_fees and friends. Correct,
    // intentional, and not something a script should do unattended.
    const { status, out } = run(['20260812000000_make_onconflict_targets_inferable']);
    expect(out).toContain('destructive');
    expect(status).not.toBe(0);
  });

  it('refuses every migration in the repo that deletes, drops or truncates', () => {
    // Sweeps the real corpus rather than one example: a regex that only caught
    // the one case it was written against would pass the test above forever.
    const destructive = readdirSync(MIGRATIONS).filter((f) => {
      const sql = readFileSync(path.join(MIGRATIONS, f), 'utf8');
      const code = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--[^\n]*$/gm, '');
      return /\bDELETE\s+FROM\b|\bDROP\s+TABLE\b|\bDROP\s+COLUMN\b/i.test(code);
    });
    expect(destructive.length, 'no destructive migrations found — this sweep is checking nothing').toBeGreaterThan(0);

    for (const file of destructive.slice(0, 6)) {
      const { status } = run([file.replace(/\.sql$/, '')]);
      expect(status, `${file} was not refused`).not.toBe(0);
    }
  });
});

describe('the refusal cannot be fooled by prose', () => {
  it('ignores destructive verbs that appear only in comments', () => {
    // The tombstone's own header explains the cascade it avoids and quotes
    // "DELETE" while doing so. Stripping comments first is what stops a
    // migration's commentary from failing its own safety check — and this
    // asserts that the stripping is load-bearing, not incidental.
    const { status, out } = run(['20260904030000_deleted_user_tombstone']);
    expect(out).not.toContain('refusing');
    expect(status).toBe(0);
  });

  it('names a migration that does not exist rather than guessing', () => {
    const { status, out } = run(['20990101000000_not_a_migration']);
    expect(out).toMatch(/no such migration/);
    expect(status).not.toBe(0);
  });
});
