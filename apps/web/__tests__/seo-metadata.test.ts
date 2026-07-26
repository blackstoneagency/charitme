import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// The SEO override must never be able to delete a page's own metadata.
//
// `getSeoForRoute` had no error handling, so when the Supabase call threw,
// `generateMetadata` rejected and Next.js dropped metadata for the entire route.
// The page still rendered — 89KB of correct homepage markup with zero meta tags —
// so there was no error, no log line, and no visible symptom. Just a silent
// WCAG 2.4.2 (Page Titled) failure and total SEO loss.
//
// These tests pin the contract: a failing override degrades to the caller's own
// metadata, and never throws.
// ─────────────────────────────────────────────────────────────────────────────

const maybeSingle = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  },
}));

// `server-only` throws when imported outside a server component under vitest.
vi.mock('server-only', () => ({}));

const { seoMetadata, getSeoForRoute } = await import('../lib/seo');

beforeEach(() => {
  maybeSingle.mockReset();
});

describe('getSeoForRoute', () => {
  it('returns null instead of throwing when Supabase rejects', async () => {
    maybeSingle.mockRejectedValue(new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY are not set'));
    await expect(getSeoForRoute('/')).resolves.toBeNull();
  });

  it('returns null instead of throwing on a fetch-level exception', async () => {
    maybeSingle.mockRejectedValue(new TypeError('fetch failed'));
    await expect(getSeoForRoute('/impact')).resolves.toBeNull();
  });
});

describe('seoMetadata', () => {
  it('keeps the caller\'s own title when the override lookup throws', async () => {
    maybeSingle.mockRejectedValue(new Error('boom'));
    const meta = await seoMetadata('/impact', { title: 'Impact Reports - Donation Transparency' });
    // The regression this guards: `title` came back undefined, so Next fell back to
    // nothing at all rather than to the page's own metadata.
    expect(meta.title).toBe('Impact Reports - Donation Transparency');
  });

  it('still returns a usable object for a page with no base metadata', async () => {
    // The homepage passes no base — it relies on the root layout's title default.
    // What matters is that this resolves rather than rejecting, because a rejection
    // is what made Next.js drop the layout's metadata too.
    maybeSingle.mockRejectedValue(new Error('boom'));
    const meta = await seoMetadata('/');
    expect(meta).toBeTruthy();
    expect(meta.alternates?.canonical).toBe('/');
  });

  it('applies the override when the lookup succeeds', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        route: '/', title: 'Admin Override', meta_description: 'From the SEO console',
        keywords: null, og_title: null, og_description: null, og_image_url: null,
        canonical_url: null, noindex: false,
      },
    });
    const meta = await seoMetadata('/', { title: 'Page default' });
    expect(meta.title).toBe('Admin Override');
    expect(meta.description).toBe('From the SEO console');
  });

  it('falls back to the page title when the override row has no title', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        route: '/', title: null, meta_description: null, keywords: null,
        og_title: null, og_description: null, og_image_url: null,
        canonical_url: null, noindex: false,
      },
    });
    const meta = await seoMetadata('/', { title: 'Page default' });
    expect(meta.title).toBe('Page default');
  });
});
