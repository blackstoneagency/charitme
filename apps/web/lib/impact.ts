import 'server-only';
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

export interface ImpactBundle {
  campaign: { id: string; slug: string; title: string; currency: string; raised_amount: number };
  plan: (ImpactPlan & { items: ImpactPlanItem[] }) | null;
  updates: (ImpactUpdate & { evidence: ImpactEvidence[] })[];
  metrics: ImpactMetric[];
  transparency: TransparencyResult;
}

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
