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
    expect(out).toContain('/media/subject?');
  });

  it('falls back to deterministic first-party subject art keyed on the seed', async () => {
    const a = await resolveCampaignCover(null, 'Animal', 'save-the-shelter');
    const b = await resolveCampaignCover(null, 'Animal', 'save-the-shelter');
    expect(a).toBe(b); // stable across calls
    expect(a).toContain('/media/subject?');
    expect(a).toContain('save-the-shelter');
  });

  it('gives distinct fallbacks to distinct campaigns (no duplicate covers)', async () => {
    const a = await resolveCampaignCover(null, 'Community', 'campaign-a');
    const b = await resolveCampaignCover(null, 'Community', 'campaign-b');
    expect(a).not.toBe(b);
  });

  it('is safe when seed and category are both missing', async () => {
    const out = await resolveCampaignCover(null, null, null);
    expect(out).toContain('/media/subject?');
  });

  it('replaces a stored Picsum placeholder when no live photo is available', async () => {
    const placeholder = 'https://picsum.photos/id/9/800/600';
    await expect(resolveCampaignCover(placeholder, 'Medical', 'help-sarah'))
      .resolves.toBe('/media/subject?category=Medical&key=help-sarah');
  });

  it('a real uploaded cover always wins (never treated as a placeholder)', async () => {
    const real = 'https://cdn.example.com/uploads/real-cover.jpg';
    await expect(resolveCampaignCover(real, 'Medical', 'help-sarah')).resolves.toBe(real);
  });

  it('scopes first-party catalog art by page while preserving real uploads', async () => {
    const generated = '/media/subject?category=Medical&key=help-sarah';
    await expect(resolveCampaignCover(generated, 'Medical', 'help-sarah', 'donate'))
      .resolves.toBe('/media/subject?category=Medical&key=donate-help-sarah');
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
