import 'server-only';
import { supabasePublic } from './supabase';
// ⚠️ Anon key, not service role. `grants` is public data — RLS grants
// SELECT on it, and anon returns the same rows service role does (180,
// verified during the outage that revoked the sb_secret_ key and took every
// supabasePublic read down). Reading public data with the public key keeps this
// listing alive when that credential breaks. Nothing here counts donations or
// touches owner-scoped rows, which is the line supabasePublic must not cross.
import { boundedQuery } from './query-timeout';
import { GRANT_PUBLIC_COLUMNS, GRANT_DETAIL_COLUMNS, type Grant } from './grants';
import { sanitizeDemoRow, sanitizeDemoRowAll } from './demo-trust';

// Server-side grant reads for React Server Components (initial page render).

export async function getPublicGrants(limit = 24): Promise<Grant[]> {
  const { data, error } = await boundedQuery(() =>
  supabasePublic
      .from('grants')
      .select(GRANT_PUBLIC_COLUMNS)
      .is('deleted_at', null)
      .in('status', ['open', 'upcoming'])
      .order('verified', { ascending: false })
      .order('deadline_at', { ascending: true, nullsFirst: false })
      .limit(limit),
  );
  if (error) return [];
  // Demo rows must never render a fabricated "Verified" badge — see lib/demo-trust.ts.
  return sanitizeDemoRowAll((data ?? []) as unknown as Grant[]);
}

export async function getGrantBySlug(slug: string): Promise<Grant | null> {
  const { data, error } = await supabasePublic
    .from('grants')
    .select(GRANT_DETAIL_COLUMNS)
    .eq('slug', slug)
    .is('deleted_at', null)
    .in('status', ['open', 'upcoming'])
    .maybeSingle();
  if (error || !data) return null;
  return sanitizeDemoRow(data as unknown as Grant);
}

export interface GrantDeadline {
  id: string;
  label: string;
  kind: string;
  due_at: string;
}

export async function getGrantDeadlines(grantId: string): Promise<GrantDeadline[]> {
  const { data } = await supabasePublic
    .from('grant_deadlines')
    .select('id, label, kind, due_at')
    .eq('grant_id', grantId)
    .order('due_at', { ascending: true });
  return (data ?? []) as GrantDeadline[];
}

/** Distinct categories present among live grants, for filter chips. */
export async function getGrantCategories(): Promise<string[]> {
  const { data } = await supabasePublic
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
