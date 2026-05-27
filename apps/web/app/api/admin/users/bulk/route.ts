import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { randomPassword, rolesFor, verifyAdmin } from '../_auth';

type ImportUser = {
  fullname?: string;
  fullName?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
};

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    action?: string;
    ids?: string[];
    users?: ImportUser[];
  } | null;

  if (!body?.action) return NextResponse.json({ error: 'Action is required.' }, { status: 400 });

  if (body.action === 'import') {
    const rows = body.users ?? [];
    const created: string[] = [];
    for (const row of rows) {
      const email = row.email?.trim().toLowerCase();
      const fullName = (row.fullName ?? row.fullname ?? row.name)?.trim();
      if (!email || !fullName) continue;
      const role = row.role ?? 'donor';
      const status = row.status ?? 'Active';
      const roles = rolesFor(role, status);
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
  if (ids.length === 0) return NextResponse.json({ error: 'Select at least one user.' }, { status: 400 });

  for (const id of ids) {
    const { data } = await supabaseAdmin.from('profiles').select('roles').eq('id', id).single();
    const currentRoles = Array.isArray(data?.roles) ? data.roles.map(String) : ['donor'];
    let role = currentRoles.find((item) => !['suspended', 'inactive'].includes(item)) ?? 'donor';
    let status = currentRoles.includes('suspended') ? 'Suspended' : currentRoles.includes('inactive') ? 'Inactive' : 'Active';
    if (body.action === 'activate') status = 'Active';
    if (body.action === 'suspend') status = 'Suspended';
    if (['donor', 'organizer', 'nonprofit', 'beneficiary', 'admin'].includes(body.action)) role = body.action;
    await supabaseAdmin.from('profiles').update({ roles: rolesFor(role, status), updated_at: new Date().toISOString() }).eq('id', id);
  }

  return NextResponse.json({ ok: true, updated: ids.length });
}
