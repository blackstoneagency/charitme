import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Campaign detail existence gate (soft-404 fix) + missing-vs-unavailable.
//
// `/campaigns/[slug]` used to answer HTTP 200 for a missing campaign: its
// `loading.tsx` opens a Suspense boundary, so Next streams the shell and commits
// the status before the page body — and the page's `notFound()` then renders the
// right UI but can't change it. The fix moves the check into a segment layout,
// which renders outside that boundary.
//
// This test pins the gate's DECISION, which is the half a local build cannot
// verify: the sandbox has no database (every lookup is null, so everything
// 404s) and the Vercel preview is behind deployment protection. So "missing →
// 404" is verifiable by curl, but "real campaign → renders" was otherwise only
// reasoning. It sits on the donation path, so the reasoning gets a test.
//
// ⚠️ The gate now distinguishes MISSING from UNAVAILABLE, and the distinction is
// the point. Previously any falsy `data` meant 404 — including the `data: null`
// that comes back when the database is unreachable, when the query times out, or
// when `supabaseAdmin`'s Proxy throws for want of env vars. That told donors a
// live fundraiser did not exist, as a cacheable, shareable, indexable claim,
// because of a transient outage. Only a genuine "no such row" may 404.
//
// This is also why the query is `.maybeSingle()` and not `.single()`:
// `.single()` reports zero rows as an ERROR, which under the new rule is
// indistinguishable from an outage. `.maybeSingle()` returns
// `{ data: null, error: null }` for "no row", so the two cases stay separable.
// ─────────────────────────────────────────────────────────────────────────────

const maybeSingle = vi.fn();
/** When set, `supabaseAdmin.from` itself throws — exactly how the real Proxy fails. */
let clientThrows: string | null = null;

// React's cache() is a Server Components API and isn't callable in the node test
// environment. Per-request memoization is irrelevant here — pass straight through.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, cache: <T,>(fn: T) => fn };
});

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    // .is('deleted_at', null) sits between .eq() and .maybeSingle() so
    // soft-deleted campaigns 404 like missing ones — the mock mirrors that chain.
    get from() {
      // A getter, not a method: the real `supabaseAdmin` is a Proxy whose `get`
      // trap throws, so the failure happens on PROPERTY ACCESS, before any
      // query is built. That is precisely the failure `boundedQuery`'s thunk
      // exists to catch, so the mock has to reproduce it at the same point.
      if (clientThrows) throw new Error(clientThrows);
      // `.neq('visibility', 'private')` sits between `.eq()` and `.is()` when the
      // probe reports the column exists. It excludes PRIVATE only — 'unlisted'
      // must stay reachable by direct link, which is what unlisted means — and
      // without it a private campaign was fully readable at its public URL.
      const afterEq: Record<string, unknown> = { is: () => ({ maybeSingle }) };
      afterEq.neq = () => afterEq;
      return () => ({ select: () => ({ eq: () => afterEq }) });
    },
  },
}));

// Stand in for Next's not-found signal, which is a throw with a `digest`.
// The loader probes for the optional `visibility` column before filtering on it.
// Pinned to "present" — the production shape, and the one where the private-campaign
// filter actually applies.
vi.mock('../lib/campaign-visibility', () => ({
  campaignColumns: async () => ({ visibility: true, deletedAt: true }),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    const err = new Error('NEXT_NOT_FOUND') as Error & { digest?: string };
    err.digest = 'NEXT_NOT_FOUND';
    throw err;
  },
}));

const { assertCampaignExists, getCampaign, getCampaignResult } = await import(
  '../app/campaigns/[slug]/get-campaign'
);

