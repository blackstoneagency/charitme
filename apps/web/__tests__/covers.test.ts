import { describe, it, expect, beforeEach } from 'vitest';
import { resolveCampaignCover, isPlaceholderCover } from '../lib/covers';

// With no UNSPLASH_ACCESS_KEY the live path is skipped and resolution falls back
// to the deterministic Picsum cover — so these tests are network-free.
describe('resolveCampaignCover', () => {
  beforeEach(() => { delete process.env.UNSPLASH_ACCESS_KEY; });

  it('prefers the campaign’s own stored cover when present', async () => {
    const url = 'https://cdn.example.com/my-cover.jpg';
    await expect(resolveCampaignCover(url, 'Medical', 'help-sarah')).resolves.toBe(url);
  });

  it('trims a whitespace-only stored cover and falls through', async () => {
    const out = await resolveCampaignCover('   ', 'Education', 'reading-drive');
    expect(out).not.toBe('   ');
    expect(out).toContain('picsum.photos');
  });

  it('falls back to a deterministic Picsum cover keyed on the seed', async () => {
    const a = await resolveCampaignCover(null, 'Animal', 'save-the-shelter');
    const b = await resolveCampaignCover(null, 'Animal', 'save-the-shelter');
    expect(a).toBe(b); // stable across calls
    expect(a).toContain('picsum.photos');
    expect(a).toContain('save-the-shelter');
  });

  it('gives distinct fallbacks to distinct campaigns (no duplicate covers)', async () => {
    const a = await resolveCampaignCover(null, 'Community', 'campaign-a');
    const b = await resolveCampaignCover(null, 'Community', 'campaign-b');
    expect(a).not.toBe(b);
  });

  it('is safe when seed and category are both missing', async () => {
    const out = await resolveCampaignCover(null, null, null);
    expect(out).toContain('picsum.photos');
  });

  it('keeps a stored Picsum placeholder when no live photo is available', async () => {
    // A picsum placeholder is overridable, but with no key there is nothing to
    // override it with — so the existing placeholder is preserved (stable).
    const placeholder = 'https://picsum.photos/id/9/800/600';
    await expect(resolveCampaignCover(placeholder, 'Medical', 'help-sarah')).resolves.toBe(placeholder);
  });

  it('a real uploaded cover always wins (never treated as a placeholder)', async () => {
    const real = 'https://cdn.example.com/uploads/real-cover.jpg';
    await expect(resolveCampaignCover(real, 'Medical', 'help-sarah')).resolves.toBe(real);
  });
});

describe('isPlaceholderCover', () => {
  it('flags picsum.photos URLs as overridable placeholders', () => {
    expect(isPlaceholderCover('https://picsum.photos/id/9/800/600')).toBe(true);
    expect(isPlaceholderCover('https://picsum.photos/seed/cm-abc/800/600')).toBe(true);
    expect(isPlaceholderCover('https://fastly.picsum.photos/id/1/800/600')).toBe(true);
  });

  it('does not flag real uploaded or Unsplash covers', () => {
    expect(isPlaceholderCover('https://cdn.example.com/uploads/real.jpg')).toBe(false);
    expect(isPlaceholderCover('https://images.unsplash.com/photo-123?w=800')).toBe(false);
  });
});
