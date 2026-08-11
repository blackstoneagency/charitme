import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// `lib/trust-signals.ts` — the last security/money-adjacent module with no
// behavioural test, per todo.md.
//
// ⚠️ It LOOKED covered. `__tests__/trust-risk-signal.test.ts` mentions this file,
// but only `readFileSync`s it as SOURCE TEXT; the function it exercises,
// `calculateTrustScore`, lives in another module. `buildCampaignTrustInput` had
// never actually been executed by a test.
//
// This matters because the output feeds the CharitScore shown publicly on a
// campaign page — the number a donor uses to decide whether to send money.
//
// The module is `server-only` and hits seven tables, so every test here runs it
// against a recording stub: each `.from(table)` returns a chained builder that
// records its filters and resolves to whatever that table was scripted to
// return. That executes the real control flow rather than asserting on strings.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}));

type TableResult = { data?: unknown; count?: number | null; error?: unknown };
type Filter = [string, unknown];

const scripted = vi.hoisted(() => ({
  byTable: {} as Record<string, TableResult>,
  filters: {} as Record<string, Filter[]>,
}));

vi.mock('../lib/supabase', () => {
  function builder(table: string) {
    const result = () => scripted.byTable[table] ?? { data: null, count: 0, error: null };
    const record = (op: string, args: unknown[]) => {
      (scripted.filters[table] ??= []).push([op, args]);
    };
    const chain: Record<string, unknown> = {
      // `maybeSingle()` resolves; `.select(..., {head:true})` is awaited directly,
      // so the builder must be thenable as well.
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      maybeSingle: () => Promise.resolve(result()),
    };
    return new Proxy(chain, {
      get(t, prop) {
        if (prop === 'then' || prop === 'maybeSingle') return t[prop as string];
        if (typeof prop === 'symbol') return undefined;
        return (...args: unknown[]) => {
          record(String(prop), args);
          return builder(table);
        };
      },
    });
  }
  return { supabaseAdmin: { from: (table: string) => builder(table) } };
});

const { buildCampaignTrustInput } = await import('../lib/trust-signals');

const CAMPAIGN = {
  id: 'campaign-1',
  user_id: 'organizer-1',
  trust_status: 'Verified',
};

beforeEach(() => {
  scripted.byTable = {};
  scripted.filters = {};
});

/** Every filter applied to a table, as `op` → list of argument tuples. */
function filtersFor(table: string): Filter[] {
  return scripted.filters[table] ?? [];
}

function argsOf(table: string, op: string): unknown[][] {
  return filtersFor(table).filter(([o]) => o === op).map(([, a]) => a as unknown[]);
}

describe('a failed risk read is "unknown", never "no risk flags"', () => {
  it('reports risk_signal_unavailable and a null count when the query errors', async () => {
    // ⚠️ The defect this replaced: `riskRes.count ?? 0` gave a campaign with open
    // flags a clean bill of health whenever the query failed. The score deducts
    // up to 24 points for flags — enough to move a campaign from red/amber into
    // GREEN on the public page. Production held 560 open/reviewing flags at the
    // time, so "assume clean" is the wrong default for a trust-and-safety signal.
    scripted.byTable.risk_flags = { count: null, error: { message: 'timeout' } };

    const out = await buildCampaignTrustInput(CAMPAIGN);

    expect(out.risk_signal_unavailable).toBe(true);
    expect(out.risk_flag_count, 'a null count must not become 0').toBeNull();
  });

  it('treats a null count with no error as unavailable too', async () => {
    // PostgREST can answer without an error and without a count. That is still
    // "we do not know", not "zero".
    scripted.byTable.risk_flags = { count: null, error: null };

    const out = await buildCampaignTrustInput(CAMPAIGN);

    expect(out.risk_signal_unavailable).toBe(true);
    expect(out.risk_flag_count).toBeNull();
  });

  it('reports a real zero as a MEASURED zero', async () => {
    // The other direction, and it matters just as much: if 0 were reported as
    // unavailable, a genuinely clean campaign would be penalised forever.
    scripted.byTable.risk_flags = { count: 0, error: null };

    const out = await buildCampaignTrustInput(CAMPAIGN);

    expect(out.risk_signal_unavailable).toBe(false);
    expect(out.risk_flag_count).toBe(0);
  });

  it('passes a real flag count through', async () => {
    scripted.byTable.risk_flags = { count: 3, error: null };

    const out = await buildCampaignTrustInput(CAMPAIGN);

    expect(out.risk_signal_unavailable).toBe(false);
    expect(out.risk_flag_count).toBe(3);
  });
});

describe('the prior-campaign count is a PUBLIC signal', () => {
  it('excludes private and soft-deleted campaigns, and the campaign itself', async () => {
    // ⚠️ It once counted every row the organiser owned, including their private
    // and soft-deleted campaigns: an inflated trust number AND a leak of how
    // many private campaigns someone has.
    await buildCampaignTrustInput(CAMPAIGN);

    const eq = argsOf('campaigns', 'eq');
    expect(eq).toContainEqual(['user_id', 'organizer-1']);
    expect(eq, 'private/unlisted campaigns must not inflate a public trust signal')
      .toContainEqual(['visibility', 'public']);
    expect(argsOf('campaigns', 'is')).toContainEqual(['deleted_at', null]);
    expect(argsOf('campaigns', 'neq'), 'a campaign must not count itself')
      .toContainEqual(['id', 'campaign-1']);
  });

  it('uses eq(public), NOT neq(private) — they are different questions', async () => {
    // The detail-page fetch uses `neq('private')` so an UNLISTED campaign still
    // resolves from a direct link. This is an AGGREGATE over other campaigns,
    // where 'unlisted' is by definition not something to advertise.
    await buildCampaignTrustInput(CAMPAIGN);

    expect(argsOf('campaigns', 'neq')).not.toContainEqual(['visibility', 'private']);
  });

  it('counts only approved evidence from the ledger', async () => {
    await buildCampaignTrustInput(CAMPAIGN);

    const inFilters = argsOf('transparency_ledger_items', 'in');
    expect(inFilters).toContainEqual(['review_status', ['auto_approved', 'approved']]);
  });

  it('counts only open or reviewing risk flags', async () => {
    await buildCampaignTrustInput(CAMPAIGN);

    expect(argsOf('risk_flags', 'in')).toContainEqual(['status', ['open', 'reviewing']]);
  });
});

