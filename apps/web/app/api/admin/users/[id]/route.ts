import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { rolesFor, verifyAdmin } from '../_auth';
import { setUserPlan } from '../../../../../lib/entitlements';
import { isValidPlan } from '@shared/entitlements';

const VALID_ROLES = new Set(['donor', 'organizer', 'nonprofit', 'beneficiary', 'admin']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const body = await request.json().catch(() => null) as {
    action?: string;
    fullName?: string;
    email?: string;
    newPassword?: string;
    role?: string;
    status?: string;
    identityVerified?: boolean;
    timezone?: string;
    currency?: string;
    plan?: string;
  } | null;

  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

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

  // ── Password reset link action ────────────────────────────────────────────
  if (body.action === 'reset-password') {
    if (!current.email) {
      return NextResponse.json({ error: 'User does not have an email address.' }, { status: 400 });
    }
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(current.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com'}/login`,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
  const roles = rolesFor(role, status);

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
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
