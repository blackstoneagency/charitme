import 'server-only';
import { unstable_cache } from 'next/cache';
// ─────────────────────────────────────────────────────────────────────────────
// Impact tracking — Supabase data access. Pure logic in `impact-core.ts`.
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from './supabase';
import {
  transparencyScore,
  sumSpent,
  type ImpactPlan,
  type ImpactPlanItem,
  type ImpactUpdate,
  type ImpactEvidence,
  type ImpactMetric,
  type TransparencyResult,
} from './impact-core';
import { applyLiveFilters, campaignColumns } from './campaign-visibility';

export interface ImpactBundle {
  campaign: { id: string; slug: string; title: string; currency: string; raised_amount: number };
  plan: (ImpactPlan & { items: ImpactPlanItem[] }) | null;
  updates: (ImpactUpdate & { evidence: ImpactEvidence[] })[];
  metrics: ImpactMetric[];
  transparency: TransparencyResult;
}

export interface PublicImpactSummary {
  campaign: { id: string; slug: string; title: string; currency: string; raised_amount: number };
  plan: Pick<ImpactPlan, 'id' | 'title' | 'summary' | 'total_budget_cents' | 'updated_at'>;
  publishedUpdateCount: number;
  metricCount: number;
  transparency: TransparencyResult;
}

type PublishedImpactPlanRow = Pick<
  ImpactPlan,
  'id' | 'campaign_id' | 'title' | 'summary' | 'total_budget_cents' | 'updated_at'
>;
type CampaignSummaryRow = { id: string; slug: string; title: string; raised_amount: number };
type LaunchCurrencyRow = { campaign_id: string; currency: string | null };
type UpdateSummaryRow = { id: string; campaign_id: string };
type EvidenceSummaryRow = { update_id: string };
type MetricSummaryRow = { campaign_id: string };
type PlanItemSpendRow = { plan_id: string; spent_amount_cents: number };

async function resolveCampaign(idOrSlug: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  // `currency` is NOT a column on campaigns — it lives in campaign_launch_settings.
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, raised_amount, user_id')
    .eq(isUuid ? 'id' : 'slug', idOrSlug)
    .maybeSingle();
  if (!data) return null;
  const campaign = data as { id: string; slug: string; title: string; raised_amount: number; user_id: string };
  const { data: launch } = await supabaseAdmin
    .from('campaign_launch_settings')
    .select('currency')
    .eq('campaign_id', campaign.id)
    .maybeSingle();
  return {
    ...campaign,
    currency: ((launch as { currency?: string | null } | null)?.currency ?? 'usd').toLowerCase(),
  };
}

/**
 * Assemble a campaign's impact bundle. `viewerOwns` includes draft records for
 * the owner; otherwise only published data is returned.
 */
