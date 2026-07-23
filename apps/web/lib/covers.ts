import 'server-only';
import { getCoverForCampaign } from './photo-catalog';
import { unsplashCoverForCampaign } from './unsplash';

/**
 * Picsum URLs are *placeholder* covers — assigned by the backfill migration or by
 * `getCoverForCampaign` as a code-level default, not uploaded by an organizer. A
 * themed live Unsplash photo should be allowed to override them, whereas a real
 * uploaded cover must always win.
 */
export function isPlaceholderCover(url: string): boolean {
  return /(?:\/\/|\.)picsum\.photos\//i.test(url);
}

/**
 * Resolve the best cover image URL for a campaign, server-side. Order of
 * preference:
 *   1. the campaign's own *real* uploaded `cover_image_url`,
 *   2. a themed, unique live Unsplash photo (only when UNSPLASH_ACCESS_KEY is set),
 *   3. the stored Picsum placeholder (if any), else the deterministic Picsum cover.
 *
 * A Picsum placeholder does NOT short-circuit step 2 — that's how live Unsplash
 * covers replace the backfilled placeholders once a key is configured. Every
 * branch returns a valid URL, so callers never need their own fallback. The
 * `seed` should be the campaign's stable slug/id so the chosen photo is
 * consistent across renders and distinct between campaigns.
 */
export async function resolveCampaignCover(
  storedCover: string | null | undefined,
  category: string | null | undefined,
  seed: string | null | undefined,
): Promise<string> {
  const stored = storedCover?.trim() || '';

  // A real uploaded cover always wins; a Picsum placeholder is overridable.
  if (stored && !isPlaceholderCover(stored)) return stored;

  const key = (seed && seed.trim()) ? seed.trim() : `cat-${category ?? 'charity'}`;
  const live = await unsplashCoverForCampaign(category, key);
  if (live) return live.url;

  // No live photo available — keep the stored placeholder if we had one (stable),
  // otherwise fall back to a deterministic Picsum cover keyed on the seed.
  return stored || getCoverForCampaign(category, key);
}
