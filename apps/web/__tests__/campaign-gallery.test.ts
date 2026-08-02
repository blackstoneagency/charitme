import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isUnresolvableHost,
  classifyKind,
  toGalleryItem,
  sortGallery,
  filterGallery,
  countGallery,
  coverAsGalleryItem,
  type CampaignMediaRow,
} from '../lib/campaign-gallery-core';

const row = (over: Partial<CampaignMediaRow> = {}): CampaignMediaRow => ({
  id: 'm1',
  media_type: 'image',
  public_url: 'https://cdn.example.org/a.jpg',
  storage_path: 'campaigns/a.jpg',
  caption: 'A caption',
  alt_text: 'Alt text',
  sort_order: 1,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

describe('unresolvable hosts', () => {
  it('rejects the RFC 2606 reserved TLDs', () => {
    // This is not a guess about what might be broken. .example/.invalid/.test/
    // .localhost are reserved by specification precisely so they never resolve,
    // which is what makes this safe to decide without a network request.
    expect(isUnresolvableHost('https://storage.CharitMe.example/campaigns/media_1.jpg')).toBe(true);
    expect(isUnresolvableHost('https://a.invalid/x.png')).toBe(true);
    expect(isUnresolvableHost('https://a.test/x.png')).toBe(true);
    expect(isUnresolvableHost('http://localhost:3000/x.png')).toBe(true);
  });

  it('accepts real hosts, including ones merely containing "example"', () => {
    expect(isUnresolvableHost('https://cdn.example.org/a.jpg')).toBe(false);
    expect(isUnresolvableHost('https://yanexccimwooursawynm.supabase.co/storage/v1/object/public/x.webp')).toBe(false);
    expect(isUnresolvableHost('https://images.unsplash.com/photo-1')).toBe(false);
  });

  it('treats a non-URL as unresolvable rather than throwing', () => {
    expect(isUnresolvableHost('not a url')).toBe(true);
    expect(isUnresolvableHost('')).toBe(true);
  });
});

describe('classifying media', () => {
  it('maps the known types', () => {
    expect(classifyKind('image')).toBe('image');
    expect(classifyKind('photo')).toBe('image');
    expect(classifyKind('video')).toBe('video');
    expect(classifyKind('document')).toBe('document');
  });

  it('treats anything unknown as a document — a link, never an <img>', () => {
    // An unknown type rendered as an image is a broken frame; rendered as a link
    // it is merely unfamiliar. Degrade toward the harmless one.
    expect(classifyKind('spreadsheet')).toBe('document');
    expect(classifyKind(null)).toBe('document');
  });
});

describe('building gallery items', () => {
  it('marks a reserved-TLD URL unavailable instead of showing a broken image', () => {
    const item = toGalleryItem(row({ public_url: 'https://storage.CharitMe.example/x.jpg' }));
    expect(item.url).toBeNull();
    expect(item.unavailableReason).toBe('unresolvable-host');
  });

  it('does NOT substitute a stock photo for a dead URL', () => {
    // The critical distinction. Substituting is right for a campaign CARD, which
    // needs some image; here it would put a photo of strangers under the caption
    // "showing progress and impact" and tell a donor something false about where
    // their money went.
    const item = toGalleryItem(row({ public_url: 'https://storage.CharitMe.example/x.jpg' }));
    expect(item.url).toBeNull();
    expect(item.caption).toBe('A caption'); // caption survives; only the file is gone
  });

  it('keeps a working URL', () => {
    expect(toGalleryItem(row()).url).toBe('https://cdn.example.org/a.jpg');
    expect(toGalleryItem(row()).unavailableReason).toBeNull();
  });

  it('flags a missing URL separately from an unresolvable one', () => {
    expect(toGalleryItem(row({ public_url: null })).unavailableReason).toBe('no-url');
    expect(toGalleryItem(row({ public_url: '   ' })).unavailableReason).toBe('no-url');
  });

  it('never leaves alt text empty for a meaningful image', () => {
    // An empty alt makes a screen reader skip the item entirely, so the user is
    // not told it exists at all.
    expect(toGalleryItem(row({ alt_text: null })).alt).toBe('A caption');
    expect(toGalleryItem(row({ alt_text: null, caption: null })).alt).toBe('Campaign media');
    expect(toGalleryItem(row({ alt_text: '  ' })).alt).toBe('A caption');
  });
});

describe('ordering', () => {
  it('respects the organiser sort_order, then oldest first on a tie', () => {
    const rows = [
      row({ id: 'c', sort_order: 2, created_at: '2026-01-01T00:00:00Z' }),
      row({ id: 'a', sort_order: 1, created_at: '2026-03-01T00:00:00Z' }),
      row({ id: 'b', sort_order: 1, created_at: '2026-02-01T00:00:00Z' }),
    ];
    expect(sortGallery(rows.map(toGalleryItem), rows).map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('puts the campaign cover first', () => {
    const cover = coverAsGalleryItem('https://cdn.example.org/cover.webp', 'Clean Water');
    expect(cover?.sortOrder).toBeLessThan(0);
    expect(cover?.alt).toBe('Cover photo for Clean Water');
  });

  it('contributes no cover item when there is no usable cover', () => {
    // Rather than inventing an entry so the gallery looks fuller.
    expect(coverAsGalleryItem(null, 'X')).toBeNull();
    expect(coverAsGalleryItem('', 'X')).toBeNull();
    expect(coverAsGalleryItem('https://storage.CharitMe.example/c.jpg', 'X')).toBeNull();
  });
});

describe('filters and counts', () => {
  const items = [
    toGalleryItem(row({ id: 'i1', media_type: 'image' })),
    toGalleryItem(row({ id: 'v1', media_type: 'video' })),
    toGalleryItem(row({ id: 'd1', media_type: 'document' })),
    toGalleryItem(row({ id: 'x1', media_type: 'image', public_url: 'https://a.example/x.jpg' })),
  ];

  it('filters by kind and does not mutate the input', () => {
    const before = items.map((i) => i.id);
    expect(filterGallery(items, 'image').map((i) => i.id)).toEqual(['i1', 'x1']);
    expect(filterGallery(items, 'video').map((i) => i.id)).toEqual(['v1']);
    expect(filterGallery(items, 'all')).toHaveLength(4);
    expect(items.map((i) => i.id)).toEqual(before);
  });

  it('counts unavailable items so the UI can say so rather than hide them', () => {
    expect(countGallery(items)).toEqual({ all: 4, image: 2, video: 1, document: 1, unavailable: 1 });
  });
});

describe('the page itself', () => {
  const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

  it('does not render a public upload control', () => {
    // The mock shows "Upload Media". On a PUBLIC page that is either a dead
    // button or an unauthenticated write path; uploading belongs to the
    // organiser's dashboard, behind auth.
    const page = read('app/campaigns/[slug]/gallery/page.tsx');
    const grid = read('app/campaigns/[slug]/gallery/GalleryGrid.tsx');
    expect(`${page} ${grid}`).not.toMatch(/Upload Media/i);
    expect(`${page} ${grid}`).not.toMatch(/<input[^>]+type="file"/);
  });

  it('the lightbox is keyboard operable and manages focus', () => {
    const grid = read('app/campaigns/[slug]/gallery/GalleryGrid.tsx');
    expect(grid).toContain("e.key === 'Escape'");
    expect(grid).toContain("e.key === 'ArrowRight'");
    expect(grid).toContain('aria-modal="true"');
    expect(grid).toContain('lastFocused');
  });

  it('confirms the exact cover filename rather than trusting a prefix search', () => {
    // Storage `search` is a substring match, so "campaign-1" also matches
    // "campaign-10" — without the exact check every campaign could show its
    // neighbour's photo.
    const storage = read('lib/campaign-media-storage.ts');
    expect(storage).toContain('f.name === file');
  });

  it('skips storage folders, which have a null id and no metadata', () => {
    const storage = read('lib/campaign-media-storage.ts');
    expect(storage).toContain('f.id !== null');
  });
});
