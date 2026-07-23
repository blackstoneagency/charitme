import { describe, it, expect, beforeEach } from 'vitest';
import { resolveCampaignCover } from '../lib/covers';

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
});
