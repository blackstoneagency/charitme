import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// The pending-migration count must not drift from what is on disk.
//
// todo.md stated it FOUR different ways — 3, 4, 6 and 7 — across entries written
// between 2026-07-27 and 2026-07-29. All four were wrong. The release ledger,
// which actually compared against the production ledger, recorded
// **105 local / 87 remote / 18 pending**, verified three ways: `supabase db push
// --dry-run --include-all` selected exactly those 18, a read-only production
// schema dump confirmed the objects were absent, and a restored production clone
// applied all 18 in order.
//
// Nine migrations have been added since. The count is therefore arithmetic, not
// a guess — and this test keeps it that way, because the failure mode is not
// "someone miscounts" but "someone adds a migration and the docs keep the old
// number", which is exactly how four numbers appeared.
//
// The ONE external input is APPLIED_AT_AUDIT. It cannot be re-derived offline:
// `supabase/schema.sql` is regenerated from the migrations themselves by
// `scripts/regen_schema.sh`, so it contains unapplied tables too and mirrors
// intent rather than production. Anyone with credentials can re-check it in one
// command — `supabase migration list --linked` — and should update it here if
// the release gate is ever opened.
// ─────────────────────────────────────────────────────────────────────────────

const MIGRATIONS = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
const TODO = join(__dirname, '..', '..', '..', 'todo.md');

/**
 * Migrations confirmed applied to production by the 2026-07-29 ledger audit.
 * Re-confirmed at 87/105 after a Vercel deploy, proving the app never applies
 * migrations outside the staging-gated release workflow.
 *
 * ⚠️ This is a SNAPSHOT, not a live reading, and it is known to be stale.
 * Production has since been measured to carry at least two migrations this audit
 * lists as pending — `20260817000000_campaign_geolocation` (`/api/campaigns/nearby`
 * answers `available: true`, only reachable once the `latitude` column exists)
 * and `20260820000000_incidents_and_maintenance` (`/status` renders the
 * `length === 0` branch, which needs a successful read).
 *
 * What this file guards is therefore **disk against the audit**, which catches a
 * renamed or removed migration. It does NOT establish how many are pending, and
 * the number it derives is an UPPER BOUND. Only
 * `supabase migration list --linked` answers that, which is what
 * `supabase/RELEASE-RUNBOOK.md` Step 3 now says to run.
 */
const APPLIED_AT_AUDIT = 87;

/** Versions the audit found pending. Kept so the arithmetic can be cross-checked. */
const PENDING_AT_AUDIT = [
  '20260524000000', '20260528114000', '20260607900000', '20260728020000',
  '20260806000000', '20260806010000', '20260807000000', '20260808000000',
  '20260809000000', '20260810000000', '20260811000000', '20260812000000',
  '20260812010000', '20260812020000', '20260812030000', '20260813000000',
  '20260814000000', '20260814010000',
];

const files = () => readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
const versionOf = (f: string) => f.split('_')[0];

describe('pending migration ledger stays true to disk', () => {
  it('finds a real migration set', () => {
    expect(files().length, 'no migrations found — this guard would pass vacuously').toBeGreaterThan(100);
  });

  it('every version the audit found pending is still on disk', () => {
    // A renamed or deleted migration would silently change the arithmetic below
    // while leaving the recorded count looking correct.
    const onDisk = new Set(files().map(versionOf));
    const missing = PENDING_AT_AUDIT.filter((v) => !onDisk.has(v));
    expect(missing, 'an audited-pending migration has been renamed or removed').toEqual([]);
  });

  it('the count reconciles two independent ways', () => {
    const local = files().length;
    const byLedger = local - APPLIED_AT_AUDIT;
    const addedSince = files()
      .map(versionOf)
      .filter((v) => v > PENDING_AT_AUDIT[PENDING_AT_AUDIT.length - 1]).length;
    const bySum = PENDING_AT_AUDIT.length + addedSince;
    // If these disagree, a migration was applied out-of-band, or one was added
    // with a timestamp older than the audit — either way the number is no longer
    // derivable and needs a fresh `supabase migration list --linked`.
    expect(bySum, `local(${local}) - applied(${APPLIED_AT_AUDIT}) = ${byLedger}, but audited(18) + addedSince(${addedSince}) = ${bySum}`).toBe(byLedger);
  });

  it('todo.md records the file-derived count, not a stale one', () => {
    // Pins the ARITHMETIC against disk, so adding a migration cannot silently
    // leave the written number behind. It does not claim the number reflects
    // production — see the note on APPLIED_AT_AUDIT.

    const pending = files().length - APPLIED_AT_AUDIT;
    const todo = readFileSync(TODO, 'utf8');

    // Scoped to the ledger SECTION, not the whole file. Searching all 18k lines
    // matched `2026-07-27` beside the word "pending" in an unrelated heading, so
    // the assertion passed with a planted wrong count — caught by mutation.
    const start = todo.indexOf('## 🛑 SUPABASE STAGING');
    expect(start, 'the ledger section is missing; this guard has nothing to check').toBeGreaterThan(-1);
    const end = todo.indexOf('\n## ', start + 1);
    const section = todo.slice(start, end === -1 ? undefined : end);

    expect(
      section,
      `the ledger section must state the pending count as ${pending}. Adding a migration changes it — update the section in the same commit.`,
    ).toMatch(new RegExp(`pending count is \\*\\*${pending}\\*\\*`));
    expect(
      section,
      'the reconciliation arithmetic must show the same number',
    ).toMatch(new RegExp(`= ${pending}\\b`));
  });
});
