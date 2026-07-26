// Serve right-sized, modern-format cover images from the external hosts we use,
// without touching genuine user uploads. Campaign covers are stored at 800×600
// (Lorem Picsum) or as Unsplash URLs; discovery cards render far smaller, so we
// rewrite the URL to request a card-sized WebP (~75% fewer bytes). Anything we
// don't recognize (Supabase Storage uploads, data URIs, LoremFlickr, etc.) is
// returned unchanged. Pure + unit-tested.

/**
 * Rewrite a known cover URL to a `width`-sized WebP. `width` is the intended CSS
 * width; the height keeps the 4:3 source aspect. Returns the input unchanged for
 * empty values or unrecognized hosts.
 */
export function optimizedCoverUrl(url: string | null | undefined, width = 640): string {
  if (!url || typeof url !== 'string') return url ?? '';
  const w = Math.min(1600, Math.max(160, Math.round(width)));
  const h = Math.round(w * 0.75); // covers are 4:3

  // Lorem Picsum: https://picsum.photos/id/<N>/<W>/<H>[.ext][?q]  (also /seed/<S>/…)
  const pic = url.match(/^(https:\/\/picsum\.photos\/(?:id\/\d+|seed\/[^/]+))\/\d+\/\d+(?:\.\w+)?(\?.*)?$/);
  if (pic) return `${pic[1]}/${w}/${h}.webp${pic[2] ?? ''}`;

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
