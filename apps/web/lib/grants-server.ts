import 'server-only';
import { supabaseAdmin } from './supabase';
import { boundedQuery } from './query-timeout';
import { GRANT_PUBLIC_COLUMNS, GRANT_DETAIL_COLUMNS, type Grant } from './grants';

// Server-side grant reads for React Server Components (initial page render).

export async function getPublicGrants(limit = 24): Promise<Grant[]> {
  const { data, error } = await boundedQuery(
  supabaseAdmin
      .from('grants')
      .select(GRANT_PUBLIC_COLUMNS)
      .is('deleted_at', null)
      .in('status', ['open', 'upcoming'])
      .order('verified', { ascending: false })
      .order('deadline_at', { ascending: true, nullsFirst: false })
      .limit(limit),
  );
  if (error) return [];
  return (data ?? []) as unknown as Grant[];
}

export async function getGrantBySlug(slug: string): Promise<Grant | null> {
  const { data, error } = await supabaseAdmin
    .from('grants')
    .select(GRANT_DETAIL_COLUMNS)
    .eq('slug', slug)
    .is('deleted_at', null)
    .in('status', ['open', 'upcoming'])
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as Grant;
}

export interface GrantDeadline {
  id: string;
  label: string;
  kind: string;
  due_at: string;
}

export async function getGrantDeadlines(grantId: string): Promise<GrantDeadline[]> {
  const { data } = await supabaseAdmin
    .from('grant_deadlines')
    .select('id, label, kind, due_at')
    .eq('grant_id', grantId)
    .order('due_at', { ascending: true });
  return (data ?? []) as GrantDeadline[];
}

/** Distinct categories present among live grants, for filter chips. */
export async function getGrantCategories(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('grants')
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
