import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { randomPassword, rolesFor, verifyAdmin, verifySuperAdmin } from './_auth';

const CreateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(180),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(['donor', 'organizer', 'nonprofit', 'beneficiary', 'admin', 'super_admin']).default('donor'),
  status: z.enum(['Active', 'Suspended', 'Inactive']).default('Active'),
  sendWelcome: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = CreateUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { role, status } = parsed.data;
  if ((role === 'admin' || role === 'super_admin') && !(await verifySuperAdmin())) {
    return NextResponse.json(
      { error: 'Only a super admin can create privileged accounts.', code: 'SUPER_ADMIN_REQUIRED' },
      { status: 403 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const fullName = parsed.data.fullName;
  const roles = rolesFor(role, status);
  const rawPw = parsed.data.password?.trim();
  const password = rawPw && rawPw.length >= 8 ? rawPw : randomPassword();

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

  if (parsed.data.sendWelcome) {
    await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com'}/login`,
    });
  }

  return NextResponse.json({ ok: true, id: authData.user.id });
}
