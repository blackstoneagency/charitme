import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webhook = readFileSync(join(here, '..', 'app/api/stripe/webhook/route.ts'), 'utf8');
const portfolio = readFileSync(join(here, '..', 'app/api/donations/portfolio/route.ts'), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// "CharitMe never holds donation funds" is true of every route EXCEPT portfolio
// gifts, and that exception is forced rather than chosen: Stripe's
// `transfer_data.destination` takes exactly ONE connected account, and a
// portfolio gift splits across several campaigns. So the charge lands on the
// platform balance and the webhook fans it out.
//
// That makes two things load-bearing:
//
//   1. The route must refuse to charge at all unless EVERY campaign can be paid,
//      so the fan-out has a destination for each line.
//   2. When a transfer still does not happen, the obligation must be RECORDED —
//      otherwise CharitMe is holding donor money with no record of whose it is.
//
// ⚠️ (2) was a `console.warn` and a `console.error`. The comment above them said
// the organizer "gets paid when they do [onboard]" and that "a transfer can be
// retried by an operator" — but nothing scheduled the payment, and the operator
// had only a log line. Money could sit on the platform balance indefinitely,
// invisible. That is the difference between briefly holding funds and holding
// them unaccountably.
// ─────────────────────────────────────────────────────────────────────────────

describe('portfolio refuses to charge money it cannot route', () => {
  it('checks payout readiness for EVERY campaign before charging', () => {
    expect(portfolio).toMatch(/campaigns\.map\(\(campaign\) => resolvePayoutDestination\(campaign\)\)/);
    expect(portfolio).toMatch(/PAYOUT_NOT_READY/);
  });

  it('declines rather than guessing when readiness cannot be determined', () => {
    // Same rule as /api/donations: "could not check" is not "not set up".
    expect(portfolio).toMatch(/PayoutLookupUnavailableError/);
    expect(portfolio).toMatch(/PAYOUT_LOOKUP_UNAVAILABLE/);
  });
});

describe('funds CharitMe ends up holding are recorded, not just logged', () => {
  it('records an exception when the recipient has no connected account', () => {
    const deferred = webhook.slice(webhook.indexOf('portfolio transfer deferred'));
    const untilContinue = deferred.slice(0, deferred.indexOf('continue;'));
    expect(untilContinue, 'a deferred transfer must leave a durable record')
      .toMatch(/recordHeldFunds\(/);
  });

  it('records an exception when the transfer itself fails', () => {
    const failed = webhook.slice(webhook.indexOf('portfolio transfer failed'));
    const untilClose = failed.slice(0, failed.indexOf('\n    }'));
    expect(untilClose).toMatch(/recordHeldFunds\(/);
  });

  it('writes to reconciliation_exceptions, which is already read and swept', () => {
    // Not a new table: /api/admin/ledger lists these and the reconcile-ledger
    // cron sweeps them, so the obligation surfaces where money problems are
    // already handled rather than in a place nobody looks.
    const fn = webhook.slice(webhook.indexOf('async function recordHeldFunds'));
    const body = fn.slice(0, fn.indexOf('\nasync function handlePortfolioComplete'));
    expect(body).toMatch(/from\('reconciliation_exceptions'\)/);
    expect(body).toMatch(/kind: 'payout_mismatch'/);
  });

  it('records WHO is owed and HOW MUCH, not just that something failed', () => {
    const fn = webhook.slice(webhook.indexOf('async function recordHeldFunds'));
    const body = fn.slice(0, fn.indexOf('\nasync function handlePortfolioComplete'));
    expect(body).toMatch(/campaign_id: params\.campaignId/);
    expect(body).toMatch(/expected_cents: params\.amountCents/);
    // The Stripe session, so the held money can be traced to the actual charge.
    expect(body).toMatch(/stripe_ref: params\.sessionId/);
  });

  it('never throws while recording — that would re-run succeeded transfers', () => {
    // ⚠️ The subtle one. Throwing here makes Stripe redeliver the whole event,
    // which re-runs the transfer loop. Recording a problem must not be able to
    // cause a double payment.
    const fn = webhook.slice(webhook.indexOf('async function recordHeldFunds'));
    const body = fn.slice(0, fn.indexOf('\nasync function handlePortfolioComplete'));
    expect(body).toMatch(/try \{/);
    expect(body).toMatch(/catch \(err\) \{/);
    expect(body, 'recordHeldFunds must swallow its own failure').not.toMatch(/throw /);
  });

  it('keeps the transfer loop non-throwing overall', () => {
    // Recording must be exactly-once (it throws so Stripe retries); transferring
    // must be re-runnable (it does not). That split is why a transfer failure is
    // caught rather than rethrown, and it must survive this change.
    const loop = webhook.slice(webhook.indexOf('  // Fan out.'));
    const end = loop.indexOf('\n}');
    expect(loop.slice(0, end)).not.toMatch(/throw new Error/);
  });
});
