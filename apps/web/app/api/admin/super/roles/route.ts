import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { guardSuperAdmin, logSuperAdminAction } from '../../../../../lib/super-admin';
import { ASSIGNABLE_ROLES } from '../../../../../lib/roles';

const Schema = z.object({
  userId: z.string().uuid(),
  roles: z.array(z.enum(ASSIGNABLE_ROLES as unknown as [string, ...string[]])).min(1).max(6),
});

// PATCH /api/admin/super/roles — set a user's full roles array (super-admin only).
export async function PATCH(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { userId, roles } = parsed.data;

  // De-dupe and guarantee a baseline 'donor' role so no account is left role-less.
  const finalRoles = Array.from(new Set(roles.length ? roles : ['donor']));

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ roles: finalRoles })
    .eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSuperAdminAction(guard.user.id, 'roles.update', 'profile', userId, { roles: finalRoles });
  return NextResponse.json({ ok: true, roles: finalRoles });
}
