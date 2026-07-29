import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import {
  hasPrivilegedRole,
  rolesFor,
  rolesWithStatus,
  verifyAdmin,
  verifySuperAdmin,
} from '../_auth';
import { setUserPlan } from '../../../../../lib/entitlements';
import { isValidPlan } from '@shared/entitlements';

const VALID_ROLES = new Set(['donor', 'organizer', 'nonprofit', 'beneficiary', 'admin', 'super_admin']);
const UpdateUserSchema = z.object({
  action: z.enum([
    'reset-password', 'suspend', 'activate',
    'donor', 'organizer', 'nonprofit', 'beneficiary', 'admin', 'super_admin',
  ]).optional(),
  fullName: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(180).optional(),
  newPassword: z.string().min(8).max(128).optional(),
  role: z.enum(['donor', 'organizer', 'nonprofit', 'beneficiary', 'admin', 'super_admin']).optional(),
  status: z.enum(['Active', 'Suspended', 'Inactive']).optional(),
  identityVerified: z.boolean().optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  currency: z.string().trim().min(3).max(3).optional(),
  plan: z.string().trim().min(1).max(40).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const parsed = UpdateUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // ── Fetch current profile ─────────────────────────────────────────────────
  const { data: current, error: currentError } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name, roles, identity_verified, timezone, currency, plan')
    .eq('id', id)
    .single();

  if (currentError || !current) {
    return NextResponse.json(
      { error: currentError?.message ?? 'User not found.' },
      { status: 404 },
    );
  }

  const requestedRole = body.role ?? (body.action && VALID_ROLES.has(body.action) ? body.action : null);
  if (
    (hasPrivilegedRole(current.roles) || requestedRole === 'admin' || requestedRole === 'super_admin')
    && !(await verifySuperAdmin())
  ) {
    return NextResponse.json(
      { error: 'Only a super admin can modify privileged accounts or roles.', code: 'SUPER_ADMIN_REQUIRED' },
      { status: 403 },
    );
  }

  // ── Password reset link action ────────────────────────────────────────────
  if (body.action === 'reset-password') {
    if (!current.email) {
      return NextResponse.json({ error: 'User does not have an email address.' }, { status: 400 });
    }
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(current.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com'}/login`,
    });
    if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Compute role & status ─────────────────────────────────────────────────
  const existingRoles = Array.isArray(current.roles) ? current.roles.map(String) : ['donor'];
  let role =
    body.role ??
    existingRoles.find((r) => !['suspended', 'inactive'].includes(r)) ??
    'donor';
  let status =
    body.status ??
    (existingRoles.includes('suspended')
      ? 'Suspended'
      : existingRoles.includes('inactive')
      ? 'Inactive'
      : 'Active');

  // Quick-action shortcuts
  if (body.action === 'suspend') status = 'Suspended';
  if (body.action === 'activate') status = 'Active';
  if (body.action && VALID_ROLES.has(body.action)) role = body.action;
  if (body.role && VALID_ROLES.has(body.role)) role = body.role;

  const fullName = body.fullName?.trim() || (current.full_name as string | null) || '';
  const email = body.email?.trim().toLowerCase() || (current.email as string | null) || '';
  const roles = requestedRole ? rolesFor(role, status) : rolesWithStatus(existingRoles, status);

  // ── Update profiles table ─────────────────────────────────────────────────
  const profileUpdate: Record<string, unknown> = {
    full_name: fullName || null,
    email,
    roles,
    identity_verified: body.identityVerified ?? current.identity_verified,
    updated_at: new Date().toISOString(),
  };

  if (typeof body.timezone === 'string' && body.timezone.trim()) {
    profileUpdate.timezone = body.timezone.trim();
  }
  if (typeof body.currency === 'string' && body.currency.trim()) {
    profileUpdate.currency = body.currency.trim().toLowerCase();
  }
  const requestedPlan = typeof body.plan === 'string' ? body.plan.trim().toLowerCase() : undefined;
  if (requestedPlan !== undefined) {
    if (!isValidPlan(requestedPlan)) {
      return NextResponse.json({ error: `Invalid plan: ${requestedPlan}` }, { status: 400 });
    }
    profileUpdate.plan = requestedPlan;
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update(profileUpdate)
    .eq('id', id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // ── Sync the subscriptions table so entitlements reflect the plan change ───
  if (requestedPlan !== undefined && isValidPlan(requestedPlan)) {
    try {
      await setUserPlan(id, requestedPlan);
    } catch {
      // non-fatal: profiles.plan is updated; entitlement sync can be retried
    }
  }

  // ── Update auth user (email + metadata + optional password) ───────────────
  const authUpdate: Record<string, unknown> = {
    email: email || undefined,
    user_metadata: { full_name: fullName, roles },
  };

  const newPw = body.newPassword?.trim();
  if (newPw && newPw.length >= 8) {
    authUpdate.password = newPw;
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    id,
    authUpdate as Parameters<typeof supabaseAdmin.auth.admin.updateUserById>[1],
  );

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json(
      { error: 'You cannot delete your own account.', code: 'SELF_DELETE_FORBIDDEN' },
      { status: 409 },
    );
  }

  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('roles')
    .eq('id', id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  if (hasPrivilegedRole(target.roles) && !(await verifySuperAdmin())) {
    return NextResponse.json(
      { error: 'Only a super admin can delete a privileged account.', code: 'SUPER_ADMIN_REQUIRED' },
      { status: 403 },
    );
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
