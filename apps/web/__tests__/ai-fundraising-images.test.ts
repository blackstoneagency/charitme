import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../app/ai-fundraising/page.tsx', import.meta.url), 'utf8');

describe('AI fundraising showcase images', () => {
  it('allocates campaign covers together so the page cannot repeat fallback photos', () => {
    expect(source).toContain('getDistinctDisplayPhotos(showcase.map');
    expect(source).toContain('src={showcaseCovers[index]}');
    expect(source).not.toContain('getDisplayCover(c.cover_image_url');
  });
});
