import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { guardSuperAdmin, logSuperAdminAction } from '../../../../../lib/super-admin';
import { parseRoles } from '../../../../../lib/roles';

const Schema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['suspend', 'restore', 'set_plan']),
  plan: z.enum(['free', 'starter', 'pro']).optional(),
});

// PATCH /api/admin/super/users — suspend/restore an account or change its plan.
// Suspend is modeled as a 'suspended' marker in the roles array (the existing
// admin UI already reads this convention).
export async function PATCH(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const { userId, action, plan } = parsed.data;

  const { data: profile } = await supabaseAdmin.from('profiles').select('id, roles').eq('id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (action === 'set_plan') {
    if (!plan) return NextResponse.json({ error: 'plan required' }, { status: 400 });
    const { error } = await supabaseAdmin.from('profiles').update({ plan }).eq('id', userId);
    if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
    await logSuperAdminAction(guard.user.id, 'user.set_plan', 'profile', userId, { plan });
    return NextResponse.json({ ok: true, plan });
  }

  const roles = parseRoles(profile.roles).filter((r) => r !== 'suspended' as never);
  const next = action === 'suspend' ? [...roles, 'suspended'] : roles;
  const { error } = await supabaseAdmin.from('profiles').update({ roles: Array.from(new Set(next)) }).eq('id', userId);
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  await logSuperAdminAction(guard.user.id, `user.${action}`, 'profile', userId, {});
  return NextResponse.json({ ok: true, suspended: action === 'suspend' });
}
