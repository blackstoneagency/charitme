import { MetadataRoute } from 'next';
import { campaignColumns, applyLiveFilters } from '../lib/campaign-visibility';
import { BLOG_POSTS } from '../lib/blog-posts';
import { PLATFORM_MODULES } from '../lib/feature-catalog';
import { supabaseAdmin } from '../lib/supabase';
import { CHARITME_ORIGIN, INDEXABLE_PUBLIC_ROUTES, publicUrl } from '../lib/public-routes';

export const dynamic = 'force-dynamic';

type SlugRouteRow = { slug: string | null; updated_at: string | null; created_at?: string | null };
type IdRouteRow = { id: string | null; updated_at: string | null; created_at?: string | null };
type ImpactPlanRow = { campaign_id: string | null; updated_at: string | null };
type CampaignRouteRow = { id?: string | null; slug: string | null; updated_at: string | null };
const NON_INDEXABLE_PREFIXES = [
  '/dashboard', '/admin', '/api', '/create', '/login', '/signup', '/forgot-password',
  '/profile', '/donor', '/donors', '/beneficiary', '/achievements', '/privacy-center',
  '/offline', '/go', '/events/manage', '/impact/manage', '/matching/manage', '/sponsor/manage',
];

export function isIndexableSitemapUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.origin !== CHARITME_ORIGIN || url.search || url.hash) return false;
    return !NON_INDEXABLE_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
  } catch {
    return false;
  }
}

export function uniqueSitemapEntries(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (!isIndexableSitemapUrl(entry.url) || seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });
}

