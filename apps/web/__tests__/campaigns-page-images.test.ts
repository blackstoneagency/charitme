import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../app/campaigns/(list)/page.tsx', import.meta.url), 'utf8');

describe('campaigns page images', () => {
  it('allocates featured and listing covers together so one page cannot repeat a photo', () => {
    expect(source).toContain('const pageCovers = getDistinctDisplayPhotos([');
    expect(source).toContain('const featuredCovers = pageCovers.slice');
    expect(source).toContain('const listingCovers = pageCovers.slice');
    expect(source).not.toContain("getDisplayCover(c.cover_image_url, c.category, c.slug, 'campaigns-list");
  });
});
