/**
 * Pure planning for campaign photo assignment.
 *
 * Extracted from `assign-campaign-photos.mjs` so the property that actually
 * matters — every campaign gets a DIFFERENT photo — can be tested at production
 * scale (502 campaigns, 18 categories) without a network, a key, or a database.
 *
 * The whole reason this is a batch plan rather than a per-campaign lookup: a
 * function that sees one campaign cannot make the set distinct. Hashing a seed
 * into a themed pool was measured at 222 duplicate covers across 502 campaigns.
 */

/**
 * Is this cover generated art (replaceable) rather than an organizer upload?
 *
 * Three shapes count as generated:
 *   · nothing at all,
 *   · the generic external placeholders an older backfill wrote
 *     (picsum / loremflickr),
 *   · first-party `/media/subject` cards drawn by next/og.
 *
 * Everything else is treated as somebody's real upload and is never touched.
 */
export function isGeneratedCover(url) {
  if (!url) return true;
  if (/(?:picsum\.photos|loremflickr\.com)/i.test(url)) return true;
  try {
    return new URL(url, 'https://www.charitme.com').pathname === '/media/subject';
  } catch {
    return false;
  }
}

/**
 * Assign each campaign one distinct photo from its category's pool.
 *
 * `campaigns` must already be in a stable order (created_at ascending) — the
 * ordinal within a category is what makes a re-run assign the same campaign the
 * same photo instead of reshuffling every cover on the site.
 *
 * Returns `{ assignments, shortfall }`. A category with fewer photos than
 * campaigns is reported in `shortfall` and contributes NO assignments, because a
 * partial assignment is how duplicates survive a run that looks successful.
 */
export function planAssignments(campaigns, poolsByCategory) {
  const byCategory = new Map();
  for (const c of campaigns) {
    const key = c.category || 'Uncategorized';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(c);
  }

  const assignments = [];
  const shortfall = [];
  for (const [category, list] of byCategory) {
    const pool = poolsByCategory.get(category) ?? [];
    if (pool.length < list.length) {
      shortfall.push({ category, campaigns: list.length, photos: pool.length });
      continue;
    }
    list.forEach((campaign, i) => assignments.push({ campaign, photo: pool[i] }));
  }
  return { assignments, shortfall };
}

/**
 * Is the plan safe to write?
 *
 * Distinctness is checked on the photo URL rather than the id, because the URL
 * is what lands in `cover_image_url` and is what a visitor would see repeat.
 */
export function planIsDistinct(assignments) {
  const urls = new Set(assignments.map((a) => a.photo.url));
  return urls.size === assignments.length;
}
