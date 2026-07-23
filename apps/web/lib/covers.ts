import 'server-only';
import { getCoverForCampaign } from './photo-catalog';
import { unsplashCoverForCampaign } from './unsplash';

/**
 * Resolve the best cover image URL for a campaign, server-side. Order of
 * preference:
 *   1. the campaign's own stored `cover_image_url` (a real uploaded photo),
 *   2. a themed, unique live Unsplash photo (only when UNSPLASH_ACCESS_KEY is set),
 *   3. the deterministic Picsum cover from photo-catalog (always available).
 *
 * Every branch returns a valid URL, so callers never need their own fallback.
 * The `seed` should be the campaign's stable slug/id so the chosen photo is
 * consistent across renders and distinct between campaigns.
 */
export async function resolveCampaignCover(
  storedCover: string | null | undefined,
  category: string | null | undefined,
  seed: string | null | undefined,
): Promise<string> {
  const stored = storedCover?.trim();
  if (stored) return stored;

  const key = (seed && seed.trim()) ? seed.trim() : `cat-${category ?? 'charity'}`;
  const live = await unsplashCoverForCampaign(category, key);
  if (live) return live.url;

  return getCoverForCampaign(category, key);
}
