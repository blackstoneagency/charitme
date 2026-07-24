import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';
import {
  draftGoalFromText,
  measureGoalProgress,
  GOAL_METRICS,
  type MarketingGoal,
  type GoalMetric,
} from '../../../../../lib/marketing-goals';

export const dynamic = 'force-dynamic';

const METRICS = Object.keys(GOAL_METRICS) as [GoalMetric, ...GoalMetric[]];

const GoalInput = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  objective: z.string().max(2000).optional(),
  natural_language_input: z.string().max(2000).optional(),
  target_metric: z.enum(METRICS),
  unit: z.enum(['count', 'cents', 'percent', 'ratio']),
  baseline_value: z.number().finite().nonnegative().nullable().optional(),
  target_value: z.number().finite().nonnegative().nullable().optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  geography: z.string().max(120).nullable().optional(),
  audience: z.string().max(200).nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  budget_cents: z.number().int().nonnegative().nullable().optional(),
  channels: z.array(z.string().max(40)).max(12).default([]),
  autonomy_level: z.number().int().min(1).max(4).default(1),
  constraints: z.record(z.unknown()).default({}),
});

// GET — list goals, newest first, each with live-measured progress.
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('marketing_goals')
    .select('*')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  const goals = (data ?? []) as MarketingGoal[];
  const withProgress = await Promise.all(
    goals.map(async (g) => ({ ...g, progress: await measureGoalProgress(g) })),
  );
  return NextResponse.json({ goals: withProgress });
}

// POST — create a goal. Two shapes:
//   { text: "..." }  → parse natural language into a structured draft, then save
//   { ...GoalInput } → save the structured goal directly
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Preview-only: return the parsed draft without persisting.
  if (typeof body.text === 'string' && body.preview) {
    return NextResponse.json({ draft: draftGoalFromText(body.text) });
  }

  const input = typeof body.text === 'string' ? draftGoalFromText(body.text) : body;
  const parsed = GoalInput.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid goal', issues: parsed.error.flatten() }, { status: 400 });
  }
  const g = parsed.data;

  // Capture the baseline from live data at creation for measurable metrics that
  // track a stock rather than a flow. Flow metrics (starts/volume) baseline at 0
  // because they measure activity accumulated *since* the goal was set.
  const baseline = g.baseline_value ?? 0;

  const { data, error } = await supabaseAdmin
    .from('marketing_goals')
    .insert({
      title: g.title,
      description: g.description ?? null,
      objective: g.objective ?? null,
      natural_language_input: g.natural_language_input ?? null,
      target_metric: g.target_metric,
      unit: g.unit,
      baseline_value: baseline,
      target_value: g.target_value ?? null,
      deadline: g.deadline ?? null,
      priority: g.priority,
      geography: g.geography ?? null,
      audience: g.audience ?? null,
      category: g.category ?? null,
      budget_cents: g.budget_cents ?? null,
      channels: g.channels,
      autonomy_level: g.autonomy_level,
      constraints: g.constraints,
      status: 'draft',
      owner_id: admin.id,
      created_by: admin.id,
    })
    .select('*')
    .single();
  if (error || !data) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id,
    action: 'goal_created',
    entity: 'marketing_goals',
    entity_id: data.id,
    detail: { title: data.title, metric: data.target_metric, source: typeof body.text === 'string' ? 'natural_language' : 'structured' },
  });

  const goal = data as MarketingGoal;
  return NextResponse.json({ goal: { ...goal, progress: await measureGoalProgress(goal) } }, { status: 201 });
}

// PATCH ?id=... — update status or editable fields (audited).
const PatchInput = z.object({
  status: z.enum(['draft', 'active', 'paused', 'achieved', 'missed', 'archived']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  autonomy_level: z.number().int().min(1).max(4).optional(),
  target_value: z.number().finite().nonnegative().nullable().optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = PatchInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid update', issues: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('marketing_goals')
    .update(parsed.data)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });

  await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id,
    action: 'goal_updated',
    entity: 'marketing_goals',
    entity_id: id,
    detail: parsed.data,
  });

  const goal = data as MarketingGoal;
  return NextResponse.json({ goal: { ...goal, progress: await measureGoalProgress(goal) } });
}
