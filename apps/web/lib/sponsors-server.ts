import 'server-only';
import { supabaseAdmin } from './supabase';
import type { Sponsor } from './sponsors-core';

/**
 * Public partner/sponsor reader.
 *
 * `sponsors` had an admin CRUD (`/api/admin/sponsors`) and a public endpoint
 * (`/api/sponsors`) with **no public consumer at all** — an administrator could
 * add a partner and it would appear nowhere on the site. This is the reader that
 * makes that surface reachable, on `/partner`.
 *
 * Read directly rather than through `/api/sponsors`: `/partner` is a server
 * component, so fetching our own HTTP endpoint would add a round-trip and lose
 * the error distinction below.
 */
export async function getPublicSponsors(limit = 60): Promise<Sponsor[] | null> {
  try {
    // `supabaseAdmin` is a Proxy whose `get` trap THROWS when the env vars are
    // missing, so `.from(...)` throws before any query runs — which an
    // `if (error)` check cannot see. The `null` contract below was already
    // right; this just makes a throw take the same path instead of 500ing
    // the page.
  const { data, error } = await supabaseAdmin
    .from('sponsors')
    .select('id, name, logo_url, website')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    // `null` means the read FAILED — deliberately NOT conflated with "there are
    // no partners yet". `/api/sponsors` returns `{ sponsors: [] }` on error, so
    // there a database problem is indistinguishable from an empty roster. On a
    // partnerships page those render as opposite claims: "we have no partners"
    // versus "we could not load them".
    console.warn('[sponsors] read failed', { code: error.code });
    return null;
  }
  return (data ?? []) as Sponsor[];
  } catch {
    return null;
  }
}
