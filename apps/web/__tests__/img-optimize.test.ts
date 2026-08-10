import { describe, it, expect } from 'vitest';
import { optimizedCoverUrl } from '../lib/img-optimize';

describe('optimizedCoverUrl', () => {
  it('replaces every generic placeholder provider with first-party subject art', () => {
    const picsum = optimizedCoverUrl('https://picsum.photos/id/42/800/600', 400);
    const seeded = optimizedCoverUrl('https://picsum.photos/seed/cm-abc/800/600', 480);
    const lorem = optimizedCoverUrl('https://loremflickr.com/800/450/hospital', 400);
    expect(picsum).toMatch(/^\/media\/subject\?category=Community&key=legacy-/);
    expect(seeded).toMatch(/^\/media\/subject\?category=Community&key=legacy-/);
    expect(lorem).toMatch(/^\/media\/subject\?category=Community&key=legacy-/);
    expect(new Set([picsum, seeded, lorem]).size).toBe(3);
  });

  it('adds sizing + webp params to an Unsplash url', () => {
    const out = optimizedCoverUrl('https://images.unsplash.com/photo-123?auto=format&fit=crop&w=1200', 500);
    expect(out).toContain('w=500');
    expect(out).toContain('fm=webp');
    expect(out).toContain('q=75');
  });

  it('routes Supabase Storage objects through the image transformer', () => {
    // The object endpoint always returns the full-size original; render/image
    // serves a card-sized variant (IMG-05 moved every seeded cover here).
    expect(optimizedCoverUrl('https://xyz.supabase.co/storage/v1/object/public/campaign-media/covers/a.webp', 400))
      .toBe('https://xyz.supabase.co/storage/v1/render/image/public/campaign-media/covers/a.webp?width=400&height=300&resize=cover&quality=75');
  });

  it('leaves unknown hosts unchanged', () => {
    expect(optimizedCoverUrl('data:image/svg+xml,abc', 400)).toBe('data:image/svg+xml,abc');
  });

  it('returns empty string for nullish input', () => {
    expect(optimizedCoverUrl(null)).toBe('');
    expect(optimizedCoverUrl(undefined)).toBe('');
    expect(optimizedCoverUrl('')).toBe('');
  });

  it('clamps the width to a sane range', () => {
    expect(optimizedCoverUrl('https://images.unsplash.com/photo-1', 5)).toContain('w=160');
    expect(optimizedCoverUrl('https://images.unsplash.com/photo-1', 9999)).toContain('w=1600');
  });
});
