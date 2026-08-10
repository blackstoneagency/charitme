import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveCampaignCover } from '../lib/covers';
import { unsplashCoverPool, pickCoverIndex } from '../lib/unsplash';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ─────────────────────────────────────────────────────────────────────────────
// Campaigns must end up with REAL, on-theme, DISTINCT photos.
//
// Two defects blocked that, and both are pinned here because both were silent:
//
//  1. A stored `/media/subject` cover is generated first-party art, but it was
//     treated as an organizer upload — so it short-circuited the live-photo
//     branch. Setting UNSPLASH_ACCESS_KEY would have changed nothing at all for
//     the 501 campaigns holding one.
//
//  2. `unsplashCoverForCampaign` documented itself as giving "distinct campaigns
//     in a category distinct photos". Measured against the live category sizes,
//     hashing into one 30-photo page gives 222 of 502 campaigns (44.2%) a
//     DUPLICATE cover. Uniqueness is a property of the set; one campaign at a
//     time cannot deliver it.
// ─────────────────────────────────────────────────────────────────────────────

describe('a generated cover is overridable, an upload is not', () => {
  beforeEach(() => { delete process.env.UNSPLASH_ACCESS_KEY; });

  it('keeps a first-party generated cover when no live photo is available', async () => {
    // Without a key there is nothing better to move to, and the stored cover is
    // DISTINCT per campaign while the catalog is 45 photos shared by 502
    // campaigns. Falling through would trade uniqueness for repetition.
    const generated = '/media/subject?category=Medical&key=migration-20260903-campaign-1-49b50f84';
    await expect(resolveCampaignCover(generated, 'Medical', 'campaign-1')).resolves.toBe(generated);
  });

  it('still replaces a generic external placeholder', async () => {
    // The distinction that the first version of this fix got wrong: picsum is a
    // generic placeholder the backfill set out to retire, not first-party art.
    const picsum = 'https://picsum.photos/id/9/800/600';
    await expect(resolveCampaignCover(picsum, 'Medical', 'help-sarah')).resolves.not.toBe(picsum);
  });

  it('never replaces a real organizer upload', async () => {
    const upload = 'https://yanexccimwooursawynm.supabase.co/storage/v1/object/public/campaign-media/real.jpg';
    await expect(resolveCampaignCover(upload, 'Medical', 'campaign-1')).resolves.toBe(upload);
  });
});

describe('the themed pool is large enough to matter', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; delete process.env.UNSPLASH_ACCESS_KEY; });

  it('pools across pages and de-duplicates by photo id', async () => {
    process.env.UNSPLASH_ACCESS_KEY = 'test-key';
    const page = (ids: string[]) => ({
      ok: true,
      json: async () => ({
        results: ids.map((id) => ({ id, urls: { raw: `https://images.unsplash.com/photo-${id}` }, user: { name: 'A' }, links: {} })),
      }),
    });
    const pages = [page(['a', 'b']), page(['b', 'c']), page(['d'])];
    let call = 0;
    globalThis.fetch = vi.fn(async () => pages[call++] ?? page([])) as unknown as typeof fetch;

    const pool = await unsplashCoverPool('Medical', 3);
    expect(pool.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(call, 'should request every page it was asked for').toBe(3);
  });

  it('stops early rather than looping when a page comes back empty', async () => {
    process.env.UNSPLASH_ACCESS_KEY = 'test-key';
    let call = 0;
    globalThis.fetch = vi.fn(async () => { call++; return { ok: true, json: async () => ({ results: [] }) }; }) as unknown as typeof fetch;
    await expect(unsplashCoverPool('Medical', 5)).resolves.toEqual([]);
    expect(call).toBe(1);
  });
});

describe('per-campaign hashing cannot promise uniqueness — so it must not claim to', () => {
  it('demonstrates the collision the old comment denied', () => {
    // 73 campaigns (the live size of Faith, Education and Medical) hashed into a
    // single 30-photo page. The pigeonhole alone forces >= 43 duplicates.
    const slugs = Array.from({ length: 73 }, (_, i) => `campaign-${i + 1}`);
    const chosen = new Set(slugs.map((s) => pickCoverIndex(s, 30)));
    expect(chosen.size).toBeLessThan(slugs.length);
  });

  it('says so in the source, so the next reader is not misled', () => {
    const src = readFileSync(join(WEB_ROOT, 'lib', 'unsplash.ts'), 'utf8');
    expect(src).toMatch(/does NOT guarantee uniqueness/i);
    expect(src, 'the global assigner must be named as the thing that does').toContain('assign-campaign-photos');
  });
});

describe('the assigner refuses to half-do the job', () => {
  const src = readFileSync(join(WEB_ROOT, 'scripts', 'assign-campaign-photos.mjs'), 'utf8');

  it('is dry-run by default', () => {
    expect(src).toContain("COMMIT = argv.includes('--commit')");
    expect(src).toMatch(/if \(!COMMIT\)/);
  });

  it('refuses to write a non-distinct assignment', () => {
    // The distinctness check moved into scripts/lib/campaign-photo-plan.mjs so it
    // could be tested at production scale (campaign-photo-plan.test.ts). What
    // matters here is that the SCRIPT still consults it and still refuses.
    expect(src).toContain('planIsDistinct');
    expect(src).toMatch(/!planIsDistinct\(assignments\)[\s\S]*?Refusing to write/);
  });

  it('refuses to write when a category is short of photos', () => {
    expect(src).toMatch(/shortfall[\s\S]*?Refusing to assign/);
  });

  it('verifies every URL before writing', () => {
    expect(src).toMatch(/Refusing to write/);
    expect(src).toContain("method: 'HEAD'");
  });

  it('can emit a migration, so the DB half needs no service-role key', () => {
    // The service-role key in .env.local now returns 401 (rotated). A migration
    // is how today's covers were written in the first place, so it is the path
    // that does not depend on a credential this session cannot have.
    expect(src).toContain("EMIT_MIGRATION = argv.includes('--emit-migration')");
    expect(src).toContain('supabase');
    expect(src).toContain('rollbacks');
  });

  it('guards every generated UPDATE so it can never overwrite an upload', () => {
    // The window that matters: an organizer uploads a cover between generating
    // the file and applying it. The guard makes that row skip, not lose a photo.
    expect(src).toMatch(/cover_image_url ilike '%\/media\/subject%'/);
    expect(src).toMatch(/update public\.campaigns set cover_image_url[\s\S]*?and \$\{guard\}/);
  });

  it('leaves organizer uploads alone', () => {
    expect(src).toContain('isGenerated');
    expect(src).toMatch(/already hold a real cover and are left untouched/);
  });
});
