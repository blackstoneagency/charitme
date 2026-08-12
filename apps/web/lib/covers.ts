import 'server-only';
import {
  getCoverForCampaign,
  isCatalogCover,
  isPlaceholderCover,
  pickCatalogPhoto,
} from './photo-catalog';
import { unsplashCoverForCampaign } from './unsplash';

export { isPlaceholderCover } from './photo-catalog';

/**
 * Resolve the best cover image URL for a campaign, server-side. Real organizer
 * uploads and persisted campaign photographs always win. Generated placeholders
 * may be replaced by a live themed photo or the verified static catalog.
 */
export async function resolveCampaignCover(
  storedCover: string | null | undefined,
  category: string | null | undefined,
  seed: string | null | undefined,
  pageScope?: string,
): Promise<string> {
  const stored = storedCover?.trim() || '';

  if (stored && !isPlaceholderCover(stored) && !isCatalogCover(stored)) return stored;

  const baseKey = seed?.trim() || `cat-${category ?? 'charity'}`;
  const key = pageScope ? `${pageScope}-${baseKey}` : baseKey;
  const live = await unsplashCoverForCampaign(category, key);
  if (live) return live.url;

  return pickCatalogPhoto(category, key) ?? getCoverForCampaign(category, key);
}
