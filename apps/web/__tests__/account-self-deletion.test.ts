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
  it('refuses when the tombstone is absent', () => {
    // Nowhere to move the campaigns, payouts and subscriptions to — so the
    // delete would cascade into other people's donations.
    expect(refusalFor({ tombstonePresent: false }, ON)).toBe('TOMBSTONE_MISSING');
  });

  it('refuses when the tombstone check itself FAILED', () => {
    // ⚠️ The one that matters. "We could not confirm it exists" is not "it
    // exists", and optimism here destroys financial records. Same fail-closed
    // rule as the ownership read.
    expect(refusalFor({ tombstonePresent: null }, ON)).toBe('TOMBSTONE_MISSING');
  });

  it('allows deletion once the tombstone is in place', () => {
    // The other half. A guard that refused everything would pass every test
    // above while making the feature impossible — which is the bug the earlier
    // "refuse if they have donations" version actually shipped.
    expect(refusalFor({ tombstonePresent: true }, ON)).toBeNull();
  });

  it('checks the flag and the confirmation before anything else', () => {
    expect(refusalFor({ tombstonePresent: true }, { enabled: false, confirmed: true })).toBe('DISABLED');
    expect(refusalFor({ tombstonePresent: true }, { enabled: true, confirmed: false })).toBe('NOT_CONFIRMED');
  });
});

describe('what the user is told', () => {
  it('describes the tombstone refusal as the temporary operator problem it is', () => {
    // Nothing about the user's account blocks this, so it must not read as a
    // judgement on them — and it IS retryable, unlike the old permanent refusal.
    const message = refusalMessage('TOMBSTONE_MISSING');
    expect(message).toMatch(/try again/i);
    expect(message).not.toMatch(/your campaigns|donation/i);
  });

  it('quotes the phrase the user has to type', () => {
    expect(refusalMessage('NOT_CONFIRMED')).toContain(DELETION_CONFIRMATION);
  });
});
