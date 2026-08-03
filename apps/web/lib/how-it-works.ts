import 'server-only';
import { getPublishedAeoEntries, type PublicAeoEntry } from './aeo';

/**
 * The FAQ block on /how-it-works.
 *
 * ⚠️ Real rows from `aeo_entries`, not authored-in-JSX copy — the same table
 * `/faq` renders, so an answer edited in the admin console changes both surfaces
 * instead of drifting apart.
 *
 * The route itself only has ONE published entry, and the design shows five. The
 * built-in fallback in `getAeoFallbackRoute` does not help here: it maps a
 * dynamic detail route to its parent collection (`/causes/x` → `/causes`) and
 * `/how-it-works` is not one. So this tops up from `/faq`, which is the general
 * question collection and genuinely applies, and DEDUPES so an entry published
 * against both routes cannot appear twice.
 *
 * Returns whatever it has. An empty list renders no FAQ section at all rather
 * than an empty accordion — a disclosure control with nothing behind it is worse
 * than the absence of the block.
 */
export async function getHowItWorksFaqs(limit = 5): Promise<PublicAeoEntry[]> {
  const [own, general] = await Promise.all([
    getPublishedAeoEntries('/how-it-works', 'FAQPage', limit),
    getPublishedAeoEntries('/faq', 'FAQPage', limit * 4),
  ]);

  const seen = new Set(own.map((e) => e.question.trim().toLowerCase()));
  const topUp = general.filter((e) => !seen.has(e.question.trim().toLowerCase()));
  return [...own, ...topUp].slice(0, limit);
}
