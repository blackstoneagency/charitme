import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Two audits converged on the same answer: the code is done and a handful of
// SECRETS are missing. That answer lived in prose across mobileGo.md and
// todo.md, where it goes stale the moment somebody sets one of them.
//
// `release:readiness` checks the real environment instead. The things worth
// guarding are the ones that would make its report actively misleading.
// ─────────────────────────────────────────────────────────────────────────────

const script = readFileSync(
  path.join(__dirname, '..', 'scripts', 'release-readiness.mjs'),
  'utf8',
);

describe('it never leaks what it checks for', () => {
  it('reports presence, not values', () => {
    // A readiness report that prints the secret it is checking for is worse than
    // no report — it turns a status page into a credential dump.
    expect(script).toContain("Boolean((e[name] ?? '').trim())");
    expect(script).not.toMatch(/console\.log\([^)]*\$\{e\[[^\]]+\]\}/);
  });

  it('only ever prints the KEY PREFIX, to tell live from test', () => {
    expect(script).toMatch(/startsWith\('sk_live_'\) \? 'LIVE key'/);
  });
});

describe('it says which environment it inspected', () => {
  it('names the scope every run', () => {
    // ⚠️ It reads process.env + .env.local, i.e. wherever it RUNS. This repo
    // deliberately omits live payment secrets from .env.local so no local flow
    // can fire a real charge — so run on a laptop it reports those absent.
    // Without the scope line someone reads that as "production is broken".
    expect(script).toContain('const scope =');
    expect(script).toMatch(/Production secrets live in the deploy platform/);
  });
});

describe('it distinguishes a missing key from an unusable platform', () => {
  it('checks Stripe ACCOUNT STATE, not just that a key exists', () => {
    // The situation this repo is actually in: the key is present and valid, and
    // no connected account can receive a donation. A key-only check reports
    // ready.
    expect(script).toContain('stripe.accounts.list');
    expect(script).toMatch(/a\.charges_enabled && a\.payouts_enabled/);
  });

  it('treats "no payout-capable account" as blocking', () => {
    expect(script).toContain('const donationsPossible = stripeState.reachable && stripeState.payoutCapable > 0');
    expect(script).toContain('const blocked = missingBlocking.length > 0 || !donationsPossible');
  });

  it('explains what breaks, not just that something is missing', () => {
    expect(script).toMatch(/resolvePayoutDestination returns null and every donation 409s/);
  });
});

describe('it separates blocking from optional', () => {
  it('marks the payment and data path blocking', () => {
    for (const name of [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'SUPABASE_SERVICE_ROLE_KEY',
      'RESEND_API_KEY',
    ]) {
      expect(script).toMatch(new RegExp(`name: '${name}'[\\s\\S]{0,180}blocking: true`));
    }
  });

  it('marks feature flags optional rather than release-blocking', () => {
    // Conflating the two holds a release for a nice-to-have, or ships one
    // without a payout path.
    for (const name of ['ACCOUNT_SELF_DELETE_ENABLED', 'VAPID_PUBLIC_KEY', 'IOS_APP_ID']) {
      expect(script).toMatch(new RegExp(`name: '${name}'[\\s\\S]{0,180}blocking: false`));
    }
  });

  it('exits non-zero while anything blocking is unset, so it can gate a release', () => {
    expect(script).toContain('process.exit(blocked ? 1 : 0)');
  });
});
