import { cache } from 'react';
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
