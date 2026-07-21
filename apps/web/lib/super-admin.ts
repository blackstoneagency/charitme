import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from './supabase-server';
import { supabaseAdmin } from './supabase';
import { isSuperAdmin } from './roles';

export type GuardOk = { ok: true; user: { id: string; email: string | null } };
export type GuardErr = { ok: false; response: NextResponse };

/**
 * Guard for super-admin API routes. Returns the authenticated super-admin, or a
 * ready-to-return 401/403 NextResponse. Use at the top of every /api/admin/super
 * handler.
 */
export async function guardSuperAdmin(): Promise<GuardOk | GuardErr> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const allowed = await isSuperAdmin(user.id, user.email);
  if (!allowed) return { ok: false, response: NextResponse.json({ error: 'Forbidden — super admin only' }, { status: 403 }) };
  return { ok: true, user: { id: user.id, email: user.email ?? null } };
}

/** Best-effort audit-log entry for a super-admin action (never throws). */
export async function logSuperAdminAction(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata,
    });
  } catch {
    /* non-blocking */
  }
}
