import 'server-only';
import { getCoverForCampaign, isCatalogCover, isPlaceholderCover } from './photo-catalog';
import { unsplashCoverForCampaign } from './unsplash';

/**
 * Generic stock URLs are placeholder covers assigned by older backfills, not
 * organizer uploads. A themed source may replace them; a real upload always wins.
 */
export { isPlaceholderCover } from './photo-catalog';

/**
 * Resolve the best cover image URL for a campaign, server-side. Order of
 * preference:
 *   1. the campaign's own *real* uploaded `cover_image_url`,
 *   2. a themed, unique live Unsplash photo (only when UNSPLASH_ACCESS_KEY is set),
 *   3. deterministic first-party subject artwork.
 *
 * A generic placeholder does not short-circuit step 2, so a live themed source
 * can replace old backfilled imagery once a key is configured. Every
 * branch returns a valid URL, so callers never need their own fallback. The
 * `seed` should be the campaign's stable slug/id so the chosen photo is
 * consistent across renders and distinct between campaigns.
 */
export async function resolveCampaignCover(
  storedCover: string | null | undefined,
  category: string | null | undefined,
  seed: string | null | undefined,
  pageScope?: string,
): Promise<string> {
  const stored = storedCover?.trim() || '';

  // A real ORGANIZER UPLOAD always wins — nothing below may replace it.
  if (stored && !isPlaceholderCover(stored) && !isCatalogCover(stored)) return stored;

  const baseKey = (seed && seed.trim()) ? seed.trim() : `cat-${category ?? 'charity'}`;
  const key = pageScope ? `${pageScope}-${baseKey}` : baseKey;
  const live = await unsplashCoverForCampaign(category, key);
  if (live) return live.url;

  // ⚠️ No live photo, and the stored cover is FIRST-PARTY GENERATED ART.
  //
  // Keep it — unless a pageScope asked for per-page variation, which is the
  // contract the signed-in views rely on to avoid printing one campaign's cover
  // twice on a page.
  //
  // The order matters. `/media/subject` covers are generated per campaign, so
  // all 501 live campaigns hold a DISTINCT one; the catalog holds 39 photos.
  // Falling through unconditionally would trade 501 unique covers for 39
  // repeated ones, turning a listing into the same dozen images over and over.
  // Uniqueness is what the stored cover is carrying, so it is given up only for
  // a real photo — never for a shorter pool.
  // ⚠️ `isCatalogCover`, NOT merely `stored`. A picsum/loremflickr URL is a
  // GENERIC EXTERNAL placeholder and must still be replaced by first-party art —
  // keeping it here preserved exactly the imagery the backfill set out to
  // retire. Caught by covers.test.ts on the first attempt at this fix.
  if (stored && isCatalogCover(stored) && !pageScope) return stored;

  return getCoverForCampaign(category, key);
}
