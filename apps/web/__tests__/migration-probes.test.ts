import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// Plain .mjs script — TS infers its exports from the JSDoc, so no directive is
// needed here. Imported for its catalogue only; it makes no requests on import.
import { PROBES, NO_PUBLIC_SIGNAL } from '../scripts/probe-production-migrations.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// `scripts/probe-production-migrations.mjs` asks production which migrations are
// already applied, over unauthenticated HTTP. Its VALUE is that it replaces a
// file count with a measurement; its RISK is that a stale or sloppy entry
// produces a confident wrong answer about the database, which is exactly the
// failure the script was written to correct.
//
// These tests check the catalogue offline. They make no network requests — the
// script only fires HTTP when invoked directly, which is what the
// `invokedDirectly` guard at its foot is for.
// ─────────────────────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'supabase', 'migrations');

type Probe = {
  migration: string;
  proves: string;
  firstCreatedIn: string;
  path?: string;
  resolve?: unknown;
  sentinel?: string;
  sentinelSource?: string;
  requires?: RegExp;
  ok: (body: unknown, text: string) => boolean;
  control: { path: string; status: number; method?: string };
};

const probes = PROBES as Probe[];
const noSignal = NO_PUBLIC_SIGNAL as [string, string][];

const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
const stems = new Set(files.map((f) => f.replace(/\.sql$/, '')));

