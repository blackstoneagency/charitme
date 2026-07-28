import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROUTE = join(__dirname, '..', 'app/api/beneficiaries/invites/accept/route.ts');
const src = readFileSync(ROUTE, 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// Accepting a beneficiary invite writes `campaigns.beneficiary_profile_id` —
// it decides who the fundraiser is understood to be raising money for. The
// invite names an email and the accept screen shows it ("this invite is for
// <email>"), but nothing compared it: the column was SELECTed and then never
// read, so any signed-in user holding the token could accept an invite
// addressed to someone else.
//
// Possession of a link is not identity. Tokens get forwarded and links get
// shared, and the invite itself states who it is for.
// ─────────────────────────────────────────────────────────────────────────────

describe('beneficiary invite acceptance verifies identity', () => {
  it('compares the invite email to the signed-in user, case-insensitively', () => {
    expect(src, 'the invite email is never compared to the accepting user').toMatch(
      /inv\.email[\s\S]{0,80}toLowerCase\(\)[\s\S]{0,120}user\.email/,
    );
    expect(src).toMatch(/status: 403/);
  });

  it('rejects before writing anything', () => {
    // Order matters more than the check existing: the invite is marked accepted
    // and cannot be retried, so a check that ran afterwards would leave the
    // real invitee permanently locked out.
    const check = src.indexOf('INVITE_EMAIL_MISMATCH');
    const firstWrite = src.indexOf('supabaseAdmin.from(\'beneficiary_invites\').update');
    expect(check).toBeGreaterThan(-1);
    expect(firstWrite).toBeGreaterThan(-1);
    expect(check, 'the identity check runs after the invite is already consumed').toBeLessThan(firstWrite);
  });

  it('does not report success when the campaign link failed', () => {
    // This is the write that actually makes someone a beneficiary; the role
    // update is only a label. Dropping it silently showed "You're set as a
    // beneficiary!" over a campaign with no beneficiary at all.
    expect(src).toMatch(/const \{ error: \w+ \} = await supabaseAdmin\s*\.?\s*\n?\s*\.from\('campaigns'\)|const \{ error: \w+ \} = await supabaseAdmin\.from\('campaigns'\)/);
    expect(src).toMatch(/BENEFICIARY_LINK_FAILED/);
  });
});
