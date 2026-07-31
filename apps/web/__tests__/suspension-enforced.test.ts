import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isSuspendedRoles, parseRoles, ASSIGNABLE_ROLES } from '../lib/roles-shared';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(WEB_ROOT, p), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// Suspension used to be displayed and enforced nowhere.
//
// There is no `profiles.status` column, so suspension is written as a bare
// 'suspended' string appended to the `roles` jsonb. The shared `parseRoles`
// whitelists against ASSIGNABLE_ROLES, which does not contain 'suspended' — so
// every enforcement path built on the shared helper was structurally incapable
// of seeing the marker, while the admin console (which uses its own lenient
// local parser) rendered the badge correctly.
//
// The realistic consequence: trust & safety suspends a fraudulent fundraiser,
// the console says "Suspended", and that account keeps collecting donations.
// ─────────────────────────────────────────────────────────────────────────────

describe('the suspension marker survives the read path', () => {
  it('is NOT an assignable role — it is a status', () => {
    expect(ASSIGNABLE_ROLES as readonly string[]).not.toContain('suspended');
  });

  it('parseRoles still strips it, which is exactly why a separate reader exists', () => {
    // This is the trap, asserted so nobody "fixes" it by adding 'suspended' to
    // the whitelist: that would make isAdmin/isSuperAdmin treat it as a role.
    expect(parseRoles(['organizer', 'suspended'])).toEqual(['organizer']);
  });

  it('isSuspendedRoles sees what parseRoles drops', () => {
    expect(isSuspendedRoles(['organizer', 'suspended'])).toBe(true);
    expect(isSuspendedRoles(['organizer'])).toBe(false);
  });

  it('reads the jsonb whether it arrives as an array or a string', () => {
    expect(isSuspendedRoles('["organizer","suspended"]')).toBe(true);
    expect(isSuspendedRoles('["organizer"]')).toBe(false);
    expect(isSuspendedRoles('suspended')).toBe(true);
  });

  it('does not invent a suspension out of malformed input', () => {
    for (const raw of [null, undefined, 42, {}, [], '', '   ', 'not json']) {
      expect(isSuspendedRoles(raw), `${JSON.stringify(raw)} read as suspended`).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The two actions a suspended account unambiguously must not perform. Broader
// gating (dashboard access, payout history) is a product/legal call and is
// deliberately NOT asserted here.
// ─────────────────────────────────────────────────────────────────────────────

describe('the two enforcement points are wired', () => {
  it('POST /api/campaigns refuses a suspended creator', () => {
    const src = read('app/api/campaigns/route.ts');
    expect(src).toMatch(/getSuspensionState\(\s*user\.id\s*\)/);
    expect(src).toContain('ACCOUNT_SUSPENDED');
  });

  it('POST /api/donations refuses money for a suspended organizer', () => {
    const src = read('app/api/donations/route.ts');
    expect(src).toMatch(/getSuspensionState\(\s*campaign\.user_id\s*\)/);
  });

  // A read failure must not be silently treated as "not suspended" — that is the
  // original bug with extra steps.
  it.each(['app/api/campaigns/route.ts', 'app/api/donations/route.ts'])(
    '%s fails closed when the status read fails',
    (path) => {
      expect(read(path)).toContain("=== 'unknown'");
    },
  );

  it('the donor is not told about a moderation decision on someone else', () => {
    const src = read('app/api/donations/route.ts');
    const at = src.indexOf('const organizerSuspension');
    expect(at).toBeGreaterThan(-1);
    const branch = src.slice(at, at + 800);

    // Only the human-readable strings, not the `=== 'suspended'` comparison that
    // implements the check — an earlier version of this test failed on its own
    // control flow.
    const messages = [...branch.matchAll(/error:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(messages.length, 'no donor-facing messages found to check').toBeGreaterThan(0);
    for (const message of messages) {
      expect(message, 'donor-facing copy leaks the organizer status').not.toMatch(/suspend/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The admin console's local parser is what makes the badge render. If someone
// deletes it in the name of de-duplication without moving status to a column,
// the badge disappears while the account stays active — strictly worse than the
// bug this file guards.
// ─────────────────────────────────────────────────────────────────────────────

describe('the admin console can still see the marker', () => {
  it('keeps a raw reader distinct from the whitelisting one', () => {
    const src = read('app/admin/users/page.tsx');
    expect(src).toContain('rawRoleStrings');
    expect(src).toMatch(/roles\.includes\('suspended'\)/);
  });
});
