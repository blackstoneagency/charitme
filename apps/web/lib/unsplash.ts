import 'server-only';

// ─────────────────────────────────────────────────────────────────────────────
// Unsplash — category-themed, unique campaign cover photos.
//
// When UNSPLASH_ACCESS_KEY is configured we can assign each campaign a distinct,
// on-theme, professional photo (free under the Unsplash License — commercial use
// OK, no attribution required, though we surface the photographer so callers can
// credit if they wish). Without a key, callers fall back to the unique Lorem
// Picsum covers in lib/photo-catalog.ts (getCoverForCampaign).
//
// The pure helpers (categoryQuery / unsplashCoverUrl) are unit-tested; the
// network call (searchUnsplashCovers) degrades gracefully to [] on any failure
// so a missing key or a transient error never breaks image assignment.
// ─────────────────────────────────────────────────────────────────────────────

/** Campaign category → an Unsplash search query that reads as on-theme. */
const CATEGORY_QUERY: Record<string, string> = {
  Medical: 'hospital healthcare',
  Memorial: 'candle memorial flowers',
  Emergency: 'emergency rescue',
  Nonprofit: 'charity volunteers',
  Education: 'school classroom students',
  Animal: 'animals pets rescue',
  Environment: 'nature landscape conservation',
  Business: 'small business team',
  Community: 'community people together',
  Competition: 'sports competition',
  Creative: 'art creative studio',
  Event: 'celebration event crowd',
  Faith: 'church faith worship',
  Family: 'family together home',
  Sports: 'sports athlete',
  Travel: 'travel adventure',
  Volunteer: 'volunteers helping',
  Wishes: 'hope inspiration sky',
};

const FALLBACK_QUERY = 'charity community help';

// Cache each query's search response for a day. One request per distinct query
// per day serves every campaign in that category — comfortably inside Unsplash's
// rate limits (50/hr demo, 5000/hr production) even when called during SSR.
const SEARCH_TTL_SECONDS = 86_400;

/** Map a campaign category to a themed Unsplash search query. */
export function categoryQuery(category: string | null | undefined): string {
  return CATEGORY_QUERY[category ?? ''] ?? FALLBACK_QUERY;
}

/** Deterministic index in [0, len) from a stable string seed (FNV-1a). Pure. */
export function pickCoverIndex(seed: string, len: number): number {
  if (len <= 0) return 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % len;
}

/** True when an Unsplash Access Key is configured. */
export function hasUnsplashKey(): boolean {
  return !!process.env.UNSPLASH_ACCESS_KEY;
}

/**
 * Build a sized, cropped cover URL from an Unsplash photo's `urls.raw`. Using the
 * raw URL + explicit params lets us request an exact 800×600 landscape crop at a
 * sensible quality without pulling the full-resolution asset.
 */
export function unsplashCoverUrl(raw: string, w = 800, h = 600): string {
  const sep = raw.includes('?') ? '&' : '?';
  return `${raw}${sep}auto=format&fit=crop&crop=entropy&w=${w}&h=${h}&q=80`;
}

export interface UnsplashCover {
  /** Ready-to-store cover URL (sized 800×600). */
  url: string;
  /** Unsplash photo id — a stable natural key for de-duplication. */
  id: string;
  /** Photographer name (for optional attribution). */
  author: string;
  /** Unsplash API download-tracking endpoint (call per API guidelines on use). */
  downloadLocation: string;
}

interface UnsplashPhoto {
  id: string;
  urls: { raw: string };
  user: { name: string };
  links: { download_location: string };
}

/**
 * Search Unsplash for up to `count` landscape photos matching `query`, returning
 * de-duplicated, sized cover objects. Returns [] when no key is set or on any
 * error (never throws), so assignment logic can fall back cleanly.
 */
export async function searchUnsplashCovers(query: string, count = 30, page = 1): Promise<UnsplashCover[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const perPage = Math.min(30, Math.max(1, count));
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=landscape&content_filter=high`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
      next: { revalidate: SEARCH_TTL_SECONDS },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { results?: UnsplashPhoto[] };
    const seen = new Set<string>();
    const out: UnsplashCover[] = [];
    for (const p of body.results ?? []) {
      if (!p?.urls?.raw || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({
        url: unsplashCoverUrl(p.urls.raw),
        id: p.id,
        author: p.user?.name ?? '',
        downloadLocation: p.links?.download_location ?? '',
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * A single themed cover for a campaign, deterministically keyed on `seed` so the
 * same campaign always resolves to the same photo and distinct campaigns in a
 * category get distinct photos (uniqueness). Returns null when no key is set or
 * the search yields nothing — callers fall back to the Picsum/catalog cover.
 */
export async function unsplashCoverForCampaign(
  category: string | null | undefined,
  seed: string,
): Promise<UnsplashCover | null> {
  const covers = await searchUnsplashCovers(categoryQuery(category));
  if (covers.length === 0) return null;
  return covers[pickCoverIndex(seed, covers.length)];
}
