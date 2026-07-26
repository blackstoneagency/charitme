import { cache } from 'react';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '../../../lib/supabase';

// Memoized per-request. layout.tsx, generateMetadata and the page all call this,
// and React cache() dedupes them to a single query on the highest-traffic public
// page — so the layout's existence gate below costs no extra round-trip.
export const getCampaign = cache(async (slug: string) => {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('*, profiles:user_id (full_name, avatar_url)')
    .eq('slug', slug)
    .single();
  return data;
});

/**
 * Existence gate used by the campaign detail layout: raises Next's not-found
 * signal when the slug has no campaign, and returns normally when it does.
 *
 * Lives here (a plain .ts module) rather than inline in layout.tsx so the
 * decision is unit-testable without rendering a server component — see
 * `__tests__/campaign-existence-gate.test.ts`. That matters because this sits
 * on the donation path: the "missing → 404" half is verifiable from a local
 * build, but "real campaign → renders" otherwise rests on reasoning alone.
 */
export async function assertCampaignExists(slug: string): Promise<void> {
  if (!(await getCampaign(slug))) notFound();
}
