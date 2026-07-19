import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { userOwnsCampaign } from '../../../../lib/impact';
import { PlanUpsertSchema, sumPlanned } from '../../../../lib/impact-core';

export const dynamic = 'force-dynamic';

// POST /api/impact/plans — create or replace a campaign's impact plan + items.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = PlanUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (!(await userOwnsCampaign(input.campaign_id, user.id))) {
    return NextResponse.json({ error: 'You do not own this campaign' }, { status: 403 });
  }

  const totalBudget = sumPlanned(input.items);

  // Upsert the plan (one per campaign).
  const { data: plan, error: planErr } = await supabaseAdmin
    .from('impact_plans')
    .upsert(
      {
        campaign_id: input.campaign_id,
        created_by: user.id,
        title: input.title,
        summary: input.summary ?? null,
        total_budget_cents: totalBudget,
        status: input.status,
      },
      { onConflict: 'campaign_id' },
    )
    .select('id')
    .single();
  if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 });

  // Replace items.
  await supabaseAdmin.from('impact_plan_items').delete().eq('plan_id', plan.id);
  if (input.items.length) {
    const rows = input.items.map((it, i) => ({
      plan_id: plan.id,
      label: it.label,
      category: it.category ?? null,
      planned_amount_cents: it.planned_amount_cents,
      spent_amount_cents: it.spent_amount_cents,
      sort: i,
    }));
    const { error: itemErr } = await supabaseAdmin.from('impact_plan_items').insert(rows);
    if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: plan.id }, { status: 201 });
}
