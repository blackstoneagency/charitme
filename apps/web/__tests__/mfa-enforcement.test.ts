import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// Enrolling TOTP used to protect nothing. Supabase issues a password sign-in at
// aal1 and nothing in the app refused an aal1 session, so an attacker holding
// only the password signed in unchallenged while the user believed 2FA was on.
//
// These pin the enforcement AND the three properties that stop it locking people
// out — the failure mode of a second-factor gate is worse than the bug it fixes.
// ─────────────────────────────────────────────────────────────────────────────

describe('two-factor enforcement', () => {
  const mw = read('middleware.ts');

  it('refuses an aal1 session when the user has a verified factor', () => {
    expect(mw).toMatch(/getAuthenticatorAssuranceLevel/);
    expect(mw).toMatch(/nextLevel === 'aal2'/);
    expect(mw).toMatch(/currentLevel !== 'aal2'/);
  });

  it('cannot redirect-loop on the challenge page itself', () => {
    // Belt and braces: /login/mfa is not under a PROTECTED prefix either.
    expect(mw).toMatch(/path !== MFA_CHALLENGE_PATH/);
    const protectedLine = mw.match(/const PROTECTED = \[[^\]]*\]/)?.[0] ?? '';
    expect(protectedLine, '/login must not be protected, or the gate would loop')
      .not.toMatch(/'\/login'/);
  });

  it('fails OPEN so an auth outage cannot lock out signed-in users', () => {
    // A throw from getAuthenticatorAssuranceLevel must not deny access.
    const block = mw.slice(mw.indexOf('getAuthenticatorAssuranceLevel'));
    expect(block.slice(0, 700)).toMatch(/catch\s*\{/);
    expect(block.slice(0, 700)).not.toMatch(/catch[\s\S]{0,120}NextResponse\.redirect/);
  });

  it('the challenge page exists and can complete the factor', () => {
    const page = read('app/login/mfa/page.tsx');
    expect(page).toMatch(/mfa\.challenge/);
    expect(page).toMatch(/mfa\.verify/);
    // Users with no verified factor must not be stranded on it.
    expect(page).toMatch(/if \(!verified\)/);
    // And they must always be able to escape.
    expect(page).toMatch(/signOut/);
  });
});
