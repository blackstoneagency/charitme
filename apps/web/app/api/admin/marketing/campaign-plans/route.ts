import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';
import { generateCampaignPlan, type GoalLike } from '../../../../../lib/marketing-campaign-generator';

export const dynamic = 'force-dynamic';

// GET            → list plans (newest first) with asset counts
// GET ?id=       → one plan with its assets
// GET ?goal_id=  → plans for a goal
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  const goalId = req.nextUrl.searchParams.get('goal_id');

  if (id) {
    const { data: plan, error } = await supabaseAdmin.from('marketing_campaign_plans').select('*').eq('id', id).single();
    if (error || !plan) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
    const { data: assets } = await supabaseAdmin
      .from('marketing_campaign_plan_assets').select('*').eq('plan_id', id).order('sort_order', { ascending: true });
    return NextResponse.json({ plan, assets: assets ?? [] });
  }

  let q = supabaseAdmin.from('marketing_campaign_plans').select('*').neq('status', 'archived').order('created_at', { ascending: false }).limit(200);
  if (goalId) q = q.eq('goal_id', goalId);
  const { data: plans, error } = await q;
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  const ids = (plans ?? []).map((p) => p.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: assetRows } = await supabaseAdmin.from('marketing_campaign_plan_assets').select('plan_id').in('plan_id', ids);
    for (const a of assetRows ?? []) counts[a.plan_id] = (counts[a.plan_id] ?? 0) + 1;
  }
  return NextResponse.json({ plans: (plans ?? []).map((p) => ({ ...p, asset_count: counts[p.id] ?? 0 })) });
}

// POST { goal_id } → generate a connected campaign plan + assets from the goal.
const GenInput = z.object({ goal_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = GenInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'goal_id required' }, { status: 400 });

  const { data: goal, error: goalErr } = await supabaseAdmin
    .from('marketing_goals').select('*').eq('id', parsed.data.goal_id).single();
  if (goalErr || !goal) return NextResponse.json({ error: 'Goal not found', code: 'NOT_FOUND' }, { status: 404 });

  const generated = generateCampaignPlan(goal as GoalLike);

  const { data: plan, error: planErr } = await supabaseAdmin
    .from('marketing_campaign_plans')
    .insert({
      goal_id: goal.id,
      title: generated.plan.title,
      objective: generated.plan.objective,
      audience: generated.plan.audience,
      geography: generated.plan.geography,
      category: generated.plan.category,
      summary: generated.plan.summary,
      status: 'draft',
      source: 'generated',
      created_by: admin.id,
    })
    .select('*')
    .single();
  if (planErr || !plan) return NextResponse.json({ error: 'Could not create plan', code: 'INTERNAL_ERROR' }, { status: 500 });

  const assetRows = generated.assets.map((a) => ({ ...a, plan_id: plan.id, status: 'draft' }));
  const { data: assets, error: assetErr } = await supabaseAdmin
    .from('marketing_campaign_plan_assets').insert(assetRows).select('*');
  if (assetErr) {
    // roll back the orphan plan so we never leave a half-generated campaign
    await supabaseAdmin.from('marketing_campaign_plans').delete().eq('id', plan.id);
    return NextResponse.json({ error: 'Could not create assets', code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id, action: 'campaign_plan_generated', entity: 'marketing_campaign_plans', entity_id: plan.id,
    detail: { goal_id: goal.id, title: plan.title, assets: assetRows.length },
  });

  return NextResponse.json({ plan, assets: assets ?? [] }, { status: 201 });
}

// PATCH ?id= → plan status change (draft | in_review | approved | archived).
const PatchInput = z.object({ status: z.enum(['draft', 'in_review', 'approved', 'archived']) });

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const parsed = PatchInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('marketing_campaign_plans').update({ status: parsed.data.status }).eq('id', id).select('*').single();
  if (error || !data) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });

  await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id, action: 'campaign_plan_updated', entity: 'marketing_campaign_plans', entity_id: id,
    detail: { status: parsed.data.status },
  });
  return NextResponse.json({ plan: data });
}
