// Serve right-sized, modern-format cover images without touching genuine user
// uploads. Known generic placeholder providers are replaced defensively with
// first-party subject art even when a caller forgot to run getDisplayCover.

function legacyPlaceholderKey(url: string): string {
  let value = 2166136261;
  for (const char of url) {
    value ^= char.codePointAt(0) ?? 0;
    value = Math.imul(value, 16777619);
  }
  return `legacy-${(value >>> 0).toString(36)}`;
}

/**
 * Rewrite a known cover URL to a `width`-sized WebP. `width` is the intended CSS
 * width; the height keeps the 4:3 source aspect. Returns the input unchanged for
 * empty values or unrecognized hosts.
 */
export function optimizedCoverUrl(url: string | null | undefined, width = 640): string {
  if (!url || typeof url !== 'string') return url ?? '';
  if (/(?:picsum\.photos|loremflickr\.com)/i.test(url)) {
    return `/media/subject?category=Community&key=${legacyPlaceholderKey(url)}`;
  }
  const w = Math.min(1600, Math.max(160, Math.round(width)));
  const h = Math.round(w * 0.75); // covers are 4:3

  // Supabase Storage (where seeded covers now live, IMG-05): the object endpoint
  // always serves the full 1200x900 original, so route through the render/image
  // transformer to get a card-sized variant instead.
  const storage = url.match(/^(https:\/\/[^/]+\/storage\/v1)\/object\/public\/(.+)$/);
  if (storage) {
    const [, base, objectPath] = storage;
    const [pathOnly] = objectPath.split('?');
    return `${base}/render/image/public/${pathOnly}?width=${w}&height=${h}&resize=cover&quality=75`;
  }

  // Unsplash: add sizing + WebP + quality.
  if (url.includes('images.unsplash.com/')) {
    try {
      const u = new URL(url);
      u.searchParams.set('w', String(w));
      u.searchParams.set('fm', 'webp');
      u.searchParams.set('q', '75');
      u.searchParams.set('fit', 'crop');
      u.searchParams.set('auto', 'format');
      return u.toString();
    } catch {
      return url;
    }
  }

  return url;
}