function modifiedAt(value: string | null | undefined): Date {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function detailUrl(prefix: string, value: string): string {
  return `${CHARITME_ORIGIN}${prefix}/${encodeURIComponent(value)}`;
}

function hasCampaignId(plan: ImpactPlanRow): plan is ImpactPlanRow & { campaign_id: string } {
  return typeof plan.campaign_id === 'string' && plan.campaign_id.length > 0;
}

function hasSlug<T extends { slug: string | null }>(row: T): row is T & { slug: string } {
  return typeof row.slug === 'string' && row.slug.length > 0;
}

function hasId<T extends { id: string | null }>(row: T): row is T & { id: string } {
  return typeof row.id === 'string' && row.id.length > 0;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = INDEXABLE_PUBLIC_ROUTES.map((route) => ({
    url: publicUrl(route.path),
    priority: route.priority,
    changeFrequency: route.changeFrequency,
    lastModified: new Date(),
  }));

  const blogRoutes = BLOG_POSTS.map(p => ({
    url: `${CHARITME_ORIGIN}/blog/${p.slug}`,
    priority: 0.6,
    changeFrequency: 'monthly' as const,
    lastModified: new Date(`${p.publishedAt}T00:00:00`),
  }));

  const featureRoutes = PLATFORM_MODULES.map(m => ({
    url: `${CHARITME_ORIGIN}/features/${m.slug}`,
    priority: 0.65,
    changeFrequency: 'monthly' as const,
    lastModified: new Date(),
  }));

  const cols = await campaignColumns();
  const { data: campaigns } = await applyLiveFilters(
    supabaseAdmin.from('campaigns').select('id, slug, updated_at'),
    cols,
  )
    .order('raised_amount', { ascending: false })
    .limit(5000);

  const campaignRows = (campaigns ?? []) as CampaignRouteRow[];
  const campaignRoutes = campaignRows.filter(hasSlug).map(c => ({
    url: detailUrl('/campaigns', c.slug),
    priority: 0.7,
    changeFrequency: 'daily' as const,
    lastModified: modifiedAt(c.updated_at),
  }));

  const { data: events } = await supabaseAdmin
    .from('fundraising_events')
    .select('slug, updated_at, created_at')
    .in('status', ['published', 'completed'])
    .order('starts_at', { ascending: true })
    .limit(5000);

  const eventRoutes = ((events ?? []) as SlugRouteRow[]).filter(hasSlug).map((event) => ({
    url: detailUrl('/events', event.slug),
    priority: 0.64,
    changeFrequency: 'weekly' as const,
    lastModified: modifiedAt(event.updated_at ?? event.created_at),
  }));

  const { data: grants } = await supabaseAdmin
    .from('grants')
    .select('slug, updated_at, created_at')
    .is('deleted_at', null)
    .in('status', ['open', 'upcoming'])
    .order('created_at', { ascending: false })
    .limit(5000);

  const grantRoutes = ((grants ?? []) as SlugRouteRow[]).filter(hasSlug).map((grant) => ({
    url: detailUrl('/grants', grant.slug),
    priority: 0.64,
    changeFrequency: 'daily' as const,
    lastModified: modifiedAt(grant.updated_at ?? grant.created_at),
  }));

  const { data: matchingPrograms } = await supabaseAdmin
    .from('matching_programs')
    .select('id, updated_at, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(5000);

  const matchingRoutes = ((matchingPrograms ?? []) as IdRouteRow[]).filter(hasId).map((program) => ({
    url: detailUrl('/matching', program.id),
    priority: 0.58,
    changeFrequency: 'weekly' as const,
    lastModified: modifiedAt(program.updated_at ?? program.created_at),
  }));

  const { data: volunteerOpportunities } = await supabaseAdmin
    .from('volunteer_opportunities')
    .select('slug, updated_at, created_at')
    .is('deleted_at', null)
    .in('status', ['open', 'upcoming'])
    .order('starts_at', { ascending: true, nullsFirst: false })
    .limit(5000);

  const volunteerRoutes = ((volunteerOpportunities ?? []) as SlugRouteRow[])
    .filter(hasSlug)
    .map((opportunity) => ({
      url: detailUrl('/volunteer', opportunity.slug),
      priority: 0.58,
      changeFrequency: 'weekly' as const,
      lastModified: modifiedAt(opportunity.updated_at ?? opportunity.created_at),
    }));

  const { data: sponsorshipOpportunities } = await supabaseAdmin
    .from('sponsorship_opportunities')
    .select('id, updated_at, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(5000);

  const sponsorRoutes = ((sponsorshipOpportunities ?? []) as IdRouteRow[])
    .filter(hasId)
    .map((opportunity) => ({
    url: detailUrl('/sponsor', opportunity.id),
      priority: 0.56,
      changeFrequency: 'weekly' as const,
      lastModified: modifiedAt(opportunity.updated_at ?? opportunity.created_at),
    }));

  const { data: impactPlans } = await supabaseAdmin
    .from('impact_plans')
    .select('campaign_id, updated_at')
    .eq('status', 'published')
    .limit(5000);

  const impactPlanRows = ((impactPlans ?? []) as ImpactPlanRow[]).filter(hasCampaignId);
  const impactCampaignIds = impactPlanRows.map((plan) => plan.campaign_id);
  const { data: impactCampaigns } = impactCampaignIds.length
    ? await applyLiveFilters(
      supabaseAdmin.from('campaigns').select('id, slug, updated_at').in('id', impactCampaignIds),
      cols,
    )
    : { data: [] as CampaignRouteRow[] };

  const planUpdatedByCampaignId = new Map(
    impactPlanRows.map((plan) => [plan.campaign_id, plan.updated_at]),
  );
  const impactRoutes = ((impactCampaigns ?? []) as CampaignRouteRow[]).filter(hasSlug).map((campaign) => ({
    url: detailUrl('/impact', campaign.slug),
    priority: 0.56,
    changeFrequency: 'weekly' as const,
    lastModified: modifiedAt(planUpdatedByCampaignId.get(campaign.id ?? '') ?? campaign.updated_at),
  }));

  return uniqueSitemapEntries([
    ...staticRoutes,
    ...blogRoutes,
    ...featureRoutes,
    ...campaignRoutes,
    ...eventRoutes,
    ...grantRoutes,
    ...matchingRoutes,
    ...volunteerRoutes,
    ...sponsorRoutes,
    ...impactRoutes,
  ]);
}
