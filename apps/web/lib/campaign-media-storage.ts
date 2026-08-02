import 'server-only';
import { cache } from 'react';
import { supabaseAdmin } from './supabase';

/**
 * Real uploaded campaign imagery, read from our OWN storage bucket.
 *
 * ⚠️ Finding, 2026-08-02: the public `campaign-media` bucket contains **500
 * uploaded WebP covers** under `covers/<slug>.webp` — verified reachable, ~35KB
 * each — while every row in `campaigns.cover_image_url` points at
 * `picsum.photos`. So the site renders a generic placeholder for every campaign
 * while a real, optimised, campaign-specific image sits unused in our own bucket.
 *
 * `lib/covers.ts` cannot find these: its preference order is stored URL → live
 * Unsplash → Picsum, and it never looks in storage. Rewiring that resolver
 * changes the cover on every card and every listing site-wide, so it is NOT done
 * here as a side effect of building a gallery — it is recorded in todo.md as its
 * own change. This module is the read side, used by the gallery only.
 */

const BUCKET = 'campaign-media';

/**
 * Does `covers/<slug>.webp` actually exist?
 *
 * A `search` on the folder rather than a full listing: the folder holds 500
 * entries and the answer needed is about one of them. Memoised per request
 * because a page may ask more than once.
 *
 * Returns null on ANY failure — a storage outage must not be reported as "this
 * campaign has no cover".
 */
export const uploadedCoverUrl = cache(async (slug: string): Promise<string | null> => {
  const file = `${slug}.webp`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list('covers', {
    limit: 1,
    search: file,
  });
  if (error) {
    console.warn('[campaign-media] cover lookup failed', { message: error.message });
    return null;
  }
  // `search` is a prefix/substring match, so confirm the exact name before
  // claiming this file is the campaign's — `campaign-1` would otherwise match
  // `campaign-10`, and every campaign would show its neighbour's photo.
  if (!data?.some((f) => f.name === file)) return null;
  return supabaseAdmin.storage.from(BUCKET).getPublicUrl(`covers/${file}`).data.publicUrl;
});

export interface StoredMediaFile {
  name: string;
  url: string;
  sizeBytes: number | null;
  mimeType: string | null;
}

/**
 * Files uploaded under `campaigns/<campaignId>/…`.
 *
 * Returns `null` on failure, `[]` when the campaign genuinely has no uploads.
 * The two must stay distinguishable: one is our outage, the other is a normal
 * state for a campaign that never uploaded anything.
 */
export const uploadedCampaignFiles = cache(async (campaignId: string): Promise<StoredMediaFile[] | null> => {
  const prefix = `campaigns/${campaignId}`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(prefix, { limit: 100 });
  if (error) {
    console.warn('[campaign-media] file listing failed', { message: error.message });
    return null;
  }
  return (data ?? [])
    // A "folder" comes back with a null id and no metadata; only real objects
    // have one. Without this the gallery renders directory names as images.
    .filter((f) => f.id !== null)
    .map((f) => ({
      name: f.name,
      url: supabaseAdmin.storage.from(BUCKET).getPublicUrl(`${prefix}/${f.name}`).data.publicUrl,
      sizeBytes: (f.metadata as { size?: number } | null)?.size ?? null,
      mimeType: (f.metadata as { mimetype?: string } | null)?.mimetype ?? null,
    }));
});
