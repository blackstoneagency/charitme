import { notFound } from 'next/navigation';
import { cache } from 'react';
import { supabaseAdmin } from '../../../../../lib/supabase';

// Shared, React-cache()d lookup so the layout gate, generateMetadata and the page
// body issue ONE query between them. Split out of page.tsx for the same reason
// `get-campaign.ts` is split out: the existence gate has to live in a layout, and
// a layout cannot import from a page module.

export interface PeerPage {
  id: string;
  slug: string;
  title: string;
  goal_amount: number;
  raised_amount: number;
  status: string;
  fundraiser_id: string;
  parent_campaign_id: string;
}

export interface PeerPageData {
  campaign: {
    id: string;
    slug: string;
    title: string;
    tagline: string | null;
    cover_image_url: string | null;
    status: string;
    visibility: string;
    goal_amount: number;
    raised_amount: number;
    user_id: string;
  };
  peer: PeerPage;
  profile: { full_name: string | null; avatar_url: string | null } | null;
}

export const getPeerPage = cache(
  async (campaignSlug: string, peerSlug: string): Promise<PeerPageData | null> => {
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, slug, title, tagline, cover_image_url, status, visibility, goal_amount, raised_amount, user_id')
      .eq('slug', campaignSlug)
      .is('deleted_at', null)
      .maybeSingle();
    if (!campaign) return null;

    const { data: peer } = await supabaseAdmin
      .from('peer_fundraisers')
      .select('id, slug, title, goal_amount, raised_amount, status, fundraiser_id, parent_campaign_id')
      .eq('slug', peerSlug)
      // Scoped to the campaign in the URL. `slug` is unique platform-wide, so
      // without this a peer page would render under ANY campaign's slug — the
      // same page at a dozen wrong URLs, each pointing its donate button at a
      // campaign the supporter never signed up to raise for.
      .eq('parent_campaign_id', campaign.id)
      .maybeSingle();
    if (!peer) return null;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', (peer as PeerPage).fundraiser_id)
      .maybeSingle();

    return {
      campaign: campaign as PeerPageData['campaign'],
      peer: peer as PeerPage,
      profile: (profile as PeerPageData['profile']) ?? null,
    };
  },
);

/**
 * Existence gate, called from the LAYOUT.
 *
 * `app/campaigns/[slug]/loading.tsx` puts a Suspense boundary around everything
 * below it, including this nested route, so Next commits HTTP 200 and streams
 * the skeleton before the page body runs. A `notFound()` in the page then
 * renders the right UI under the wrong status — a soft 404, which crawlers
 * index as a real page. The identical bug has been fixed on seven other routes
 * in this repo, always the same way: assert in a layout, which renders outside
 * the boundary.
 */
export async function assertPeerPageExists(campaignSlug: string, peerSlug: string): Promise<void> {
  if (!(await getPeerPage(campaignSlug, peerSlug))) notFound();
}
