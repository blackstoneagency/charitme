import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB_ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB_ROOT, p), 'utf8');

const REFUND = 'app/api/admin/donations/[id]/refund/route.ts';
const TAX_RECEIPT = 'app/api/admin/donations/tax-receipt/route.ts';
const FRAUD_MONITOR = 'app/api/ai/fraud-monitor/route.ts';
const IMPACT_SUMMARY = 'app/api/ai/impact-summary/route.ts';
const DONATIONS_CLIENT = 'app/admin/donations/_components/DonationsClient.tsx';
const STRIPE_WEBHOOK = 'app/api/stripe/webhook/route.ts';

// ─────────────────────────────────────────────────────────────────────────────
// A `await supabaseAdmin.from(x).insert(...)` with no destructuring cannot fail
// loudly: PostgREST resolves with `{ data: null, error }` rather than throwing,
// so the write is dropped and the handler carries on returning ok.
//
// Most of those sites are harmless usage logging. These four are not — each one
// runs AFTER an irreversible side effect (money refunded at Stripe, a tax
// document emailed to a donor, a fraud verdict reported to an admin), so a lost
// row leaves the platform's record disagreeing with what actually happened, with
// nobody told.
//
// The fix is deliberately NOT "return 500 on failure": the side effect already
// succeeded, and an error status invites the operator to retry it — which for
// the refund path means refunding a second time.
// ─────────────────────────────────────────────────────────────────────────────

describe('writes that follow an irreversible side effect capture their error', () => {
  it.each([
    [REFUND, /const \{ error: \w+ \} = await supabaseAdmin\.from\('refunds'\)\.update\(/],
    [TAX_RECEIPT, /const \{ error: \w+ \} = await supabaseAdmin\.from\('tax_receipts'\)\.upsert\(/],
    [FRAUD_MONITOR, /const \{ error: \w+ \} = await supabaseAdmin\.from\('risk_flags'\)\.insert\(/],
    [IMPACT_SUMMARY, /const \{ error: \w+ \} = await supabaseAdmin\.from\('risk_flags'\)\.insert\(/],
  ])('%s destructures the error', (path, pattern) => {
    expect(read(path), `${path} discards the result of a post-side-effect write`).toMatch(pattern);
  });

  // The ratchet: catches a future edit that reintroduces a bare awaited write to
  // any of these ledgers, including at a new call site in the same file.
  it.each([REFUND, TAX_RECEIPT, FRAUD_MONITOR, IMPACT_SUMMARY])(
    '%s has no bare awaited write to a ledger table',
    (path) => {
      const bare = read(path)
        .split('\n')
        .filter((l) => /^\s*await supabaseAdmin\s*$|^\s*await supabaseAdmin\.from\('(refunds|tax_receipts|risk_flags)'\)/.test(l));
      expect(bare, `${path} awaits a ledger write without checking it`).toEqual([]);
    },
  );
});

describe('every record_donation call can fail loudly', () => {
  // A Stripe webhook that returns 2xx tells Stripe "handled, do not retry". So
  // for the one call that records the money itself, swallowing the error is
  // permanent data loss: a charged donor with no donation row, no receipt, and
  // campaign totals that never moved. The one-time path already threw; the two
  // RECURRING paths (subscription checkout, invoice renewal) discarded the
  // result, so nothing ever retried them.
  //
  // Throwing is safe here specifically because `record_donation` is idempotent
  // on `p_stripe_event_id` — a Stripe retry cannot double-count.
  //
  // FOUR sites now: the portfolio path ("give once, fund many") records one
  // donation per campaign in a loop, and its failure semantics are the same —
  // the donor has paid, so a missing row must make Stripe retry rather than be
  // swallowed. The transfers that follow deliberately do NOT throw; see the
  // handler's header for why recording must be exactly-once while transferring
  // must be re-runnable.
  it('checks the error and throws at every site', () => {
    const src = read(STRIPE_WEBHOOK);
    const calls = [...src.matchAll(/\.rpc\('record_donation'/g)];
    expect(calls.length, 'call sites moved — re-check each one').toBe(4);

    // The one-time path destructures `{ data, error }`; the recurring ones only
    // need the error.
    const checked = [
      ...src.matchAll(/\{(?:\s*data,)?\s*error(?:: (\w+))? \} = await supabaseAdmin\.rpc\('record_donation'/g),
    ];
    expect(checked.length, 'a record_donation call discards its result').toBe(4);

    for (const [, alias] of checked) {
      const name = alias ?? 'error';
      expect(
        src,
        `${name} is captured but never turned into a non-2xx — Stripe will not retry`,
      ).toMatch(new RegExp(`if \\(${name}\\) throw new Error`));
    }
  });
});

describe('the caller is told when the record is missing', () => {
  it('the refund route reports ledger_recorded and warns against retrying', () => {
    const src = read(REFUND);
    expect(src).toMatch(/ledger_recorded: !\w+/);
    expect(src, 'a retry after a successful Stripe refund double-refunds').toMatch(/Do not retry/);
    // The response must stay 2xx — the money did move.
    const warn = src.indexOf('could not be written to the refunds ledger');
    expect(warn).toBeGreaterThan(-1);
    expect(src.slice(warn - 400, warn)).not.toMatch(/status: 5\d\d/);
  });

  it('the admin refund modal surfaces the warning instead of showing success', () => {
    const src = read(DONATIONS_CLIENT);
    const warn = src.indexOf('data.warning');
    const success = src.indexOf('onSuccess();');
    expect(warn).toBeGreaterThan(-1);
    expect(warn, 'the success path runs before the warning is checked').toBeLessThan(success);
  });

  it('the fraud scan reports whether its flags reached the review queue', () => {
    const src = read(FRAUD_MONITOR);
    expect(src).toMatch(/flagsPersisted/);
    // newFlagsCount is computed from the in-memory rows, so on its own it would
    // claim flags that were never saved.
    expect(src.indexOf('flagsPersisted,')).toBeGreaterThan(src.indexOf('newFlagsCount: newFlagRows.length,'));
  });

  it('the tax receipt route reports whether the receipt was recorded', () => {
    const src = read(TAX_RECEIPT);
    expect(src).toMatch(/recorded: !\w+/);
    expect(src, 're-sending would email the donor a second copy').toMatch(/Do not re-send/);
  });
});
