import 'server-only';
import { type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { campaignColumns, applyLiveFilters } from '../../../../lib/campaign-visibility';
import { requireApiKey, readPaging, apiList } from '../../../../lib/api-auth';

export const dynamic = 'force-dynamic';

// GET /api/v1/campaigns — the caller's own campaigns.
//
// ⚠️ Scoped to `owner_id`, NOT the whole platform. An API key authenticates a
// PERSON, so the obvious-looking "list campaigns" endpoint that returns every
// campaign would turn a read scope into a platform-wide data export. Public
// discovery already exists, unauthenticated, at /campaigns — this endpoint is
// deliberately the narrower thing.
//
// `applyLiveFilters` is still applied so a soft-deleted campaign does not
// resurface through the API after being removed from the site.

export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request, 'campaigns:read');
  if (!auth.ok) return auth.response;

  const paging = readPaging(request);
  const cols = await campaignColumns();

  const { data, error, count } = await applyLiveFilters(
    supabaseAdmin
      .from('campaigns')
      .select(
        'id, slug, title, tagline, category, status, goal_amount, raised_amount, backer_count, created_at',
        { count: 'exact' },
      ),
    cols,
  )
    .eq('user_id', auth.ctx.ownerId)
    .order('created_at', { ascending: false })
    .range(paging.offset, paging.offset + paging.limit - 1);

  if (error) {
    return apiList([], paging, null);
  }

  // Amounts are cents everywhere in this schema. Named `_cents` on the wire so an
  // integrator cannot mistake 5000 for fifty dollars — the single most likely
  // integration bug, and one that only shows up in production.
  const out = (data ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    tagline: c.tagline,
    category: c.category,
    status: c.status,
    goal_amount_cents: c.goal_amount,
    raised_amount_cents: c.raised_amount,
    backer_count: c.backer_count,
    created_at: c.created_at,
    url: `https://www.charitme.com/campaigns/${c.slug}`,
  }));

  return apiList(out, paging, count ?? null);
}
