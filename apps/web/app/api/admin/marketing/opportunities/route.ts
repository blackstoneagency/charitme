import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';
import { generateOpportunities } from '../../../../../lib/marketing-opportunities';
import { GOAL_METRICS, type GoalMetric } from '../../../../../lib/marketing-goals';

export const dynamic = 'force-dynamic';

// GET — ranked opportunity feed (excludes archived).
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('marketing_opportunities')
    .select('*')
    .neq('status', 'archived')
    .order('score', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ opportunities: data ?? [] });
}

// POST { action: 'generate' } — derive opportunities from live data and upsert.
// Idempotent per dedupe_key; status/created_by are omitted from the payload so
// re-generation never resets a human decision (accepted/rejected/deferred).
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || body.action !== 'generate') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  let drafts;
  try {
    drafts = await generateOpportunities();
  } catch {
    return NextResponse.json({ error: 'Generation failed', code: 'GENERATION_FAILED' }, { status: 502 });
  }

  if (drafts.length === 0) {
    await supabaseAdmin.from('marketing_audit_logs').insert({
      actor_id: admin.id, action: 'opportunities_generated', entity: 'marketing_opportunities', detail: { created: 0 },
    });
    return NextResponse.json({ generated: 0, opportunities: [] });
  }

  const { error } = await supabaseAdmin
    .from('marketing_opportunities')
    .upsert(drafts, { onConflict: 'dedupe_key' });
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id, action: 'opportunities_generated', entity: 'marketing_opportunities',
    detail: { created: drafts.length, source: 'rule' },
  });

  const { data } = await supabaseAdmin
    .from('marketing_opportunities')
    .select('*')
    .neq('status', 'archived')
    .order('score', { ascending: false })
    .limit(200);
  return NextResponse.json({ generated: drafts.length, opportunities: data ?? [] });
}

// PATCH ?id= — change status, or convert to a goal (closes Prioritize → Plan).
const PatchInput = z.object({
  status: z.enum(['new', 'accepted', 'rejected', 'deferred', 'archived']).optional(),
  convert: z.boolean().optional(),
}).refine((v) => v.status || v.convert, { message: 'Nothing to do' });

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = PatchInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid update', issues: parsed.error.flatten() }, { status: 400 });

  const { data: opp, error: fetchErr } = await supabaseAdmin
    .from('marketing_opportunities').select('*').eq('id', id).single();
  if (fetchErr || !opp) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });

  // Convert → create a linked marketing_goal, then flag the opportunity converted.
  if (parsed.data.convert) {
    if (opp.linked_goal_id) {
      return NextResponse.json({ error: 'Already converted', code: 'ALREADY_CONVERTED' }, { status: 409 });
    }
    const metric = (opp.target_metric as GoalMetric) ?? 'custom';
    const unit = GOAL_METRICS[metric]?.unit ?? 'count';
    const target = unit === 'cents' ? opp.est_impact_cents : (opp.est_starts ?? null);

    const { data: goal, error: goalErr } = await supabaseAdmin
      .from('marketing_goals')
      .insert({
        title: opp.title,
        description: opp.description,
        objective: opp.rationale,
        target_metric: metric,
        unit,
        baseline_value: 0,
        target_value: target,
        priority: opp.score >= 66 ? 'high' : opp.score >= 33 ? 'medium' : 'low',
        category: opp.category,
        geography: opp.geography,
        audience: opp.audience,
        confidence: opp.confidence,
        status: 'draft',
        owner_id: admin.id,
        created_by: admin.id,
        constraints: { origin: 'opportunity', opportunity_id: opp.id },
      })
      .select('id')
      .single();
    if (goalErr || !goal) return NextResponse.json({ error: 'Could not create goal', code: 'INTERNAL_ERROR' }, { status: 500 });

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('marketing_opportunities')
      .update({ status: 'converted', linked_goal_id: goal.id })
      .eq('id', id)
      .select('*')
      .single();
    if (updErr) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

    await supabaseAdmin.from('marketing_audit_logs').insert({
      actor_id: admin.id, action: 'opportunity_converted', entity: 'marketing_opportunities', entity_id: id,
      detail: { goal_id: goal.id, title: opp.title },
    });
    return NextResponse.json({ opportunity: updated, goal_id: goal.id });
  }

  // Plain status change.
  const { data: updated, error: updErr } = await supabaseAdmin
    .from('marketing_opportunities')
    .update({ status: parsed.data.status })
    .eq('id', id)
    .select('*')
    .single();
  if (updErr) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id, action: 'opportunity_updated', entity: 'marketing_opportunities', entity_id: id,
    detail: { status: parsed.data.status },
  });
  return NextResponse.json({ opportunity: updated });
}
