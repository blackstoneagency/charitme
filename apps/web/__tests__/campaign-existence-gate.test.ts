import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Campaign detail existence gate (soft-404 fix).
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
// ─────────────────────────────────────────────────────────────────────────────

const single = vi.fn();

// React's cache() is a Server Components API and isn't callable in the node test
// environment. Per-request memoization is irrelevant here — pass straight through.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, cache: <T,>(fn: T) => fn };
});

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    // .is('deleted_at', null) sits between .eq() and .single() so soft-deleted
    // campaigns 404 like missing ones — the mock mirrors that chain.
    from: () => ({ select: () => ({ eq: () => ({ is: () => ({ single }) }) }) }),
  },
}));

// Stand in for Next's not-found signal, which is a throw with a `digest`.
vi.mock('next/navigation', () => ({
  notFound: () => {
    const err = new Error('NEXT_NOT_FOUND') as Error & { digest?: string };
    err.digest = 'NEXT_NOT_FOUND';
    throw err;
  },
}));

const { assertCampaignExists } = await import('../app/campaigns/[slug]/get-campaign');

describe('campaign detail existence gate', () => {
  beforeEach(() => single.mockReset());

  it('lets a real campaign through (does NOT 404 a live donation page)', async () => {
    single.mockResolvedValue({ data: { id: 'c1', slug: 'save-the-cats', title: 'Save the cats' } });
    await expect(assertCampaignExists('save-the-cats')).resolves.toBeUndefined();
  });

  it('raises the not-found signal when the slug has no campaign', async () => {
    single.mockResolvedValue({ data: null });
    await expect(assertCampaignExists('definitely-missing')).rejects.toMatchObject({
      digest: 'NEXT_NOT_FOUND',
    });
  });

  it('raises not-found when the row is missing and the query errored', async () => {
    // `.single()` reports an error for zero rows; `data` is still null, and a
    // missing campaign must 404 rather than render an empty shell.
    single.mockResolvedValue({ data: null, error: { message: 'no rows' } });
    await expect(assertCampaignExists('missing')).rejects.toMatchObject({
      digest: 'NEXT_NOT_FOUND',
    });
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
    vi.doMock('../lib/supabase', () => ({
      supabaseAdmin: {
        from: () => ({
          select: () => ({
            eq: () => ({
              is: (col: string, val: unknown) => {
                calls.push([col, val]);
                return { single: async () => ({ data: null }) };
              },
            }),
          }),
        }),
      },
    }));
    const { getCampaign } = await import('../app/campaigns/[slug]/get-campaign');
    await getCampaign('some-slug');
    expect(calls, 'the query must filter deleted_at IS NULL').toContainEqual(['deleted_at', null]);
  });
});
