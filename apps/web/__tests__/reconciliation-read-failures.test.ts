import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// The reconciliation job exists to notice money going missing. Every read in it
// dropped its `error`, and each one failed in a DIFFERENT wrong direction:
//
//   donations        → rows = [] → `{ checked: 0, findings: [] }` returned, and
//                      the cron route wraps that in `{ ok: true }`. A CLEAN BILL
//                      OF HEALTH, produced while completely blind.
//   ledger_entries   → `?? []` → every donation observed with no ledger
//                      footprint → a `missing` exception opened for EVERY
//                      donation in the window, up to 2000 false alarms per run.
//   open exceptions  → `?? []` → de-dupe set empty → every exception re-opened
//                      on every run, defeating the documented idempotency.
//   listExceptions   → `[]` → the admin screen renders an EMPTY QUEUE, i.e.
//                      "no outstanding discrepancies".
//   getExceptionStatus → null → the caller answers 404 "Not found".
//
// Tested behaviourally rather than by reading the source: these assert what the
// function DOES when the database refuses, which is the only thing that matters
// here. `server-only` is stubbed by vitest.config, and `lib/supabase` is mocked
// below, so no network or credentials are involved.
// ─────────────────────────────────────────────────────────────────────────────

const READ_ERROR = { message: 'connection terminated', code: '08006' };

/** A thenable query builder that resolves to a Supabase-shaped failure. */
function failingQuery() {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gte', 'in', 'order', 'limit', 'is', 'not']) {
    q[m] = () => q;
  }
  q.maybeSingle = () => Promise.resolve({ data: null, error: READ_ERROR });
  q.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: READ_ERROR });
  return q;
}

const from = vi.fn((_table: string) => failingQuery());
vi.mock('../lib/supabase', () => ({ supabaseAdmin: { from: (table: string) => from(table) } }));

describe('reconciliation never reports a failed read as a result', () => {
  beforeEach(() => from.mockClear());

  it('does NOT return a clean bill of health when donations cannot be read', async () => {
    const { runReconciliation } = await import('../lib/reconciliation');
    // The defect: this used to resolve to { checked: 0, clean: 0, findings: [] },
    // which the cron route reports as { ok: true }.
    await expect(runReconciliation(2)).rejects.toThrow(/donations read failed/);
    // Guards the guard, asserted HERE rather than in its own `it`: a separate
    // test runs after beforeEach clears the mock and calls nothing itself, so it
    // measured nothing. It failed on first run, which is how that surfaced.
    expect(from, 'the database layer was never reached').toHaveBeenCalledWith('donations');
  });

  it('does NOT show an empty exception queue when the list cannot be read', async () => {
    const { listExceptions } = await import('../lib/reconciliation');
    await expect(listExceptions('open')).rejects.toThrow(/exception list read failed/);
  });

  it('does NOT report an exception as missing when its status cannot be read', async () => {
    const { getExceptionStatus } = await import('../lib/reconciliation');
    // Returning null here becomes a 404 "Not found" in
    // /api/admin/reconciliation/[id] — a claim about the row, from a failed read.
    await expect(getExceptionStatus('any-id')).rejects.toThrow(/exception status read failed/);
  });
});

// The ledger and open-exception reads sit AFTER the donations read, so the
// all-failing mock above can never reach them — the first throw wins. These two
// use a mock that succeeds for donations and fails only for the later table,
// which is the only way to prove each guard independently.
describe('the later reads are guarded independently', () => {
  const DONATION_ROW = {
    id: 'd1',
    campaign_id: 'c1',
    amount_cents: 1000,
    tip_cents: 0,
    processing_fee_cents: 59,
  };

  /** Succeeds for every table except `failTable`. */
  function selectiveClient(failTable: string) {
    return {
      from: (table: string) => {
        const fails = table === failTable;
        const result = fails
          ? { data: null, error: READ_ERROR }
          : { data: table === 'donations' ? [DONATION_ROW] : [], error: null };
        const q: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'gte', 'in', 'order', 'limit', 'is', 'not']) {
          q[m] = () => q;
        }
        q.maybeSingle = () => Promise.resolve(result);
        q.insert = () => Promise.resolve({ error: null });
        q.then = (resolve: (v: unknown) => unknown) => resolve(result);
        return q;
      },
    };
  }

  it('throws when the LEDGER read fails, instead of flagging every donation', async () => {
    vi.resetModules();
    vi.doMock('../lib/supabase', () => ({ supabaseAdmin: selectiveClient('ledger_entries') }));
    const { runReconciliation } = await import('../lib/reconciliation');
    await expect(runReconciliation(2)).rejects.toThrow(/ledger read failed/);
  });

  it('throws when the OPEN-EXCEPTION read fails, instead of disabling de-dupe', async () => {
    vi.resetModules();
    vi.doMock('../lib/supabase', () => ({
      supabaseAdmin: selectiveClient('reconciliation_exceptions'),
    }));
    const { runReconciliation } = await import('../lib/reconciliation');
    await expect(runReconciliation(2)).rejects.toThrow(/open-exception read failed/);
  });
});