describe('beneficiary verification falls back to the organizer only when they are the same person', () => {
  it('does NOT query a second profile when the organizer is the beneficiary', async () => {
    scripted.byTable.profiles = { data: { identity_verified: true, created_at: null } };

    const out = await buildCampaignTrustInput(CAMPAIGN);

    // One profile lookup, not two — the self-beneficiary shortcut.
    expect(argsOf('profiles', 'eq')).toEqual([['id', 'organizer-1']]);
    expect(out.beneficiary_verified, "the organizer's own verification carries over").toBe(true);
  });

  it('queries the beneficiary separately when they are a different person', async () => {
    scripted.byTable.profiles = { data: { identity_verified: false, created_at: null } };

    const out = await buildCampaignTrustInput({ ...CAMPAIGN, beneficiary_profile_id: 'beneficiary-9' });

    const ids = argsOf('profiles', 'eq').map(([, v]) => v);
    expect(ids).toContain('organizer-1');
    expect(ids).toContain('beneficiary-9');
    // The stub returns the same row for both, so this asserts the wiring rather
    // than a distinct value; the point is that a SECOND lookup happens at all.
    expect(out.beneficiary_verified).toBe(false);
  });

  it('an unverified organizer does not make a separate beneficiary verified', async () => {
    scripted.byTable.profiles = { data: { identity_verified: false, created_at: null } };

    const out = await buildCampaignTrustInput({ ...CAMPAIGN, beneficiary_profile_id: 'beneficiary-9' });

    expect(out.identity_verified).toBe(false);
    expect(out.beneficiary_verified).toBe(false);
  });
});

describe('derived scalars', () => {
  it('sums evidence from the ledger AND campaign media', async () => {
    scripted.byTable.transparency_ledger_items = { count: 2, error: null };
    scripted.byTable.campaign_media = { count: 5, error: null };

    const out = await buildCampaignTrustInput(CAMPAIGN);

    expect(out.evidence_count).toBe(7);
  });

  it('treats a missing evidence count as zero, which is safe here', async () => {
    // Unlike risk flags, absent evidence understates trust rather than
    // overstating it — failing toward a LOWER score is the safe direction.
    scripted.byTable.transparency_ledger_items = { count: null, error: null };
    scripted.byTable.campaign_media = { count: null, error: null };

    const out = await buildCampaignTrustInput(CAMPAIGN);

    expect(out.evidence_count).toBe(0);
  });

  it('computes account age in whole days and never goes negative', async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    scripted.byTable.profiles = { data: { identity_verified: true, created_at: tenDaysAgo } };
    expect((await buildCampaignTrustInput(CAMPAIGN)).account_age_days).toBe(10);

    // A clock skew that puts creation in the future must floor at 0, not report
    // a negative age into the scorer.
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
    scripted.byTable.profiles = { data: { identity_verified: true, created_at: future } };
    expect((await buildCampaignTrustInput(CAMPAIGN)).account_age_days).toBe(0);
  });

  it('reports age 0 when the profile is missing entirely', async () => {
    scripted.byTable.profiles = { data: null };

    const out = await buildCampaignTrustInput(CAMPAIGN);

    expect(out.account_age_days).toBe(0);
    expect(out.identity_verified).toBe(false);
    expect(out.stripe_onboarded).toBe(false);
  });

  it('marks admin_review_status approved ONLY for a Verified trust_status', async () => {
    expect((await buildCampaignTrustInput(CAMPAIGN)).admin_review_status).toBe('approved');

    for (const status of ['Trusted', 'Under Review', 'Flagged', null, undefined]) {
      const out = await buildCampaignTrustInput({ ...CAMPAIGN, trust_status: status as string | null });
      expect(out.admin_review_status, `trust_status=${status}`).toBeUndefined();
    }
  });

  it('reads stripe_onboarded from payouts_enabled, not merely from a row existing', async () => {
    scripted.byTable.connected_accounts = { data: { payouts_enabled: false } };
    expect((await buildCampaignTrustInput(CAMPAIGN)).stripe_onboarded).toBe(false);

    scripted.byTable.connected_accounts = { data: { payouts_enabled: true } };
    expect((await buildCampaignTrustInput(CAMPAIGN)).stripe_onboarded).toBe(true);
  });
});

describe('campaign fields pass through untouched', () => {
  it('forwards the row values the scorer reads', async () => {
    const out = await buildCampaignTrustInput({
      ...CAMPAIGN,
      cover_image_url: 'https://example.test/c.jpg',
      tagline: 'a tagline',
      description: 'a description',
      deadline: '2030-01-01',
      raised_amount: 1_234,
      goal_amount: 10_000,
      backer_count: 7,
      status: 'active',
    });

    expect(out.cover_image_url).toBe('https://example.test/c.jpg');
    expect(out.tagline).toBe('a tagline');
    expect(out.description).toBe('a description');
    expect(out.deadline).toBe('2030-01-01');
    expect(out.raised_amount).toBe(1_234);
    expect(out.goal_amount).toBe(10_000);
    expect(out.backer_count).toBe(7);
    expect(out.status).toBe('active');
  });
});
