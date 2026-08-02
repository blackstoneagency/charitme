// ─────────────────────────────────────────────────────────────────────────────
// Pure logic for the campaign media gallery (composite image page 61).
//
// The interesting problem here is NOT layout. It is that `campaign_media` holds
// 500 rows whose `public_url` points at `storage.CharitMe.example` — and
// `.example` is a RESERVED TLD (RFC 2606) that is guaranteed never to resolve,
// anywhere, ever. Those files do not exist and cannot be fetched.
//
// The tempting move is to route them through the site's usual image fallback, so
// a dead URL quietly becomes a stock photo from the catalog. That is right for a
// CARD — a campaign still needs some cover — but it is wrong for a GALLERY, whose
// entire claim is "these are photos from this campaign". Substituting a stock
// photo of strangers under the caption "showing progress and impact" tells the
// donor something false about where their money went.
//
// So unresolvable media is reported as unavailable, with its caption still
// readable, and the gallery says how many items are in that state.
// ─────────────────────────────────────────────────────────────────────────────

export type MediaKind = 'image' | 'video' | 'document';

export interface CampaignMediaRow {
  id: string;
  media_type: string | null;
  public_url: string | null;
  storage_path: string | null;
  caption: string | null;
  alt_text: string | null;
  sort_order: number | null;
  created_at: string;
}

export interface GalleryItem {
  id: string;
  kind: MediaKind;
  /** Non-null only when we believe the file can actually be fetched. */
  url: string | null;
  caption: string | null;
  /** Always a usable string — falls back to the caption, then to a generic. */
  alt: string;
  sortOrder: number;
  /** Why `url` is null, for the UI to explain rather than show a broken frame. */
  unavailableReason: 'unresolvable-host' | 'no-url' | null;
}

/**
 * Hosts that can never resolve, by specification rather than by guess.
 *
 * RFC 2606 reserves .test, .example, .invalid and .localhost precisely so they
 * can be used in documentation and fixtures without ever colliding with a real
 * name. A URL on one of them is not "probably broken" — it is broken by
 * construction, which is what makes this check safe to apply without a network
 * request.
 */
const RESERVED_TLDS = /\.(?:example|invalid|test|localhost)$/i;

export function isUnresolvableHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return RESERVED_TLDS.test(host) || host === 'localhost';
  } catch {
    return true; // not a URL at all
  }
}

/** Anything we do not recognise is treated as a document: it gets a link, not an <img>. */
export function classifyKind(mediaType: string | null): MediaKind {
  const t = (mediaType ?? '').toLowerCase();
  if (t === 'image' || t === 'photo') return 'image';
  if (t === 'video') return 'video';
  return 'document';
}

export function toGalleryItem(row: CampaignMediaRow): GalleryItem {
  const kind = classifyKind(row.media_type);
  const raw = row.public_url?.trim() || '';
  let url: string | null = raw || null;
  let unavailableReason: GalleryItem['unavailableReason'] = null;

  if (!raw) unavailableReason = 'no-url';
  else if (isUnresolvableHost(raw)) unavailableReason = 'unresolvable-host';
  if (unavailableReason) url = null;

  return {
    id: row.id,
    kind,
    url,
    caption: row.caption?.trim() || null,
    // Alt text must never be empty for a MEANINGFUL image. Falling back to the
    // caption is better than a generic string, and better than the empty alt
    // that would make a screen reader skip the item entirely.
    alt: row.alt_text?.trim() || row.caption?.trim() || 'Campaign media',
    sortOrder: row.sort_order ?? 0,
    unavailableReason,
  };
}

/** `sort_order` is the organiser's chosen order; ties fall back to oldest-first. */
export function sortGallery(items: readonly GalleryItem[], rows: readonly CampaignMediaRow[]): GalleryItem[] {
  const createdAt = new Map(rows.map((r) => [r.id, r.created_at]));
  return [...items].sort((a, b) =>
    a.sortOrder - b.sortOrder ||
    (createdAt.get(a.id) ?? '').localeCompare(createdAt.get(b.id) ?? ''));
}

export type GalleryFilter = 'all' | MediaKind;

export function filterGallery(items: readonly GalleryItem[], filter: GalleryFilter): GalleryItem[] {
  return filter === 'all' ? [...items] : items.filter((i) => i.kind === filter);
}

export interface GalleryCounts {
  all: number;
  image: number;
  video: number;
  document: number;
  /** Items whose file cannot be fetched — surfaced, never hidden. */
  unavailable: number;
}

export function countGallery(items: readonly GalleryItem[]): GalleryCounts {
  return {
    all: items.length,
    image: items.filter((i) => i.kind === 'image').length,
    video: items.filter((i) => i.kind === 'video').length,
    document: items.filter((i) => i.kind === 'document').length,
    unavailable: items.filter((i) => i.unavailableReason !== null).length,
  };
}

/**
 * The campaign's own uploaded cover, promoted into the gallery as its first item.
 *
 * This is the one image on most campaigns that genuinely depicts the campaign and
 * genuinely resolves, so a gallery that omitted it while showing "3 unavailable"
 * would be needlessly bleak. Given a null/placeholder cover it contributes
 * nothing rather than inventing an entry.
 */
export function coverAsGalleryItem(coverUrl: string | null, campaignTitle: string): GalleryItem | null {
  const url = coverUrl?.trim();
  if (!url || isUnresolvableHost(url)) return null;
  return {
    id: 'cover',
    kind: 'image',
    url,
    caption: 'Campaign cover photo',
    alt: `Cover photo for ${campaignTitle}`,
    sortOrder: -1, // always first
    unavailableReason: null,
  };
}
