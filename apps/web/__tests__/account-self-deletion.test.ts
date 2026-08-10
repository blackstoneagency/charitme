import { describe, expect, it } from 'vitest';
import {
  accountSelfDeleteEnabled,
  isConfirmed,
  refusalFor,
  refusalMessage,
  DELETION_CONFIRMATION,
} from '../lib/account-deletion';

// ─────────────────────────────────────────────────────────────────────────────
// The danger this guards is not a bug in the code below — it is the schema.
//
//     auth.users DELETE
//       └─ profiles.id            ON DELETE CASCADE
//           └─ campaigns.user_id  ON DELETE CASCADE
//               └─ donations.campaign_id ON DELETE CASCADE
//
// so `auth.admin.deleteUser(id)` — the one-line way to do this — erases every
// donation ever made to that fundraiser. Other people's money, other people's
// receipts, and the figures every public total is computed from. The delete
// succeeds, the pages still render, and the totals are just smaller.
//
// These tests pin the refusal, because the refusal is the feature.
// ─────────────────────────────────────────────────────────────────────────────

const ON = { enabled: true, confirmed: true };

describe('the flag', () => {
  it('is off unless explicitly set to the string "true"', () => {
    // `master` deploys straight to production. An irreversible delete must not
    // arrive as a side effect of a merge.
    expect(accountSelfDeleteEnabled({})).toBe(false);
    expect(accountSelfDeleteEnabled({ ACCOUNT_SELF_DELETE_ENABLED: '' })).toBe(false);
    expect(accountSelfDeleteEnabled({ ACCOUNT_SELF_DELETE_ENABLED: '1' })).toBe(false);
    expect(accountSelfDeleteEnabled({ ACCOUNT_SELF_DELETE_ENABLED: 'TRUE' })).toBe(false);
    expect(accountSelfDeleteEnabled({ ACCOUNT_SELF_DELETE_ENABLED: 'true' })).toBe(true);
  });
});

describe('confirmation', () => {
  it('accepts only the exact phrase', () => {
    expect(isConfirmed(DELETION_CONFIRMATION)).toBe(true);
    expect(isConfirmed(`  ${DELETION_CONFIRMATION}  `)).toBe(true);
    expect(isConfirmed('delete my account')).toBe(false);
    expect(isConfirmed('DELETE')).toBe(false);
  });

  it('is never satisfied by a truthy value', () => {
    // A boolean flag is one stray fetch or one replayed request away from
    // deleting an account, and there is no undo.
    expect(isConfirmed(true)).toBe(false);
    expect(isConfirmed(1)).toBe(false);
    expect(isConfirmed({})).toBe(false);
  });
});

describe('refusing rather than cascading', () => {
  it('refuses when the account has received donations', () => {
    expect(refusalFor({ donationsReceived: 1 }, ON)).toBe('ACCOUNT_HAS_DONATIONS');
    expect(refusalFor({ donationsReceived: 4_000 }, ON)).toBe('ACCOUNT_HAS_DONATIONS');
  });

  it('refuses when the count could not be READ', () => {
    // ⚠️ The one that matters. An unknown number of donations is not zero
    // donations, and treating null as 0 is exactly what cascades. Same
    // fail-closed rule as the ownership read.
    expect(refusalFor({ donationsReceived: null }, ON)).toBe('ACCOUNT_HAS_DONATIONS');
  });

  it('allows deletion when the account has genuinely received none', () => {
    // The other half: a real zero is a real answer, and a donor who never ran a
    // campaign must still be able to delete their account. A guard that refused
    // everything would pass every test above while shipping nothing.
    expect(refusalFor({ donationsReceived: 0 }, ON)).toBeNull();
  });

  it('checks the flag and the confirmation before anything else', () => {
    expect(refusalFor({ donationsReceived: 0 }, { enabled: false, confirmed: true })).toBe('DISABLED');
    expect(refusalFor({ donationsReceived: 0 }, { enabled: true, confirmed: false })).toBe('NOT_CONFIRMED');
  });
});

describe('what the user is told', () => {
  it('explains the donation refusal instead of saying something went wrong', () => {
    const message = refusalMessage('ACCOUNT_HAS_DONATIONS');
    // The refusal is permanent until the campaigns are settled, so a generic
    // error would send the user to support with nothing to say.
    expect(message).toMatch(/donation/i);
    expect(message).toMatch(/support/i);
    expect(message).not.toMatch(/something went wrong/i);
  });

  it('quotes the phrase the user has to type', () => {
    expect(refusalMessage('NOT_CONFIRMED')).toContain(DELETION_CONFIRMATION);
  });
});
