import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// `/api/admin/ledger` is the surface whose entire job is to prove the books
// balance. Two defects made the number it reports drift away from reality, both
// in the direction of overstating what CharitMe owes:
//
//  1. A held-funds exception was INSERTED on every failure. Stripe redelivers
//     events and operators retry transfers, so one stuck debt opened two, three,
//     four exceptions — and the ledger reported the same money as outstanding
//     that many times over.
//
//  2. Nothing ever CLOSED an exception. When a later transfer succeeded the
//     organizer was paid and the exception stayed `open` forever, so the ledger
//     kept reporting settled debts as outstanding.
//
// An inflated liability is worse than a missing one on a reconciliation screen:
// a missing figure is visibly missing, while an inflated one looks like a number
// and makes the real figure unknowable.
// ─────────────────────────────────────────────────────────────────────────────

const webhook = readFileSync(
  path.join(__dirname, '..', 'app', 'api', 'stripe', 'webhook', 'route.ts'),
  'utf8',
);
const ledgerMigration = readFileSync(
  path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20260723001000_financial_ledger.sql'),
  'utf8',
);

describe('one debt opens one exception', () => {
  it('looks for an existing open exception before inserting', () => {
    expect(webhook).toMatch(/from\('reconciliation_exceptions'\)[\s\S]{0,220}\.eq\('status', 'open'\)/);
  });

  it('scopes that lookup to the session AND the campaign', () => {
    // Session alone would collapse every campaign in one portfolio gift into a
    // single exception, hiding all but one debt.
    const record = webhook.slice(webhook.indexOf('async function recordHeldFunds'));
    expect(record).toContain(".eq('stripe_ref', params.sessionId)");
    expect(record).toContain(".eq('campaign_id', params.campaignId)");
  });

  it('updates rather than duplicating when one is already open', () => {
    const record = webhook.slice(
      webhook.indexOf('async function recordHeldFunds'),
      webhook.indexOf('async function clearHeldFunds'),
    );
    expect(record).toMatch(/if \(open\?\.id\)/);
    expect(record).toContain('.update({ description })');
  });
});

describe('a settled debt is closed', () => {
  it('marks the exception resolved when the transfer succeeds', () => {
    expect(webhook).toContain('async function clearHeldFunds');
    const clear = webhook.slice(webhook.indexOf('async function clearHeldFunds'));
    expect(clear).toContain("status: 'resolved'");
    expect(clear).toContain('resolved_at:');
  });

  it('zeroes the difference so no amount-based sum keeps counting it', () => {
    const clear = webhook.slice(webhook.indexOf('async function clearHeldFunds'));
    expect(clear).toContain('difference_cents: 0');
  });

  it('only ever closes an OPEN row', () => {
    // ⚠️ Without this a redelivered event overwrites the original resolution
    // timestamp and transfer id, destroying the record of when the debt was
    // actually settled.
    const clear = webhook.slice(webhook.indexOf('async function clearHeldFunds'));
    expect(clear).toContain(".eq('status', 'open')");
  });

  it('is called from the success path, with the real transfer id', () => {
    expect(webhook).toMatch(/const transfer = await stripe\.transfers\.create\(/);
    expect(webhook).toMatch(/transferId: transfer\.id/);
  });
});

describe('neither may break the webhook', () => {
  it('both swallow their own failures', () => {
    // ⚠️ These run inside the Stripe webhook, whose return value decides
    // redelivery. Throwing from bookkeeping would make Stripe redeliver and
    // re-run transfers that already succeeded — paying an organizer twice to
    // fix a logging failure.
    for (const fn of ['recordHeldFunds', 'clearHeldFunds']) {
      const body = webhook.slice(webhook.indexOf(`async function ${fn}`));
      const firstCatch = body.indexOf('} catch (err) {');
      expect(firstCatch, `${fn} has no catch`).toBeGreaterThan(-1);
      expect(body.slice(firstCatch, firstCatch + 260)).toContain('console.error');
    }
  });
});

describe('the columns these writes rely on actually exist', () => {
  it('status, resolved_at and resolution_note are in the applied migration', () => {
    // A write to a column that does not exist fails at runtime, inside a catch
    // that swallows it — so the debt would silently never be recorded at all.
    for (const column of ['status', 'resolved_at', 'resolution_note', 'difference_cents', 'stripe_ref']) {
      expect(ledgerMigration, `${column} missing`).toMatch(new RegExp(`\\b${column}\\b`));
    }
  });

  it("'resolved' is a permitted status value", () => {
    expect(ledgerMigration).toMatch(/check \(status in \([^)]*'resolved'/);
  });
});
