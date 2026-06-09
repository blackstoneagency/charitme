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

  return {
    contacts: contactsRes.count ?? 0,
    byType,
    events7d: eventsRes.count ?? 0,
    campaignsSent: campaignsRes.count ?? 0,
    topSegments: segmentsRes.data ?? [],
    unsubscribed: unsubRes.count ?? 0,
  };
}
