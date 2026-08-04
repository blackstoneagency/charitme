import 'server-only';
import { getRouteFaqs } from './route-faqs';
import type { PublicAeoEntry } from './aeo';

/**
 * The FAQ block on /how-it-works.
 *
 * ⚠️ Real rows from `aeo_entries`, not authored-in-JSX copy — the same table
 * `/faq` renders, so an answer edited in the admin console changes both surfaces
 * instead of drifting apart.
 *
 * The route itself only has ONE published entry and the design shows five, so
 * the list is topped up from `/faq` and deduped. That logic now lives in
 * `lib/route-faqs.ts`, shared with `/contact`, rather than being written out
 * once per page — two copies of a deduping rule is two rules.
 */
export async function getHowItWorksFaqs(limit = 5): Promise<PublicAeoEntry[]> {
  return getRouteFaqs('/how-it-works', limit);
}
