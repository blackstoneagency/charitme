import 'server-only';
import { getPublishedAeoEntries, type PublicAeoEntry } from './aeo';
import { getCuratedFaqs } from './faq-content';

/**
 * Published FAQ rows for a marketing route, topped up from the general `/faq`
 * collection when the route has fewer of its own than the design shows.
 *
 * Extracted from `lib/how-it-works.ts`, which had exactly this logic, the moment
 * a second page needed it. This repo's recurring failure is the lookalike that
 * drifts — three copies of the category list, five of the public-route list —
 * and a deduping rule that exists twice is a deduping rule that will disagree
 * with itself.
 *
 * The built-in fallback in `getAeoFallbackRoute` does not cover this: it maps a
 * dynamic DETAIL route to its parent collection (`/campaigns/x` → `/campaigns`),
 * and a static marketing route is not one.
 *
 * Returns whatever it has, possibly nothing. An empty list must render no FAQ
 * section at all rather than an empty accordion — a disclosure control with
 * nothing behind it is worse than the absence of the block.
 */
export async function getRouteFaqs(route: string, limit = 5): Promise<PublicAeoEntry[]> {
  const [own, general] = await Promise.all([
    getPublishedAeoEntries(route, 'FAQPage', limit),
    // Wider than `limit` because the top-up is filtered afterwards: asking for
    // exactly `limit` and then dropping duplicates returns short.
    getPublishedAeoEntries('/faq', 'FAQPage', limit * 4),
  ]);

  const seen = new Set(own.map((e) => e.question.trim().toLowerCase()));
  const topUp = general.filter((e) => !seen.has(e.question.trim().toLowerCase()));
  const published = [...own, ...topUp];

  // ⚠️ Top up from the CURATED answers when the store cannot fill the block.
  //
  // Every published `/faq` row in production is a seeder placeholder and is now
  // filtered out in lib/aeo.ts, so without this these blocks render empty on
  // /how-it-works and /contact — pages that had a working FAQ before their
  // content was pointed at the store. The curated set is the site's real
  // answers; admin-published entries still come FIRST, so a genuine entry
  // always outranks the fallback.
  if (published.length >= limit) return published.slice(0, limit);

  const curatedSeen = new Set(published.map((e) => e.question.trim().toLowerCase()));
  const curated = getCuratedFaqs(limit * 4).filter(
    (e) => !curatedSeen.has(e.question.trim().toLowerCase()),
  );
  return [...published, ...curated].slice(0, limit);
}
