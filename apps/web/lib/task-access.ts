import 'server-only';
import { supabaseAdmin } from './supabase';
import { isAdmin } from './roles';

/**
 * Ownership rule for `tasks`.
 *
 * The API routes use the service-role client, which BYPASSES RLS, so this — not
 * `tasks_owner_or_assignee` — is what actually runs on every request. It mirrors
 * that policy deliberately: READ for owner, assignee or admin; WRITE for owner
 * or admin only.
 *
 * The asymmetry is intentional and matches the policy's `with check`: an
 * assignee can see a task assigned to them, but cannot edit or delete someone
 * else's list. Marking your own assigned task done goes through the dedicated
 * status route rather than a general update.
 */
export async function canReadTask(
  user: { id: string; email?: string | null },
  task: { owner_id: string; assignee_id: string | null },
): Promise<boolean> {
  if (task.owner_id === user.id) return true;
  if (task.assignee_id && task.assignee_id === user.id) return true;
  return isAdmin(user.id, user.email);
}

export async function canWriteTask(
  user: { id: string; email?: string | null },
  task: { owner_id: string },
): Promise<boolean> {
  if (task.owner_id === user.id) return true;
  return isAdmin(user.id, user.email);
}

/**
 * An assignee must already share the campaign through `team_members`.
 *
 * Without this check, `assignee_id` would be an arbitrary profile id: a caller
 * could assign a task to any user on the platform, and — because the read rule
 * grants assignees access — hand a stranger a row naming a donor or an
 * unannounced plan. Assignment must never be able to WIDEN who can read
 * something.
 */
export async function canAssignTo(
  assigneeId: string,
  ownerId: string,
  campaignId: string | null,
): Promise<boolean> {
  if (assigneeId === ownerId) return true;
  if (!campaignId) return false;

  const { data, error } = await supabaseAdmin
    .from('team_members')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('user_id', assigneeId)
    .maybeSingle();

  // A failed lookup must not read as "allowed" — that is a guard failing open,
  // and here it fails open onto a privacy boundary.
  if (error) return false;
  return Boolean(data);
}
