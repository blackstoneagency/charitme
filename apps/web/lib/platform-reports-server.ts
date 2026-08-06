import 'server-only';
import { supabaseAdmin } from './supabase';
import type { PlatformReport } from './platform-reports-core';

/**
 * Published platform reports.
 *
 * ⚠️ **Tolerates the table not existing.** `20260826000000_platform_reports.sql`
 * is written but applied by the owner, so every environment that has not run it
 * yet answers PostgREST `42P01` (undefined relation). That is treated as "no
 * reports published", not as an error — the section renders nothing before the
 * migration lands and lights up the moment it does, with no second deploy.
 *
 * Any OTHER error is a real read failure and returns `null`, which the caller
 * must not conflate with an empty list: on a transparency page those are
 * opposite claims.
 */
export async function getPublishedReports(limit = 24): Promise<PlatformReport[] | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_reports')
      .select('id, title, kind, period_label, summary, file_path, byte_size, published_at')
      .eq('published', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      // The migration has not been applied here. Not a failure.
      if (error.code === '42P01') return [];
      console.warn('[platform-reports] read failed', { code: error.code });
      return null;
    }
    return (data ?? []) as PlatformReport[];
  } catch {
    // supabaseAdmin throws on property access when its env is unset, which
    // `if (error)` cannot catch.
    return null;
  }
}

/**
 * Public URL for a stored report.
 *
 * Returns `null` rather than a guessed URL when the path is missing, so a card
 * with no file renders as text instead of a Download button that 404s.
 */
export function reportDownloadUrl(filePath: string | null): string | null {
  const path = filePath?.trim();
  if (!path) return null;
  try {
    return supabaseAdmin.storage.from('reports').getPublicUrl(path).data.publicUrl || null;
  } catch {
    return null;
  }
}
