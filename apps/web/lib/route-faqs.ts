import 'server-only';
import { getPublishedAeoEntries, type PublicAeoEntry } from './aeo';

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
  return [...own, ...topUp].slice(0, limit);
}
