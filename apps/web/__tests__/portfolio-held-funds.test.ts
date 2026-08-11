import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webhook = readFileSync(join(here, '..', 'app/api/stripe/webhook/route.ts'), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio split gifts are WITHDRAWN — the checkout that created them is gone,
// so no new portfolio charge can ever land on CharitMe's balance.
//
// ⚠️ THIS FILE IS NOT OBSOLETE, AND THE HANDLER IT GUARDS MUST NOT BE DELETED
// WITH THE FEATURE. A Stripe Checkout Session lives ~24 hours. A donor who
// opened the portfolio checkout before the withdrawal shipped can still PAY
// after it. For those sessions the money behaves exactly as it always did: it
// lands on the platform balance and the webhook has to fan it out.
//
// So the two things that were load-bearing still are, for as long as one unpaid
// portfolio session could exist:
//
//   1. The webhook must record one donation per campaign and move the money.
//   2. When a transfer does not happen, the obligation must be RECORDED —
//      otherwise CharitMe is holding donor money with no record of whose it is.
//
// ⚠️ (2) was a `console.warn` and a `console.error`. The comment above them said
// the organizer "gets paid when they do [onboard]" and that "a transfer can be
// retried by an operator" — but nothing scheduled the payment, and the operator
// had only a log line. Money could sit on the platform balance indefinitely,
// invisible. That is the difference between briefly holding funds and holding
// them unaccountably. Withdrawing the feature does not settle the sessions
// already in flight; this does.
// ─────────────────────────────────────────────────────────────────────────────

describe('the portfolio checkout is withdrawn', () => {
  it('no route can create a new portfolio session', () => {
    expect(existsSync(join(here, '..', 'app/api/donations/portfolio/route.ts')),
      'the portfolio charge route is back — it puts donor money on the platform balance')
      .toBe(false);
  });

  it('the settle path survives the withdrawal', () => {
    // The asymmetry is the point: creating is gone, settling is not. Removing
    // both at once would strand any session paid after the deploy.
    expect(webhook).toMatch(/meta\.portfolio === '1'/);
    expect(webhook).toMatch(/handlePortfolioComplete/);
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
