import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// A match claim commits the SPONSOR'S money, up to an annual cap they agreed to.
//
// `reservedMatchForEmployee` dropped its `error`, so `data ?? []` made a failed
// read return **0 used** — identical to an employee who has claimed nothing all
// year. That flows straight into the amount written on the claim:
//
//     remaining   = remainingCap(annual_cap_cents, used)   // = the FULL cap
//     matchAmount = computeMatchAmount({ remainingCapCents: remaining, … })
//
// so a database blip lets a claim be created as though the cap were untouched,
// and the employer's agreed limit is exceeded.
//
// `listEmployeeClaims`, directly below it in the same file, already used
// `boundedQuery`. One guarded read and one unguarded read in one file is the
// same tell as the refund route.
// ─────────────────────────────────────────────────────────────────────────────

const READ_ERROR = { message: 'connection terminated', code: '08006' };
const USER = { id: 'employee-1' };

let byTable: Record<string, { data: unknown; error: { message: string; code?: string } | null }> = {};

function chain(table: string) {
  const result = byTable[table] ?? { data: [], error: null };
  const target: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return new Proxy(target, {
    get(t, prop) {
      if (prop === 'then') return t.then;
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve(result);
      return () => chain(table);
    },
  });
}

vi.mock('../lib/supabase', () => ({ supabaseAdmin: { from: (t: string) => chain(t) } }));
vi.mock('../lib/supabase-server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: USER } }) } }),
}));

beforeEach(() => {
  vi.resetModules();
  byTable = {};
});

describe('an unreadable cap never reads as "nothing claimed yet"', () => {
  it('throws instead of returning 0 used', async () => {
    byTable.matching_claims = { data: null, error: READ_ERROR };
    const { reservedMatchForEmployee, MatchCapUnavailableError } = await import('../lib/matching');

    await expect(
      reservedMatchForEmployee('prog-1', USER.id),
      'returning 0 here spends the full annual cap',
    ).rejects.toBeInstanceOf(MatchCapUnavailableError);
  });

  it('still returns 0 when the employee genuinely has no claims', async () => {
    // The distinction is the whole fix: an empty list is a real answer.
    byTable.matching_claims = { data: [], error: null };
    const { reservedMatchForEmployee } = await import('../lib/matching');

    await expect(reservedMatchForEmployee('prog-1', USER.id)).resolves.toBe(0);
  });

  it('sums only the claims that reserve cap', async () => {
    // Guards the guard: the error branch must not have changed the arithmetic.
    byTable.matching_claims = {
      // `reservesCap` counts 'approved' and 'paid' ONLY — I first asserted that
      // 'pending' reserved too, and the code corrected me.
      data: [
        { match_amount_cents: 5000, status: 'approved' },
        { match_amount_cents: 2000, status: 'paid' },
        { match_amount_cents: 3000, status: 'pending' },
        { match_amount_cents: 9999, status: 'declined' },
      ],
      error: null,
    };
    const { reservedMatchForEmployee } = await import('../lib/matching');

    const used = await reservedMatchForEmployee('prog-1', USER.id);
    expect(used, 'only approved + paid reserve cap').toBe(7000);
  });
});

describe('the claim route refuses rather than over-committing', () => {
  const PROGRAM_ID = '11111111-1111-4111-8111-111111111111';
  const PROGRAM = {
    sponsor_id: 'sponsor-1',
    status: 'active',
    match_ratio: 1,
    annual_cap_cents: 100_000,
    min_donation_cents: 0,
    categories: null,
    company_name: 'Acme',
    currency: 'usd',
  };

  function post(body: Record<string, unknown>) {
    return new Request('http://localhost/api/matching/claims', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as never;
  }

  it('answers 503 when the cap usage cannot be read', async () => {
    byTable.matching_programs = { data: PROGRAM, error: null };
    byTable.matching_claims = { data: null, error: READ_ERROR };
    const { POST } = await import('../app/api/matching/claims/route');

    const res = await POST(post({ program_id: PROGRAM_ID, donation_amount_cents: 5000 }));

    expect(res.status, 'a claim must not be written against an unknown cap').toBe(503);
    expect((await res.json()).code).toBe('MATCH_CAP_UNAVAILABLE');
  });

  it('does not write a claim on that path', async () => {
    // The status code matters less than this: nothing may be committed.
    const inserted: string[] = [];
    byTable.matching_programs = { data: PROGRAM, error: null };
    byTable.matching_claims = { data: null, error: READ_ERROR };
    vi.doMock('../lib/supabase', () => ({
      supabaseAdmin: {
        from: (t: string) => {
          const c = chain(t) as Record<string, unknown>;
          return new Proxy(c, {
            get(target, prop) {
              if (prop === 'insert') return () => { inserted.push(t); return chain(t); };
              return Reflect.get(target, prop);
            },
          });
        },
      },
    }));
    const { POST } = await import('../app/api/matching/claims/route');

    await POST(post({ program_id: PROGRAM_ID, donation_amount_cents: 5000 }));

    expect(inserted, 'no claim row may be written when the cap is unknown').toEqual([]);
  });
});
