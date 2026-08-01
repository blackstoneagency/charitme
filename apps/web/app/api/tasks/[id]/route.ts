import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { canReadTask, canWriteTask, canAssignTo } from '../../../../lib/task-access';

export const dynamic = 'force-dynamic';

const SELECT =
  'id, owner_id, campaign_id, assignee_id, title, notes, priority, status, due_at, completed_at, created_at, updated_at';

const UpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

type TaskRow = { owner_id: string; assignee_id: string | null; campaign_id: string | null; status: string };

async function load(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data, error } = await supabaseAdmin.from('tasks').select(SELECT).eq('id', id).maybeSingle();
  if (error) {
    return { err: NextResponse.json({ error: 'Could not load the task', code: 'TASK_UNAVAILABLE' }, { status: 503 }) };
  }
  if (!data || !(await canReadTask(user, data as TaskRow))) {
    return { err: NextResponse.json({ error: 'Task not found' }, { status: 404 }) };
  }
  return { user, task: data as TaskRow & Record<string, unknown> };
}

// ── PATCH /api/tasks/[id] ───────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await load(id);
  if (loaded.err) return loaded.err;
  const { user, task } = loaded;

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid task', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const u = parsed.data;

  const isOwner = await canWriteTask(user, task);
  const onlyStatus = Object.keys(u).length === 1 && u.status !== undefined;

  // An assignee may tick their own task off, and nothing else. Editing the
  // title, reassigning it or changing the due date stays with the owner —
  // otherwise "assigned to you" would quietly mean "yours to rewrite".
  if (!isOwner && !onlyStatus) {
    return NextResponse.json(
      { error: 'Only the task owner can change this.', code: 'NOT_TASK_OWNER' },
      { status: 403 },
    );
  }

  if (u.assigneeId !== undefined && u.assigneeId !== null) {
    if (!(await canAssignTo(u.assigneeId, task.owner_id, task.campaign_id))) {
      return NextResponse.json(
        { error: 'You can only assign tasks to people on that campaign’s team.', code: 'ASSIGNEE_NOT_ON_TEAM' },
        { status: 400 },
      );
    }
  }

  const patch: Record<string, unknown> = {};
  if (u.title !== undefined) patch.title = u.title;
  if (u.notes !== undefined) patch.notes = u.notes;
  if (u.priority !== undefined) patch.priority = u.priority;
  if (u.dueAt !== undefined) patch.due_at = u.dueAt;
  if (u.assigneeId !== undefined) patch.assignee_id = u.assigneeId;
  if (u.status !== undefined) {
    patch.status = u.status;
    // `tasks_completed_consistency` refuses a done task with no completed_at and
    // an open one that carries one. Set here so the constraint stays a backstop.
    patch.completed_at = u.status === 'done' ? new Date().toISOString() : null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update', code: 'EMPTY_PATCH' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Could not save the task', code: 'SAVE_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ task: data });
}

// ── DELETE /api/tasks/[id] ──────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await load(id);
  if (loaded.err) return loaded.err;

  if (!(await canWriteTask(loaded.user, loaded.task))) {
    return NextResponse.json({ error: 'Only the task owner can delete it.', code: 'NOT_TASK_OWNER' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('tasks').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'Could not delete the task', code: 'DELETE_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
