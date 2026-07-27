import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCurrent } from '../lib/entitlements';

// ─────────────────────────────────────────────────────────────────────────────
// Entitlements never expired.
//
// `getUserEntitlements` SELECTed `current_period_end` and then dropped it, and
// `resolveEntitlements(plan, status)` takes no date at all — so a subscription
// row left at `status='active'` granted paid features **indefinitely**.
//
// Status is normally corrected by the Stripe webhook. That is exactly the
// mechanism that failed here: this project's webhook was configured with 2 of the
// needed 20 events until earlier today, which is how a
// `customer.subscription.deleted` goes missing and a cancelled plan keeps paying
// out features.
//
// Latent, not live: 500 subscription rows in production (350 active, 50 trialing,
// 50 cancelled, 50 past_due) and **0 entitled rows with a period end in the past**.
//
// The check is deliberately conservative — a missing or unparseable date counts as
// current, so a data gap can never revoke access from someone who is paying.
// ─────────────────────────────────────────────────────────────────────────────

const NOW = new Date('2026-07-26T12:00:00Z');
const past = '2026-06-01T00:00:00Z';
const future = '2026-12-01T00:00:00Z';

describe('isCurrent requires an entitling status', () => {
  it('accepts the two in-good-standing statuses', () => {
    expect(isCurrent({ status: 'active', current_period_end: future }, NOW)).toBe(true);
    expect(isCurrent({ status: 'trialing', current_period_end: future }, NOW)).toBe(true);
  });

  it('rejects every other status regardless of date', () => {
    for (const status of ['cancelled', 'past_due', 'incomplete', 'unpaid', 'paused', '', null, undefined]) {
      expect(isCurrent({ status, current_period_end: future }, NOW), String(status)).toBe(false);
    }
  });
});

describe('isCurrent expires a lapsed period', () => {
  it('revokes when the period has demonstrably passed', () => {
    // The defect: this used to remain fully entitled.
    expect(isCurrent({ status: 'active', current_period_end: past }, NOW)).toBe(false);
    expect(isCurrent({ status: 'trialing', current_period_end: past }, NOW)).toBe(false);
  });

  it('keeps access right up to the boundary', () => {
    const end = '2026-07-26T12:00:01Z';
    expect(isCurrent({ status: 'active', current_period_end: end }, NOW)).toBe(true);
  });

  it('treats the exact instant of expiry as ended', () => {
    expect(isCurrent({ status: 'active', current_period_end: NOW.toISOString() }, NOW)).toBe(false);
  });
});

describe('isCurrent never revokes on a data gap', () => {
  it('a missing period end stays entitled', () => {
    // Someone paying must not lose access because a column is null.
    expect(isCurrent({ status: 'active' }, NOW)).toBe(true);
    expect(isCurrent({ status: 'active', current_period_end: null }, NOW)).toBe(true);
  });

  it('an unparseable date stays entitled', () => {
    for (const bad of ['', 'not-a-date', 'soon']) {
      expect(isCurrent({ status: 'active', current_period_end: bad }, NOW), bad).toBe(true);
    }
  });
});

describe('the resolver actually consults it', () => {
  const src = readFileSync(join(__dirname, '../lib/entitlements.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');

  it('picks a subscription via isCurrent, not a bare status check', () => {
    expect(src).toMatch(/rows\.find\(\(r\) => isCurrent\(r\)\)/);
    // The old shape ignored the period end entirely.
    expect(src).not.toMatch(/r\.status === 'active' \|\| r\.status === 'trialing'\)\s*\?\?\s*rows\[0\]/);
  });

  it('does not resolve a lapsed row as its stored status', () => {
    expect(src).toMatch(/isCurrent\(best\) \? best\.status : 'expired'/);
  });
});
