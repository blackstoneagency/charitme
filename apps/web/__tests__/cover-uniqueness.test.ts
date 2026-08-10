import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CATEGORY_PHOTOS,
  getCoverForCampaign,
  getCoverForCategory,
} from '../lib/photo-catalog';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(WEB_ROOT, p), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// "Every image on every page is unique, 0 duplicates."
//
// The subtle failure is not a missing image — it is one function that looks
// per-campaign and is actually per-category. getCoverForCategory returns
// pool[0], so wiring it to a campaign renders every uncovered campaign in that
// category identically, side by side in a listing.
// ─────────────────────────────────────────────────────────────────────────────

describe('the two cover helpers differ in the way that matters', () => {
  it('getCoverForCategory is CONSTANT per category — by design', () => {
    // Asserted, not assumed: this is the property that makes it wrong for
    // campaigns and right for category tiles.
    expect(getCoverForCategory('Medical')).toBe(getCoverForCategory('Medical'));
  });

  it('getCoverForCampaign is DISTINCT per campaign', () => {
    const covers = ['alpha', 'beta', 'gamma', 'delta'].map((slug) =>
      getCoverForCampaign('Medical', slug),
    );
    expect(new Set(covers).size).toBe(covers.length);
  });

  it('two campaigns in the SAME category do not collide', () => {
    // The exact scenario from the hero rotator: same category, different
    // campaigns, both falling back.
    expect(getCoverForCampaign('Emergency', 'flood-relief'))
      .not.toBe(getCoverForCampaign('Emergency', 'wildfire-relief'));
  });

  it('the same campaign is stable across renders and deploys', () => {
    expect(getCoverForCampaign('Medical', 'my-slug')).toBe(getCoverForCampaign('Medical', 'my-slug'));
  });

  it('falls back to a category seed only when there is no campaign key', () => {
    expect(getCoverForCampaign('Medical', null)).toBe(getCoverForCampaign('Medical', ''));
  });
});

describe('per-campaign covers never use the per-category helper', () => {
  it('the homepage hero rotator keys its fallback on the campaign', () => {
    const src = read('app/page.tsx');
    expect(src, 'fallbackCover reverted to the per-category helper')
      .not.toMatch(/fallbackCover:\s*getCoverForCategory/);
    expect(src).toMatch(/fallbackCover:\s*getCoverForCampaign\(c\.category,\s*c\.slug\)/);
  });

  it('getCoverForCategory survives only for category tiles', () => {
    const src = read('app/page.tsx');
    // Every remaining call must sit on the browse-by-category tile, which is
    // one image standing for a whole category — the helper's actual purpose.
    const calls = [...src.matchAll(/getCoverForCategory\([^)]*\)/g)];
    expect(calls.length, 'unexpected getCoverForCategory call — is it per-campaign?').toBe(1);
    const at = src.indexOf(calls[0][0]);
    expect(src.slice(Math.max(0, at - 400), at)).toMatch(/(?:home|mirror)-cause-media/);
  });

  it('CampaignImage prefers the campaign-keyed cover when given a key', () => {
    const src = read('components/CampaignImage.tsx');
    expect(src).toMatch(/campaignKey\s*\n?\s*\?\s*getCoverForCampaign\(category, campaignKey\)/);
  });

  it('CampaignImage accepts optimized project-local artwork', () => {
    const src = read('components/CampaignImage.tsx');
    expect(src).toMatch(/usableSource\?\.startsWith\('\/'\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Catalog health. These are NOT failures — the catalog is deliberately capped at
// IDs verified to return HTTP 200, and new ones cannot be verified without
// egress to images.unsplash.com (currently refused by the sandbox proxy).
// Adding unverified IDs would trade duplicate covers for broken ones.
// This records the shape of the gap so it is actionable the moment that lifts.
// ─────────────────────────────────────────────────────────────────────────────

describe('the themed catalog is well-formed', () => {
  it('gives every category a pool it can vary within', () => {
    for (const [category, photos] of Object.entries(CATEGORY_PHOTOS)) {
      expect(photos.length, `${category} has too small a pool to vary`).toBeGreaterThanOrEqual(4);
    }
  });

  it('never repeats a photo WITHIN one category', () => {
    // Cross-category sharing is a known, accepted limit of the verified-ID pool.
    // Repetition inside a single pool is not — it would shrink the variety a
    // category can actually show.
    for (const [category, photos] of Object.entries(CATEGORY_PHOTOS)) {
      expect(new Set(photos).size, `${category} repeats a photo inside its own pool`)
        .toBe(photos.length);
    }
  });
});
