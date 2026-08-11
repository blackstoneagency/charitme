import { describe, it, expect, beforeEach } from 'vitest';
import { resolveCampaignCover, isPlaceholderCover } from '../lib/covers';

// With no UNSPLASH_ACCESS_KEY the live path is skipped and resolution falls back
// to deterministic first-party subject art, so these tests are network-free.
describe('resolveCampaignCover', () => {
  beforeEach(() => { delete process.env.UNSPLASH_ACCESS_KEY; });

  it('prefers the campaign’s own stored cover when present', async () => {
    const url = 'https://cdn.example.com/my-cover.jpg';
    await expect(resolveCampaignCover(url, 'Medical', 'help-sarah')).resolves.toBe(url);
  });

  it('trims a whitespace-only stored cover and falls through', async () => {
    const out = await resolveCampaignCover('   ', 'Education', 'reading-drive');
    expect(out).not.toBe('   ');
    // ⚠️ Was `toContain('/media/subject?')`. The fallback is now a PHOTOGRAPH
    // from the verified themed catalog; generated art is the last resort, for a
    // category with no pool. Asserting the old value would re-pin the defect
    // this change exists to remove.
    expect(out).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
  });

  it('falls back to a deterministic themed PHOTOGRAPH keyed on the seed', async () => {
    const a = await resolveCampaignCover(null, 'Animal', 'save-the-shelter');
    const b = await resolveCampaignCover(null, 'Animal', 'save-the-shelter');
    // Determinism is the property that mattered and it is unchanged: the same
    // seed must pick the same photo on every render, or a card would flicker
    // between images. The seed no longer appears IN the URL — it selects from a
    // pool rather than being printed into generated art — so stability is
    // asserted directly instead of by substring.
    expect(a).toBe(b);
    expect(a).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
  });

  it('gives distinct fallbacks to distinct campaigns (no duplicate covers)', async () => {
    const a = await resolveCampaignCover(null, 'Community', 'campaign-a');
    const b = await resolveCampaignCover(null, 'Community', 'campaign-b');
    expect(a).not.toBe(b);
  });

  it('is safe when seed and category are both missing', async () => {
    const out = await resolveCampaignCover(null, null, null);
    // An unknown category falls to FALLBACK_PHOTOS, which is now real
    // photography rather than six generated cards.
    expect(out).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
  });

  it('replaces a stored Picsum placeholder with a real photo', async () => {
    const placeholder = 'https://picsum.photos/id/9/800/600';
    const out = await resolveCampaignCover(placeholder, 'Medical', 'help-sarah');
    expect(out).not.toBe(placeholder);
    expect(out).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
  });

  it('replaces a stored GENERATED cover too — the case that broke production', async () => {
    // Every campaign's cover_image_url was backfilled to /media/subject by a
    // migration. `isPlaceholderCover` did not recognise that route, so it was
    // treated as a real organizer upload and short-circuited every photograph.
    const generated = '/media/subject?category=Medical&key=help-sarah';
    const out = await resolveCampaignCover(generated, 'Medical', 'help-sarah');
    expect(out).not.toBe(generated);
    expect(out).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
  });

  it('a real uploaded cover always wins (never treated as a placeholder)', async () => {
    const real = 'https://cdn.example.com/uploads/real-cover.jpg';
    await expect(resolveCampaignCover(real, 'Medical', 'help-sarah')).resolves.toBe(real);
  });

  it('varies catalog art by page scope while preserving real uploads', async () => {
    const generated = '/media/subject?category=Medical&key=help-sarah';
    const scoped = await resolveCampaignCover(generated, 'Medical', 'help-sarah', 'donate');
    const unscoped = await resolveCampaignCover(generated, 'Medical', 'help-sarah');
    expect(scoped).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
    // The page scope still feeds the seed, which is what let one campaign show
    // a different image on /donate than on its own page.
    expect(scoped).not.toBe(unscoped);
    // And the half that must NOT change: a genuine upload is untouched by scope.
    await expect(resolveCampaignCover('https://cdn.example.com/uploads/real-cover.jpg', 'Medical', 'help-sarah', 'donate'))
      .resolves.toBe('https://cdn.example.com/uploads/real-cover.jpg');
  });
});

describe('isPlaceholderCover', () => {
  it('flags picsum.photos URLs as overridable placeholders', () => {
    expect(isPlaceholderCover('https://picsum.photos/id/9/800/600')).toBe(true);
    expect(isPlaceholderCover('https://picsum.photos/seed/cm-abc/800/600')).toBe(true);
    expect(isPlaceholderCover('https://fastly.picsum.photos/id/1/800/600')).toBe(true);
    expect(isPlaceholderCover('https://loremflickr.com/800/600/charity')).toBe(true);
  });

  it('does not flag real uploaded or Unsplash covers', () => {
    expect(isPlaceholderCover('https://cdn.example.com/uploads/real.jpg')).toBe(false);
    expect(isPlaceholderCover('https://images.unsplash.com/photo-123?w=800')).toBe(false);
  });
});
