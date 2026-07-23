import 'server-only';
import { supabaseAdmin } from './supabase';

export interface PublicFaq {
  question: string;
  answer: string;
  topic: string | null;
}

/**
 * Published answer-engine entries for the public FAQ / AEO surface.
 * `aeo_entries` is service-role only (RLS), so this reads via supabaseAdmin and
 * returns ONLY published rows of the requested schema type. The values are
 * rendered visibly AND emitted as FAQPage JSON-LD so the structured data always
 * matches on-page content (never hidden markup).
 */
export async function getPublishedFaqs(schemaType = 'FAQPage', limit = 100): Promise<PublicFaq[]> {
  // Public surface: never let a missing env var or an unreachable DB hard-fail
  // the page render (or a static/ISR build). Degrade gracefully to the
  // hardcoded on-page FAQ content by returning an empty AEO set.
  try {
    const { data } = await supabaseAdmin
      .from('aeo_entries')
      .select('question, answer, topic')
      .eq('published', true)
      .eq('schema_type', schemaType)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data ?? []) as PublicFaq[];
  } catch {
    return [];
  }
}

/** Group FAQs by topic for sectioned display; null/empty topics fall under `fallback`. */
export function groupFaqsByTopic(faqs: PublicFaq[], fallback = 'More answers'): { topic: string; items: PublicFaq[] }[] {
  const order: string[] = [];
  const map = new Map<string, PublicFaq[]>();
  for (const f of faqs) {
    const key = (f.topic ?? '').trim() || fallback;
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(f);
  }
  return order.map((topic) => ({ topic, items: map.get(topic)! }));
}
