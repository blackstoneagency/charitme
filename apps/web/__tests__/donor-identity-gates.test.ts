import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Any code that joins a donor's profile for public display must apply BOTH gates.
//
// Donor identity is emitted from six places, and five of them were leaking:
//   leaderboard · donor wall (page) · donor wall (API) · message wall ·
//   full export · organizer notification
//
// Two gates govern it, and they are independent:
//   `donations.anonymous`        — the donor's choice for THAT gift
//   `profiles.show_public_profile` — their account-wide Profile Visibility
//
// Every leak had the same shape: one gate applied, the other forgotten, or the
// fix applied to one copy of a duplicated mapping. donor-privacy.test.ts pins the
// six known surfaces by name; this catches a SEVENTH being added.
//
// The rule: if a file joins `profiles:donor_id(... full_name ...)`, it is
// assembling donor identity for display and must reference show_public_profile.
// Deliberately narrow — it only fires on that join shape, so admin queries and
// a donor reading their own name are untouched.
// ─────────────────────────────────────────────────────────────────────────────

const APP_WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['app', 'lib', 'components'];
const SKIP = new Set(['node_modules', '.next', '__tests__', 'e2e', 'test-stubs']);

// Admin surfaces legitimately see real identity — that is the job of moderation
// and support tooling, and those pages are behind isAdmin().
const ADMIN_PATH = /(^|\/)admin(\/|$)/;

// Joins that read a donor's name to address that SAME donor, rather than to show
// them to anyone else. Visibility gates do not apply: Profile Visibility governs
// who else can see you, not whether the product may greet you by name in your own
// email. The first version of this check flagged the engage route and would have
// gated CI on correct code.
const ADDRESSES_THE_DONOR_DIRECTLY = new Set([
  // "Thank your donors": name personalizes the greeting in the email sent TO the
  // donor, `anonymous` is already honoured for it, and the response returns only
  // counts (sent / suppressed_count) — no names reach the organizer.
  'app/api/campaigns/[id]/engage/route.ts',
]);

function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      if (SKIP.has(e)) continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
    }
  };
  walk(root);
  return out;
}

/** A PostgREST join pulling the donor's profile name for display. */
const DONOR_NAME_JOIN = /profiles:donor_id\s*\([^)]*full_name[^)]*\)/;

describe('donor identity gates', () => {
  it('every donor-profile join also consults show_public_profile', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of listFiles(join(APP_WEB_ROOT, dir))) {
        const rel = relative(APP_WEB_ROOT, file);
        if (ADMIN_PATH.test(rel)) continue;
        if (ADDRESSES_THE_DONOR_DIRECTLY.has(rel)) continue;
        const src = readFileSync(file, 'utf8');
        if (!DONOR_NAME_JOIN.test(src)) continue;
        if (!/show_public_profile/.test(src)) offenders.push(rel);
      }
    }
    expect(
      offenders,
      `These files join a donor's profile for display but never consult\n` +
        `show_public_profile, so a donor who set Profile Visibility to Private\n` +
        `would still be named. Apply BOTH gates — the per-gift \`anonymous\` flag\n` +
        `and show_public_profile — as the leaderboard and donor wall now do:\n  ` +
        offenders.join('\n  '),
    ).toEqual([]);
  });

  it('is non-vacuous: it actually finds the known donor surfaces', () => {
    // If the join pattern stops matching, the check above passes for the wrong
    // reason. Assert it still sees the real call sites.
    const matched = SCAN_DIRS.flatMap((d) => listFiles(join(APP_WEB_ROOT, d)))
      .filter((f) => DONOR_NAME_JOIN.test(readFileSync(f, 'utf8')))
      .map((f) => relative(APP_WEB_ROOT, f));
    expect(matched.length, 'the join pattern must match real files').toBeGreaterThan(0);
    expect(matched.some((f) => f.includes('campaigns'))).toBe(true);
  });

  it('flags a join that omits the visibility gate', () => {
    const leaky = `.select('id, message, anonymous, profiles:donor_id(full_name, avatar_url)')`;
    const fixed = `.select('id, message, anonymous, profiles:donor_id(full_name, avatar_url, show_public_profile)')`;
    expect(DONOR_NAME_JOIN.test(leaky)).toBe(true);
    expect(/show_public_profile/.test(leaky)).toBe(false); // would be reported
    expect(/show_public_profile/.test(fixed)).toBe(true);  // would pass
  });

  it('keeps the direct-address exemption narrow and honest', () => {
    // One entry, and it must still be a real file that really does join donor
    // names — otherwise the exemption is hiding something.
    expect(ADDRESSES_THE_DONOR_DIRECTLY.size).toBe(1);
    for (const rel of ADDRESSES_THE_DONOR_DIRECTLY) {
      const src = readFileSync(join(APP_WEB_ROOT, rel), 'utf8');
      expect(DONOR_NAME_JOIN.test(src), `${rel} should still join donor names`).toBe(true);
      // It must not leak names back to the caller: only aggregate counts.
      expect(src, `${rel} must return counts, not names`).toMatch(/suppressed_count/);
      expect(src, `${rel} must still honour the per-gift anonymous flag`).toMatch(/anonymous \?/);
    }
  });
});
