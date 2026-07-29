import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import {
  hasPrivilegedRole,
  randomPassword,
  rolesFor,
  rolesWithStatus,
  verifyAdmin,
  verifySuperAdmin,
} from '../_auth';

const RoleSchema = z.enum([
  'donor', 'organizer', 'nonprofit', 'beneficiary', 'admin', 'super_admin',
]);
const StatusSchema = z.enum(['Active', 'Suspended', 'Inactive']);
const BulkSchema = z.object({
  action: z.enum([
    'import', 'activate', 'suspend',
    'donor', 'organizer', 'nonprofit', 'beneficiary', 'admin', 'super_admin',
  ]),
  ids: z.array(z.string().uuid()).max(500).optional(),
  users: z.array(z.object({
    fullname: z.string().optional(),
    fullName: z.string().optional(),
    name: z.string().optional(),
    email: z.string().trim().email().max(180).optional(),
    role: RoleSchema.optional(),
    status: StatusSchema.optional(),
  })).max(500).optional(),
});

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = BulkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const actorIsSuperAdmin = Boolean(await verifySuperAdmin());

  if (body.action === 'import') {
    const rows = body.users ?? [];
    if (
      !actorIsSuperAdmin
      && rows.some((row) => row.role === 'admin' || row.role === 'super_admin')
    ) {
      return NextResponse.json(
        { error: 'Only a super admin can import privileged accounts.', code: 'SUPER_ADMIN_REQUIRED' },
        { status: 403 },
      );
    }

    const created: string[] = [];
    for (const row of rows) {
      const email = row.email?.trim().toLowerCase();
      const fullName = (row.fullName ?? row.fullname ?? row.name)?.trim();
      if (!email || !fullName) continue;
      const roles = rolesFor(row.role ?? 'donor', row.status ?? 'Active');
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: { full_name: fullName, roles },
      });
      if (error || !data.user) continue;
      await supabaseAdmin.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName,
        roles,
        updated_at: new Date().toISOString(),
      });
      created.push(data.user.id);
    }
    return NextResponse.json({ ok: true, created: created.length });
  }

  const ids = body.ids ?? [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Select at least one user.' }, { status: 400 });
  }
  if (!actorIsSuperAdmin && (body.action === 'admin' || body.action === 'super_admin')) {
    return NextResponse.json(
      { error: 'Only a super admin can assign privileged roles.', code: 'SUPER_ADMIN_REQUIRED' },
      { status: 403 },
    );
  }

  const { data: targets, error: targetsError } = await supabaseAdmin
    .from('profiles')
    .select('id, roles')
    .in('id', ids);
  if (targetsError || !targets || targets.length !== ids.length) {
    return NextResponse.json(
      { error: 'One or more users could not be found.', code: 'USERS_NOT_FOUND' },
      { status: 404 },
    );
  }
  if (!actorIsSuperAdmin && targets.some((target) => hasPrivilegedRole(target.roles))) {
    return NextResponse.json(
      { error: 'Only a super admin can modify privileged accounts.', code: 'SUPER_ADMIN_REQUIRED' },
      { status: 403 },
    );
  }

  const rolesById = new Map(targets.map((target) => [target.id, target.roles]));
  const failed: string[] = [];
  let updated = 0;

  for (const id of ids) {
    const currentRoles = rolesById.get(id);
    if (!Array.isArray(currentRoles)) {
      failed.push(id);
      continue;
    }

    let status = currentRoles.includes('suspended')
      ? 'Suspended'
      : currentRoles.includes('inactive')
        ? 'Inactive'
        : 'Active';
    if (body.action === 'activate') status = 'Active';
    if (body.action === 'suspend') status = 'Suspended';

    const roleResult = RoleSchema.safeParse(body.action);
    const nextRoles = roleResult.success
      ? rolesFor(roleResult.data, status)
      : rolesWithStatus(currentRoles, status);

    const { error: writeError } = await supabaseAdmin
      .from('profiles')
      .update({ roles: nextRoles, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (writeError) {
      failed.push(id);
      continue;
    }
    updated++;
  }

  if (failed.length > 0) {
    console.error('[admin/users/bulk] some updates failed', {
      action: body.action,
      failedCount: failed.length,
    });
    return NextResponse.json(
      {
        ok: false,
        updated,
        failed: failed.length,
        error: `${failed.length} of ${ids.length} user(s) could not be updated.`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, updated });
}
