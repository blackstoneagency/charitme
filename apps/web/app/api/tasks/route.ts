import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { checkRateLimitDurable } from '../../../lib/rate-limit-durable';
import { canAssignTo } from '../../../lib/task-access';

export const dynamic = 'force-dynamic';

const SELECT =
  'id, owner_id, campaign_id, assignee_id, title, notes, priority, status, due_at, completed_at, created_at, updated_at';

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(4000).nullable().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueAt: z.string().datetime().nullable().optional(),
});

// ── GET /api/tasks ──────────────────────────────────────────────────────────
// Tasks the caller owns OR is assigned. Mirrors the read half of
// `tasks_owner_or_assignee`; the service-role client bypasses the policy, so
// this filter is the real one.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select(SELECT)
    .or(`owner_id.eq.${user.id},assignee_id.eq.${user.id}`)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: 'Could not load your tasks', code: 'TASKS_UNAVAILABLE' }, { status: 503 });
  }
  return NextResponse.json({ tasks: data ?? [] });
}

// ── POST /api/tasks ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await checkRateLimitDurable(`task-create:${user.id}`, 200, 60 * 60_000))) {
    return NextResponse.json({ error: 'Too many tasks created', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid task', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const t = parsed.data;

  // A campaign must belong to the caller before a task can reference it —
  // otherwise the campaign_id would leak which campaigns exist, and the
  // assignment check below would consult a team the caller has no part in.
  if (t.campaignId) {
    const { data: owned, error: cErr } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('id', t.campaignId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (cErr) {
      return NextResponse.json({ error: 'Could not verify the campaign', code: 'CAMPAIGN_CHECK_FAILED' }, { status: 503 });
    }
    if (!owned) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  if (t.assigneeId && !(await canAssignTo(t.assigneeId, user.id, t.campaignId ?? null))) {
    return NextResponse.json(
      {
        error: 'You can only assign tasks to people on that campaign’s team.',
        code: 'ASSIGNEE_NOT_ON_TEAM',
      },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert({
      owner_id: user.id,
      campaign_id: t.campaignId ?? null,
      assignee_id: t.assigneeId ?? null,
      title: t.title,
      notes: t.notes ?? null,
      priority: t.priority,
      due_at: t.dueAt ?? null,
    })
    .select(SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Could not create the task', code: 'CREATE_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ task: data }, { status: 201 });
}
