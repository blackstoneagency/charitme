import 'server-only';
import type { Metadata } from 'next';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import TasksClient, { type Task, type CampaignOption } from './TasksClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tasks | CharitMe' };

// ─────────────────────────────────────────────────────────────────────────────
// Tasks (design #145). Table ships in 20260821000000.
//
// Scoped to owner OR assignee in the query, mirroring the read half of
// `tasks_owner_or_assignee`. The service-role client bypasses RLS, so this
// filter is the real access control, not a convenience.
//
// ⚠️ Inert until the migration is applied — the read fails and the page renders
// its unknown state rather than an empty list. "No tasks" and "cannot tell" are
// opposite claims, and only one of them is safe to guess at.
// ─────────────────────────────────────────────────────────────────────────────

export default async function TasksPage() {
  const user = await requireUser();

  const [tasksRes, campaignsRes] = await Promise.all([
    supabaseAdmin
      .from('tasks')
      .select(
        'id, owner_id, campaign_id, assignee_id, title, notes, priority, status, due_at, completed_at, created_at, updated_at',
      )
      .or(`owner_id.eq.${user.id},assignee_id.eq.${user.id}`)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(500),
    supabaseAdmin
      .from('campaigns')
      .select('id, title, slug')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const tasks: Task[] | null = tasksRes.error ? null : ((tasksRes.data ?? []) as Task[]);
  const campaigns = (campaignsRes.data ?? []) as CampaignOption[];

  return (
    <CharitMeShell active="Tasks">
      <TopBar title="Tasks" subtitle="Keep track of what needs doing, across your campaigns." />
      <TasksClient initialTasks={tasks} campaigns={campaigns} currentUserId={user.id} />
    </CharitMeShell>
  );
}