export async function getImpactBundle(idOrSlug: string, viewerOwns = false): Promise<ImpactBundle | null> {
  const campaign = await resolveCampaign(idOrSlug);
  if (!campaign) return null;

  const [{ data: planRow }, { data: updateRows }, { data: metricRows }] = await Promise.all([
    supabaseAdmin.from('impact_plans').select('*').eq('campaign_id', campaign.id).maybeSingle(),
    supabaseAdmin
      .from('impact_updates')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('impact_metrics').select('*').eq('campaign_id', campaign.id).order('sort', { ascending: true }),
  ]);

  // Plan (+ items), respecting draft visibility.
  let plan: (ImpactPlan & { items: ImpactPlanItem[] }) | null = null;
  const planVisible = planRow && (viewerOwns || planRow.status === 'published');
  if (planVisible) {
    const { data: items } = await supabaseAdmin
      .from('impact_plan_items')
      .select('*')
      .eq('plan_id', planRow.id)
      .order('sort', { ascending: true });
    plan = { ...(planRow as ImpactPlan), items: (items ?? []) as ImpactPlanItem[] };
  }

  // Updates (+ evidence), respecting draft visibility.
  const visibleUpdates = (updateRows ?? []).filter(
    (u) => viewerOwns || u.status === 'published',
  ) as ImpactUpdate[];
  const updateIds = visibleUpdates.map((u) => u.id);
  const evidenceByUpdate = new Map<string, ImpactEvidence[]>();
  if (updateIds.length) {
    const { data: ev } = await supabaseAdmin.from('impact_evidence').select('*').in('update_id', updateIds);
    for (const e of (ev ?? []) as ImpactEvidence[]) {
      const arr = evidenceByUpdate.get(e.update_id) ?? [];
      arr.push(e);
      evidenceByUpdate.set(e.update_id, arr);
    }
  }
  const updates = visibleUpdates.map((u) => ({ ...u, evidence: evidenceByUpdate.get(u.id) ?? [] }));
  const metrics = (metricRows ?? []) as ImpactMetric[];

  // Transparency score — always computed from PUBLISHED signals (public trust).
  const publishedUpdates = (updateRows ?? []).filter((u) => u.status === 'published');
  const publishedUpdateIds = new Set(publishedUpdates.map((u) => u.id));
  const updatesWithEvidence = new Set(
    [...evidenceByUpdate.entries()]
      .filter(([id, arr]) => publishedUpdateIds.has(id) && arr.length > 0)
      .map(([id]) => id),
  );
  const publishedPlan = planRow && planRow.status === 'published';
  const spent = plan ? sumSpent(plan.items) : 0;

  const transparency = transparencyScore({
    hasPublishedPlan: !!publishedPlan,
    totalBudgetCents: (planRow?.total_budget_cents as number | undefined) ?? 0,
    totalSpentCents: spent,
    publishedUpdateCount: publishedUpdates.length,
    updatesWithEvidenceCount: updatesWithEvidence.size,
    metricCount: metrics.length,
  });

  return {
    campaign: {
      id: campaign.id,
      slug: campaign.slug,
      title: campaign.title,
      currency: campaign.currency ?? 'usd',
      raised_amount: campaign.raised_amount,
    },
    plan,
    updates,
    metrics,
    transparency,
  };
}

/**
 * Published impact summaries for the public /impact index.
 *
 * Never throws: this page used to return a hard 500 whenever Supabase was
 * unreachable (measured on a cold production build with env unset, where
 * `supabaseAdmin` throws on construction). An empty index is a correct, honest
 * rendering of "no reports to show"; a 500 is not.
 */
/**
 * Cached because `/impact` was the slowest public route by an order of magnitude —
 * **TTFB ~600ms against ~20ms for static pages** (`npm run audit:web-vitals`). The
 * query is already batched and partly parallel; the cost is three sequential
 * round-trips to Supabase, which caching removes for everyone but the first caller.
 *
 * Safe to cache: this is published, non-personalised, public data. 60s matches the
 * homepage layer (`lib/home-data.ts`), and the `impact` tag lets a publish bust it.
 */
const fetchPublishedImpactSummaries = unstable_cache(
  async (limit: number): Promise<PublicImpactSummary[]> => {
    try {
      return await listPublishedImpactSummariesUncaught(limit);
    } catch {
      return [];
    }
  },
  ['public-impact-summaries'],
  { revalidate: 60, tags: ['impact'] },
);

export async function listPublishedImpactSummaries(limit = 24): Promise<PublicImpactSummary[]> {
  return fetchPublishedImpactSummaries(limit);
}

