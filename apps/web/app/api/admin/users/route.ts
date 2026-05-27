import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { randomPassword, rolesFor, verifyAdmin } from './_auth';

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    fullName?: string;
    email?: string;
    role?: string;
    status?: string;
    sendWelcome?: boolean;
  } | null;

  const email = body?.email?.trim().toLowerCase();
  const fullName = body?.fullName?.trim();
  if (!email || !fullName) {
    return NextResponse.json({ error: 'Full name and email are required.' }, { status: 400 });
  }

  const role = body?.role ?? 'donor';
  const status = body?.status ?? 'Active';
  const roles = rolesFor(role, status);
  const password = randomPassword();

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, roles },
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? 'User could not be created.' }, { status: 500 });
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: authData.user.id,
    email,
    full_name: fullName,
    roles,
    identity_verified: false,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (body?.sendWelcome) {
    await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.eli54u.com'}/login`,
    });
  }

  return NextResponse.json({ ok: true, id: authData.user.id });
}