describe('production migration probes', () => {
  it('every probed and listed migration is a real file on disk', () => {
    const named = [...probes.map((p) => p.migration), ...noSignal.map(([m]) => m)];
    const missing = named.filter((m) => !stems.has(m));
    expect(
      missing,
      'the catalogue names a migration that does not exist — it was renamed or removed',
    ).toEqual([]);
  });

  it('covers every migration in the window it claims to describe', () => {
    // Derived, not hardcoded: the window runs from the OLDEST migration the
    // catalogue mentions to the newest file on disk. Hardcoding "the last 27"
    // would rebuild the file-count assumption this whole script exists to
    // replace.
    const named = new Set([...probes.map((p) => p.migration), ...noSignal.map(([m]) => m)]);
    const oldest = [...named].sort()[0];
    const inWindow = [...stems].filter((s) => s >= oldest).sort();
    const uncovered = inWindow.filter((s) => !named.has(s));
    expect(
      uncovered,
      'a migration in the probe window has no entry — add a probe, or list it in ' +
        'NO_PUBLIC_SIGNAL with the reason. Silence reads as "pending" to whoever runs this.',
    ).toEqual([]);
  });

  it('never both probes a migration and lists it as unprobeable', () => {
    const probed = new Set(probes.map((p) => p.migration));
    const both = noSignal.map(([m]) => m).filter((m) => probed.has(m));
    expect(both, 'a migration cannot be both proven and unprovable').toEqual([]);
  });

  it('every probe reads something its own migration FIRST created', () => {
    // The trap this closes: `reconcile_runtime_tables` uses `create table if not
    // exists`. If a table it names was actually created three migrations
    // earlier, a successful read proves the EARLIER one applied and says nothing
    // about this one — a false APPLIED on the strength of a real HTTP 200.
    for (const p of probes) {
      expect(p.firstCreatedIn, `${p.proves}: firstCreatedIn must match the migration it proves`)
        .toBe(p.migration);

      // And confirm against the SQL rather than trusting the field. The table
      // name is the leading identifier of `proves` ("campaigns.latitude / longitude"
      // → `campaigns`), so column probes check their table's origin too.
      const table = p.proves.split(/[.\s(]/)[0];
      const creators = files
        .filter((f) => new RegExp(`create table if not exists (public\\.)?${table}\\b`, 'i')
          .test(readFileSync(join(MIGRATIONS_DIR, f), 'utf8')))
        .map((f) => f.replace(/\.sql$/, ''))
        .sort();

      if (creators.length === 0) continue; // column probe on a pre-existing table
      expect(
        creators[0] <= p.migration,
        `${p.proves} is first created in ${creators[0]}, which is older than ${p.migration} — ` +
          'a successful read would prove the older migration, not this one',
      ).toBe(true);
    }
  });

  it('every probe has a control that cannot be confused with the probe itself', () => {
    for (const p of probes) {
      expect(p.control, `${p.proves} has no control`).toBeTruthy();
      expect(p.control.status, `${p.proves}: a 200 control proves nothing`).not.toBe(200);
      // Same path is fine ONLY when the method differs — that is the
      // "POST returns 401 before touching the database" pattern.
      // A probe with no static path discovers one at runtime; its control is
      // still static, so it cannot collide with the probe request.
      if (p.path && p.control.path === p.path) {
        expect(
          p.control.method && p.control.method !== 'GET',
          `${p.proves}: control duplicates the probe request exactly`,
        ).toBeTruthy();
      }
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Absence-probes. One probe (peer-fundraiser attribution) proves the column
  // EXISTS because a failure note is NOT on the page. That is strictly weaker
  // than the others: every one of them needs a specific string to appear, and
  // fails closed if the page changes, whereas this one passes when the string
  // it looks for vanishes — including if it vanishes because someone reworded
  // it. These three tests are the whole reason that shape is acceptable.
  // ───────────────────────────────────────────────────────────────────────────
  const absence = probes.filter((p) => p.sentinel);

  it('every absence-probe still finds its sentinel in the source it names', () => {
    expect(absence.length, 'the absence-probe was removed — delete these tests too').toBeGreaterThan(0);
    for (const p of absence) {
      const src = readFileSync(join(__dirname, '..', p.sentinelSource!), 'utf8');
      expect(
        src.includes(p.sentinel!),
        `${p.proves}: "${p.sentinel}" is no longer in ${p.sentinelSource}. The probe reads the ` +
          'ABSENCE of that note as proof the column exists, so a reworded note makes it report ' +
          'APPLIED unconditionally. Update the sentinel and the probe together.',
      ).toBe(true);
    }
  });

  it('every absence-probe also demands positive evidence the page rendered', () => {
    // Without this, an empty body, an error shell or a 200-with-nothing all read
    // as "the note is absent" and therefore as APPLIED.
    for (const p of absence) {
      expect(p.requires, `${p.proves}: an absence-probe with no positive requirement`).toBeInstanceOf(RegExp);
      expect(p.ok(null, ''), `${p.proves}: an EMPTY page must not count as proof`).toBe(false);
      expect(
        p.ok(null, 'unrelated markup with no team heading'),
        `${p.proves}: a page missing the required marker must not count as proof`,
      ).toBe(false);
    }
  });

  it('an absence-probe rejects a page that DOES carry its failure note', () => {
    // The direction that matters: schema missing → note present → NOT applied.
    for (const p of absence) {
      const degraded = `<h1>Fundraising team</h1><p role="note">${p.sentinel}, so this figure will not move.</p>`;
      expect(
        p.ok(null, degraded),
        `${p.proves}: the degraded page must read as NO PROOF, not APPLIED`,
      ).toBe(false);
      // ...and the healthy page, same markup minus the note, must still pass.
      expect(p.ok(null, '<h1>Fundraising team</h1><p>$120 raised</p>'), `${p.proves}: false negative`).toBe(true);
    }
  });

  it('does not probe a route that authenticates before reading', () => {
    // `/api/locale` is the worked example: it answers `{locale:null}` to an
    // anonymous caller without querying, so a 200 would be a phantom proof.
    const authFirst = probes.filter((p) => /\/api\/(locale|tasks|custom-domains)\b/.test(p.path ?? ''));
    expect(
      authFirst.map((p) => p.path),
      'these routes answer before touching the database, so a 200 proves nothing',
    ).toEqual([]);
  });
});
