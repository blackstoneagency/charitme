import 'server-only';
import { supabaseAdmin } from './supabase';
import { boundedQuery } from './query-timeout';
import {
  OPPORTUNITY_PUBLIC_COLUMNS,
  OPPORTUNITY_DETAIL_COLUMNS,
  type VolunteerOpportunity,
} from './volunteers';
import { suppressDemoTrust, suppressDemoTrustAll } from './demo-trust';

// Server-side reads for React Server Components.

export async function getPublicOpportunities(limit = 24): Promise<VolunteerOpportunity[]> {
  const { data, error } = await boundedQuery(
  supabaseAdmin
      .from('volunteer_opportunities')
      .select(OPPORTUNITY_PUBLIC_COLUMNS)
      .is('deleted_at', null)
      .in('status', ['open', 'upcoming'])
      .order('verified', { ascending: false })
      .order('starts_at', { ascending: true, nullsFirst: false })
      .limit(limit),
  );
  if (error) return [];
  // Demo rows must never render a fabricated "Verified" badge — see lib/demo-trust.ts.
  return suppressDemoTrustAll((data ?? []) as unknown as VolunteerOpportunity[]);
}

export async function getOpportunityBySlug(slug: string): Promise<VolunteerOpportunity | null> {
  const { data, error } = await supabaseAdmin
    .from('volunteer_opportunities')
    .select(OPPORTUNITY_DETAIL_COLUMNS)
    .eq('slug', slug)
    .is('deleted_at', null)
    .in('status', ['open', 'upcoming'])
    .maybeSingle();
  if (error || !data) return null;
  return suppressDemoTrust(data as unknown as VolunteerOpportunity);
}

export async function getVolunteerCategories(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('volunteer_opportunities')
    .select('category')
    .is('deleted_at', null)
    .in('status', ['open', 'upcoming'])
    .not('category', 'is', null)
    .limit(500);
  const set = new Set<string>();
  for (const row of (data ?? []) as { category: string | null }[]) {
    if (row.category) set.add(row.category);
  }
  return [...set].sort();
}