describe('campaign detail existence gate', () => {
  beforeEach(() => { maybeSingle.mockReset(); clientThrows = null; });

  it('lets a real campaign through (does NOT 404 a live donation page)', async () => {
    maybeSingle.mockResolvedValue({ data: { id: 'c1', slug: 'save-the-cats', title: 'Save the cats' }, error: null });
    await expect(assertCampaignExists('save-the-cats')).resolves.toBeUndefined();
  });

  it('raises the not-found signal when the slug has no campaign', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(assertCampaignExists('definitely-missing')).rejects.toMatchObject({
      digest: 'NEXT_NOT_FOUND',
    });
  });

  it('does NOT 404 when the read failed — an outage is not a missing campaign', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'connection refused' } });
    // Returns normally: the child segment renders "temporarily unavailable".
    await expect(assertCampaignExists('real-but-unreadable')).resolves.toBeUndefined();
  });

  it('does NOT 404 when the client itself throws (missing service-role env)', async () => {
    clientThrows = 'SUPABASE_SERVICE_ROLE_KEY is not set';
    expect(await getCampaignResult('probe')).toEqual({ ok: false, reason: 'unavailable' });
    await expect(assertCampaignExists('real-but-unreadable')).resolves.toBeUndefined();
  });
});

describe('getCampaignResult reports which of the two happened', () => {
  beforeEach(() => { maybeSingle.mockReset(); clientThrows = null; });

  it('ok for a row, missing for no row, unavailable for an error', async () => {
    maybeSingle.mockResolvedValue({ data: { id: 'c1', slug: 's', user_id: 'u' }, error: null });
    expect(await getCampaignResult('s')).toMatchObject({ ok: true });

    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getCampaignResult('s')).toEqual({ ok: false, reason: 'missing' });

    maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await getCampaignResult('s')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('getCampaign returns null only for missing, and throws for unavailable', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(getCampaign('s')).resolves.toBeNull();

    maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    // Loud on purpose: a caller that forgets to check must not be able to turn
    // an outage into a silent 404 by treating the result as "not found".
    await expect(getCampaign('s')).rejects.toThrow(/unavailable/);
  });
});

describe('soft-deleted campaigns are excluded at the source', () => {
  it("filters deleted_at so a deleted campaign 404s like a missing one", async () => {
    // Regression: DELETE /api/campaigns/[id] soft-deletes by setting deleted_at
    // "for compliance audit trail". Every listing filtered it, but this fetch did
    // not — so a deleted campaign stayed fully readable at /campaigns/<slug>,
    // including its story, donor names and messages, and amount raised. Deleting
    // looked like it worked because the campaign left the listings.
    const calls: [string, unknown][] = [];
    vi.resetModules();
    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof import('react')>();
      return { ...actual, cache: <T,>(fn: T) => fn };
    });
    vi.doMock('../lib/campaign-visibility', () => ({
      campaignColumns: async () => ({ visibility: true, deletedAt: true }),
    }));
    vi.doMock('../lib/supabase', () => ({
      supabaseAdmin: {
        from: () => ({
          select: () => ({
            eq: () => {
              // Records BOTH exclusions this query must apply. They are the same
              // defect twice: a row the owner removed from public view staying
              // readable at its public URL.
              const after: Record<string, unknown> = {
                is: (col: string, val: unknown) => {
                  calls.push([col, val]);
                  return { maybeSingle: async () => ({ data: null, error: null }) };
                },
              };
              after.neq = (col: string, val: unknown) => { calls.push([col, val]); return after; };
              return after;
            },
          }),
        }),
      },
    }));
    const { getCampaign: freshGetCampaign } = await import('../app/campaigns/[slug]/get-campaign');
    await freshGetCampaign('some-slug');
    expect(calls, 'the query must filter deleted_at IS NULL').toContainEqual(['deleted_at', null]);
    // Same class of hole, found by a static sweep of the campaign sub-routes:
    // the fetch applied no `visibility` filter either, so a campaign set to
    // PRIVATE stayed fully readable at its public URL. `neq('private')` rather
    // than `eq('public')` on purpose — 'unlisted' must remain reachable by
    // direct link, which is the entire point of unlisted.
    expect(calls, 'the query must exclude private campaigns').toContainEqual(['visibility', 'private']);
  });
});