async function listPublishedImpactSummariesUncaught(limit = 24): Promise<PublicImpactSummary[]> {
  const { data: planData } = await supabaseAdmin
    .from('impact_plans')
    .select('id, campaign_id, title, summary, total_budget_cents, updated_at')
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .limit(Math.min(limit, 100));

  const plans = (planData ?? []) as PublishedImpactPlanRow[];
  if (plans.length === 0) return [];

  const campaignIds = [...new Set(plans.map((plan) => plan.campaign_id))];
  const cols = await campaignColumns();
  const { data: campaignData } = await applyLiveFilters(
    supabaseAdmin.from('campaigns').select('id, slug, title, raised_amount').in('id', campaignIds),
    cols,
  );
  const campaigns = (campaignData ?? []) as CampaignSummaryRow[];
  if (campaigns.length === 0) return [];

  const visibleCampaignIds = new Set(campaigns.map((campaign) => campaign.id));
  const visiblePlans = plans.filter((plan) => visibleCampaignIds.has(plan.campaign_id));
  const visiblePlanIds = visiblePlans.map((plan) => plan.id);

  const [{ data: launchData }, { data: updateData }, { data: metricData }, { data: itemData }] = await Promise.all([
    supabaseAdmin.from('campaign_launch_settings').select('campaign_id, currency').in('campaign_id', [...visibleCampaignIds]),
    supabaseAdmin
      .from('impact_updates')
      .select('id, campaign_id')
      .eq('status', 'published')
      .in('campaign_id', [...visibleCampaignIds]),
    supabaseAdmin.from('impact_metrics').select('campaign_id').in('campaign_id', [...visibleCampaignIds]),
    supabaseAdmin.from('impact_plan_items').select('plan_id, spent_amount_cents').in('plan_id', visiblePlanIds),
  ]);

  const updates = (updateData ?? []) as UpdateSummaryRow[];
  const updateIds = updates.map((update) => update.id);
  const { data: evidenceData } = updateIds.length
    ? await supabaseAdmin.from('impact_evidence').select('update_id').in('update_id', updateIds)
    : { data: [] as EvidenceSummaryRow[] };

  const currencyByCampaignId = new Map(
    ((launchData ?? []) as LaunchCurrencyRow[]).map((row) => [row.campaign_id, (row.currency ?? 'usd').toLowerCase()]),
  );
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const updateCountByCampaignId = new Map<string, number>();
  const metricCountByCampaignId = new Map<string, number>();
  const spentByPlanId = new Map<string, number>();
  const updateCampaignById = new Map(updates.map((update) => [update.id, update.campaign_id]));
  const evidenceUpdateIds = new Set(((evidenceData ?? []) as EvidenceSummaryRow[]).map((evidence) => evidence.update_id));
  const updatesWithEvidenceByCampaignId = new Map<string, Set<string>>();

  for (const update of updates) {
    updateCountByCampaignId.set(update.campaign_id, (updateCountByCampaignId.get(update.campaign_id) ?? 0) + 1);
  }
  for (const metric of (metricData ?? []) as MetricSummaryRow[]) {
    metricCountByCampaignId.set(metric.campaign_id, (metricCountByCampaignId.get(metric.campaign_id) ?? 0) + 1);
  }
  for (const item of (itemData ?? []) as PlanItemSpendRow[]) {
    spentByPlanId.set(item.plan_id, (spentByPlanId.get(item.plan_id) ?? 0) + item.spent_amount_cents);
  }
  for (const updateId of evidenceUpdateIds) {
    const campaignId = updateCampaignById.get(updateId);
    if (!campaignId) continue;
    const existing = updatesWithEvidenceByCampaignId.get(campaignId) ?? new Set<string>();
    existing.add(updateId);
    updatesWithEvidenceByCampaignId.set(campaignId, existing);
  }

  return visiblePlans.flatMap((plan) => {
    const campaign = campaignById.get(plan.campaign_id);
    if (!campaign) return [];
    const publishedUpdateCount = updateCountByCampaignId.get(campaign.id) ?? 0;
    const metricCount = metricCountByCampaignId.get(campaign.id) ?? 0;
    return [{
      campaign: {
        ...campaign,
        currency: currencyByCampaignId.get(campaign.id) ?? 'usd',
      },
      plan: {
        id: plan.id,
        title: plan.title,
        summary: plan.summary,
        total_budget_cents: plan.total_budget_cents,
        updated_at: plan.updated_at,
      },
      publishedUpdateCount,
      metricCount,
      transparency: transparencyScore({
        hasPublishedPlan: true,
        totalBudgetCents: plan.total_budget_cents,
        totalSpentCents: spentByPlanId.get(plan.id) ?? 0,
        publishedUpdateCount,
        updatesWithEvidenceCount: updatesWithEvidenceByCampaignId.get(campaign.id)?.size ?? 0,
        metricCount,
      }),
    }];
  });
}

/** Campaigns owned by a user (for the impact management picker). */
export async function listOwnedCampaigns(userId: string) {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('id, slug, title')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);
  return (data ?? []) as { id: string; slug: string; title: string }[];
}

/** Verify the signed-in user owns the campaign behind an impact record. */
export async function userOwnsCampaign(campaignId: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('user_id')
    .eq('id', campaignId)
    .maybeSingle();
  return !!data && data.user_id === userId;
}
