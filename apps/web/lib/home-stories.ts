import 'server-only';
import { supabaseAdmin } from './supabase';
import { boundedQuery } from './query-timeout';
import { campaignColumns, applyVisibilityFilters } from './campaign-visibility';
import type { CauseStory } from './cause-landing';

/**
 * "Stories that inspire hope" on the homepage — the platform's genuinely
 * COMPLETED campaigns, biggest first.
 *
 * ⚠️ The reference draws this band as video cards, each with a start-media
 * control over a photo. Nothing here can be started. `campaign_media` has no
 * playable video: its video rows point at reserved `.example` hosts, which are
 * unresolvable by construction (RFC 2606). A control that looks like it starts
 * a film and instead navigates to a campaign page is a fake affordance, so the
 * cards link and are labelled as reading, not watching.
 *
 * This is the same shape and the same rule as `getCauseStories`, which does it
 * per-cause; the difference is only the absence of a category filter. The row
 * mapping is shared with it rather than written twice.
 *
 * `null` means the read FAILED. `[]` means there are genuinely no completed
 * campaigns yet. The band renders nothing for either, but conflating them in
 * the loader would make a database outage indistinguishable from a young
 * platform for anything that reads this later.
 */
export async function getHomeStories(limit = 3): Promise<CauseStory[] | null> {
  try {
    const cols = await campaignColumns();
    // Bounded, like every other homepage read: a stalled database must render
    // the page without this band rather than hold the whole page open.
    const { data, error } = await boundedQuery(() =>
      applyVisibilityFilters(
        supabaseAdmin
          .from('campaigns')
          .select('id, slug, title, tagline, description, category, cover_image_url, raised_amount, backer_count'),
        cols,
      )
        // `status` is set here rather than by `applyLiveFilters`, which pins
        // `status = 'active'` — the opposite of what this reads. Visibility is
        // still applied, so a completed campaign the owner has since made
        // private does not reappear as a public "story".
        .eq('status', 'completed')
        .is('deleted_at', null)
        .order('raised_amount', { ascending: false })
        .limit(limit),
    );
    if (error) return null;

    return (data ?? []).map((c) => ({
      id: c.id as string,
      slug: c.slug as string,
      title: c.title as string,
      blurb: ((c.tagline as string | null) ?? (c.description as string | null) ?? null),
      category: (c.category as string | null) ?? null,
      cover: (c.cover_image_url as string | null) ?? null,
      raisedCents: Number(c.raised_amount ?? 0),
      backers: Number(c.backer_count ?? 0),
    }));
  } catch {
    // `supabaseAdmin` throws on property access when the env is missing, before
    // any query runs, which no `error` check can see.
    return null;
  }
}
