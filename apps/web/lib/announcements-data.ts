import 'server-only';
import { unstable_cache } from 'next/cache';
import { supabaseAdmin } from './supabase';

export type Announcement = {
  id: string;
  title: string;
  body: string | null;
  level: 'info' | 'success' | 'warning' | 'critical';
  link_url: string | null;
  link_label: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

// Cached fetch of active announcements. Wrapped in unstable_cache so rendering it
// in the (static) root layout does NOT opt the whole app into dynamic rendering —
// the result is cached and revalidated every 60s (ISR), keeping pages statically
// generated while still surfacing the banner in the initial HTML (no post-load
// layout shift). The window filter is applied at read time against the cached rows.
const fetchActiveAnnouncements = unstable_cache(
  async (): Promise<Announcement[]> => {
    const { data } = await supabaseAdmin
      .from('announcements')
      .select('id, title, body, level, link_url, link_label, starts_at, ends_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(5);
    return (data ?? []) as Announcement[];
  },
  ['active-announcements'],
  { revalidate: 60, tags: ['announcements'] },
);

/** Active, in-window announcements for the site-wide banner (cached, ISR-safe). */
export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const nowIso = new Date().toISOString();
  const rows = await fetchActiveAnnouncements();
  return rows.filter((a) => {
    const startsOk = !a.starts_at || a.starts_at <= nowIso;
    const endsOk = !a.ends_at || a.ends_at >= nowIso;
    return startsOk && endsOk;
  });
}
