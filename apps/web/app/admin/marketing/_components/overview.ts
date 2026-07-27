import 'server-only';
import { supabaseAdmin } from '../../../../lib/supabase';

export async function getMarketingOverview() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [contactsRes, typesRes, eventsRes, campaignsRes, segmentsRes, unsubRes] = await Promise.all([
    supabaseAdmin.from('marketing_contacts').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('marketing_contacts').select('client_type').limit(2000),
    supabaseAdmin.from('marketing_events').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    supabaseAdmin.from('marketing_campaigns').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
    supabaseAdmin.from('marketing_segments').select('name, member_count').order('member_count', { ascending: false }).limit(7),
    supabaseAdmin.from('marketing_contacts').select('id', { count: 'exact', head: true }).eq('status', 'unsubscribed'),
  ]);

  const byType: Record<string, number> = {};
  for (const c of typesRes.data ?? []) byType[c.client_type] = (byType[c.client_type] ?? 0) + 1;

  // `null` means the count could not be read, which is not the same statement as
  // 0. supabase-js resolves rather than throws on a query error, so `?? 0` turned
  // an unreadable table into a confident zero. "Unsubscribed: 0" is the
  // favourable answer a marketing operator would act on, and "Total contacts: 0"
  // reads as a wiped audience — neither should be shown without a measurement.
  const count = (r: { count: number | null; error: unknown }): number | null =>
    r.error ? null : r.count;

  return {
    contacts: count(contactsRes),
    byType,
    events7d: count(eventsRes),
    campaignsSent: count(campaignsRes),
    topSegments: segmentsRes.data ?? [],
    unsubscribed: count(unsubRes),
  };
}
