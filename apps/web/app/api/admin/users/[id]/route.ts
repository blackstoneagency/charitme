import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { rolesFor, verifyAdmin } from '../_auth';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null) as {
    action?: string;
    fullName?: string;
    email?: string;
    role?: string;
    status?: string;
    identityVerified?: boolean;
  } | null;

  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const { data: current, error: currentError } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name, roles, identity_verified')
    .eq('id', id)
    .single();

  if (currentError || !current) {
    return NextResponse.json({ error: currentError?.message ?? 'User not found.' }, { status: 404 });
  }

  if (body.action === 'reset-password') {
    if (!current.email) return NextResponse.json({ error: 'User does not have an email address.' }, { status: 400 });
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(current.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.eli54u.com'}/login`,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const existingRoles = Array.isArray(current.roles) ? current.roles.map(String) : ['donor'];
  let role = body.role ?? existingRoles.find((item) => !['suspended', 'inactive'].includes(item)) ?? 'donor';
  let status = body.status ?? (existingRoles.includes('suspended') ? 'Suspended' : existingRoles.includes('inactive') ? 'Inactive' : 'Active');

  if (body.action === 'suspend') status = 'Suspended';
  if (body.action === 'activate') status = 'Active';
  if (body.action && ['donor', 'organizer', 'nonprofit', 'beneficiary', 'admin'].includes(body.action)) role = body.action;

  const fullName = body.fullName?.trim() ?? current.full_name;
  const email = body.email?.trim().toLowerCase() ?? current.email;
  const roles = rolesFor(role, status);

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: fullName,
      email,
      roles,
      identity_verified: body.identityVerified ?? current.identity_verified,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
    email: email ?? undefined,
    user_metadata: { full_name: fullName, roles },
  });

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
