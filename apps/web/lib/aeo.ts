import 'server-only';
import { supabaseAdmin } from './supabase';
import { normalizePublicRoute } from './public-route-policy';

export interface PublicAeoEntry {
  question: string;
  answer: string;
  topic: string | null;
  schema_type: 'FAQPage' | 'QAPage' | 'HowTo';
  route: string;
}

export interface PublicFaq extends PublicAeoEntry {
  schema_type: 'FAQPage';
}

const DYNAMIC_PARENT_ROUTE = /^\/(campaigns|blog|events|features|grants|impact|matching|sponsor|volunteer)\/[^/]+$/;

export function normalizeAeoRoute(route: string | null | undefined): string {
  return normalizePublicRoute(route) ?? '/faq';
}

/** Return the public collection route whose published answers apply to a detail page. */
export function getAeoFallbackRoute(route: string): string | null {
  const match = DYNAMIC_PARENT_ROUTE.exec(normalizeAeoRoute(route));
  return match ? `/${match[1]}` : null;
}

/** Published, route-specific entries used by public pages and their schema. */
export async function getPublishedAeoEntries(route: string, schemaType?: PublicAeoEntry['schema_type'], limit = 100): Promise<PublicAeoEntry[]> {
  const normalizedRoute = normalizeAeoRoute(route);
  const fallbackRoute = getAeoFallbackRoute(normalizedRoute);

  async function readPublishedEntries(entryRoute: string): Promise<PublicAeoEntry[]> {
    let query = supabaseAdmin
      .from('aeo_entries')
      .select('question, answer, topic, schema_type, route')
      .eq('published', true)
      .eq('route', entryRoute)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (schemaType) query = query.eq('schema_type', schemaType);
    const { data } = await query;
    return (data ?? []) as PublicAeoEntry[];
  }

  const exactEntries = await readPublishedEntries(normalizedRoute);
  return exactEntries.length > 0 || !fallbackRoute
    ? exactEntries
    : readPublishedEntries(fallbackRoute);
}

/**
 * Published answer-engine entries for the public FAQ / AEO surface.
 * `aeo_entries` is service-role only (RLS), so this reads via supabaseAdmin and
 * returns ONLY published rows of the requested schema type. The values are
 * rendered visibly AND emitted as FAQPage JSON-LD so the structured data always
 * matches on-page content (never hidden markup).
 */
export async function getPublishedFaqs(schemaType = 'FAQPage', limit = 100): Promise<PublicFaq[]> {
  if (schemaType !== 'FAQPage') return [];
  return (await getPublishedAeoEntries('/faq', 'FAQPage', limit)) as PublicFaq[];
}

/** Group FAQs by topic for sectioned display; null/empty topics fall under `fallback`. */
export function groupFaqsByTopic(faqs: PublicAeoEntry[], fallback = 'More answers'): { topic: string; items: PublicAeoEntry[] }[] {
  const order: string[] = [];
  const map = new Map<string, PublicAeoEntry[]>();
  for (const f of faqs) {
    const key = (f.topic ?? '').trim() || fallback;
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(f);
  }
  return order.map((topic) => ({ topic, items: map.get(topic)! }));
}
