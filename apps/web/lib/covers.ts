import 'server-only';
import { getCoverForCampaign, isCatalogCover, isPlaceholderCover, pickCatalogPhoto } from './photo-catalog';
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

  // A real uploaded cover always wins; a generic placeholder is overridable.
  if (stored && !isPlaceholderCover(stored) && !(pageScope && isCatalogCover(stored))) return stored;

  const baseKey = (seed && seed.trim()) ? seed.trim() : `cat-${category ?? 'charity'}`;
  const key = pageScope ? `${pageScope}-${baseKey}` : baseKey;
  const live = await unsplashCoverForCampaign(category, key);
  if (live) return live.url;

  // ⚠️ Step 3 used to be `getCoverForCampaign` — GENERATED ART, not a photo.
  // Since UNSPLASH_ACCESS_KEY is unset in production, step 2 always returns
  // null, so step 3 was what every campaign actually rendered. That is why the
  // whole site showed coloured blocks with titles printed across them.
  //
  // The verified themed catalog is consulted first now. Generated art survives
  // only as the last resort, for a category with no pool at all.
  return pickCatalogPhoto(category, key) ?? getCoverForCampaign(category, key);
}
