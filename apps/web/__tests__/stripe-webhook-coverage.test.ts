import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// The webhook switch has no `default:` branch, so any event without a dispatch
// is dropped in total silence — no log, no error, no row. That is the quietest
// possible failure mode for money movement, which is why it gets a guard.
//
// Current state: coverage is COMPLETE. Every subscribed event is dispatched and
// every handler is reachable. This is a regression guard, not a bug report.
//
// Worth knowing if you touch it: `transfer.failed` is NOT a `case`. It is
// dispatched by an early `if ((event.type as string) === 'transfer.failed')`
// above the switch, because the SDK's typed event union for the pinned API
// version omits it. That is easy to miss by eye — reading only `case` labels
// makes `handleTransferFailed` look like dead code and the event look dropped,
// which is exactly the wrong conclusion this test's first draft reached.
//
// Two checks, because they fail for different reasons:
//   1. a handler exists but nothing dispatches to it
//   2. an event is subscribed in Stripe but nothing dispatches it
const SRC = readFileSync(
  path.join(__dirname, '..', 'app', 'api', 'stripe', 'webhook', 'route.ts'),
  'utf8',
);

/**
 * Every event the dispatcher actually routes — and it routes them in TWO shapes.
 *
 * Most are `case '…':` in the switch. But `transfer.failed` is dispatched by an
 * early `if ((event.type as string) === 'transfer.failed')` BEFORE the switch,
 * because the Stripe SDK's typed union for the pinned API version does not
 * include it, so a `case` would not typecheck. Reading only `case` labels
 * therefore reports transfer.failed as dropped when it is handled — a false
 * positive this test produced on its first run, and which briefly convinced me
 * the handler was dead code. Both forms count.
 */
const handledEvents = new Set([
  ...[...SRC.matchAll(/case\s+'([a-z_]+\.[a-z_.]+)'/g)].map((m) => m[1]),
  ...[...SRC.matchAll(/event\.type[^)]*\)?\s*===\s*'([a-z_]+\.[a-z_.]+)'/g)].map((m) => m[1]),
]);

/** `async function handleX(` declarations, minus the dispatcher itself. */
const declaredHandlers = [...SRC.matchAll(/^async function (handle\w+)\(/gm)]
  .map((m) => m[1])
  .filter((n) => n !== 'handleEvent');

// Snapshot of the LIVE endpoint's enabled_events, read from the Stripe API on
// 2026-07-27 (https://www.charitme.com/api/stripe/webhook, status: enabled).
// Hardcoded deliberately: a test must not depend on network or on a secret key.
// If the endpoint's subscriptions change, update this list in the same commit.
const SUBSCRIBED_EVENTS = [
  'transfer.failed', 'checkout.session.completed', 'invoice.payment_succeeded',
  'invoice.payment_failed', 'payment_intent.succeeded', 'payment_intent.payment_failed',
  'charge.succeeded', 'charge.updated', 'charge.refunded', 'charge.dispute.created',
  'charge.dispute.closed', 'customer.subscription.created', 'customer.subscription.updated',
  'customer.subscription.deleted', 'account.updated', 'transfer.created',
  'application_fee.created', 'payout.created', 'payout.paid', 'payout.failed',
];

// Subscribed events that are deliberately not dispatched, with the reason.
// Anything here is a claim that the state is maintained elsewhere — so it needs
// to name where, not just assert that it is fine.
const INTENTIONALLY_UNHANDLED = new Map([
  [
    'customer.subscription.created',
    'checkout.session.completed already sets plan + stripe_customer_id + ' +
      'stripe_subscription_id for a platform subscription (handleCheckoutComplete, ' +
      'the `meta.plan && meta.userId` branch), so dispatching .created would be a ' +
      'redundant second write of the same fields.',
  ],
]);

describe('stripe webhook event coverage', () => {
  it('parses the switch and the handlers (guards against a vacuous pass)', () => {
    expect(handledEvents.size).toBeGreaterThan(15);
    expect(declaredHandlers.length).toBeGreaterThan(10);
  });

  it('dispatches to every handler that exists', () => {
    // A handler is reachable if it is called somewhere other than its own
    // declaration — in practice, from the switch.
    const unreachable = declaredHandlers.filter((name) => {
      const calls = [...SRC.matchAll(new RegExp(`\\b${name}\\s*\\(`, 'g'))];
      return calls.length < 2; // declaration only
    });
    expect(
      unreachable,
      'These webhook handlers are written but nothing calls them. The switch has ' +
        'no default branch, so the events they were written for are being dropped ' +
        'silently:\n  ' +
        unreachable.join('\n  '),
    ).toEqual([]);
  });

  it('handles every event the live endpoint subscribes to', () => {
    const dropped = SUBSCRIBED_EVENTS.filter(
      (e) => !handledEvents.has(e) && !INTENTIONALLY_UNHANDLED.has(e),
    );
    expect(
      dropped,
      'Stripe is configured to deliver these events and the switch has no case ' +
        'for them, so they are received and discarded without a trace. Either add ' +
        'a case, or unsubscribe the event in Stripe and record why in ' +
        'INTENTIONALLY_UNHANDLED:\n  ' +
        dropped.join('\n  '),
    ).toEqual([]);
  });

  it('does not claim a case for an event nobody sends', () => {
    // The mirror problem: a case for an event the endpoint does not subscribe
    // to is dead code that reads as working coverage.
    const neverDelivered = [...handledEvents].filter((e) => !SUBSCRIBED_EVENTS.includes(e));
    expect(
      neverDelivered,
      'The switch handles these, but the live endpoint does not subscribe to them, ' +
        'so they never arrive:\n  ' + neverDelivered.join('\n  '),
    ).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The dispatch switch had no `default:`.
//
// Stripe delivers whatever the Dashboard subscribes to, and that list changes
// independently of this file — this endpoint went from 2 subscribed events to
// 20 in a single sitting. An event with no `case` was dropped in total silence:
// no log, no error, no row, and a 200 back to Stripe, so it never retried and
// nothing showed as failed in the delivery log either. The damage surfaces much
// later as a data inconsistency with nothing tying it back to the missed event.
// ─────────────────────────────────────────────────────────────────────────────
describe('an unsubscribed-for event cannot vanish silently', () => {
  const src = readFileSync(
    path.join(__dirname, '..', 'app/api/stripe/webhook/route.ts'),
    'utf8',
  );

  it('has a default branch on the event dispatch', () => {
    expect(src).toMatch(/\n\s*default:/);
  });

  it('logs the event type and id, so the gap is diagnosable', () => {
    // "something was dropped" is not actionable without knowing what.
    expect(src).toMatch(/no handler for event type/);
    expect(src).toMatch(/type: event\.type/);
    expect(src).toMatch(/id: event\.id/);
  });

  it('does not throw on an unhandled event', () => {
    // Throwing would make Stripe retry every newly-subscribed event forever.
    const defaultBlock = src.slice(src.search(/\n\s*default:/));
    const untilBreak = defaultBlock.slice(0, defaultBlock.indexOf('break;'));
    expect(untilBreak).not.toMatch(/\bthrow\b/);
    expect(untilBreak).not.toMatch(/status:\s*(4|5)\d\d/);
  });
});
