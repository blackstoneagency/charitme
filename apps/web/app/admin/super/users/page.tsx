import { boundedQuery } from '../../../../lib/query-timeout';
import 'server-only';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireSuperAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { parseRoles } from '../../../../lib/roles';
import SuperUsersClient, { type DirUser } from './SuperUsersClient';

export const dynamic = 'force-dynamic';

export default async function SuperAdminUsersPage() {
  await requireSuperAdmin();

  const [{ data, error }, { count }] = await Promise.all([
    boundedQuery(() => supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, avatar_url, roles, plan, identity_verified, created_at')
      .order('created_at', { ascending: false })
      .limit(2000)),
    boundedQuery(() => supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true })),
  ]);
  if (error) console.error('[SuperAdminUsers] profiles error', error.message);

  const users: DirUser[] = (data ?? []).map((p) => {
    const roles = parseRoles(p.roles);
    return {
      id: p.id as string,
      name: (p.full_name as string) || (p.email as string)?.split('@')[0] || 'User',
      email: (p.email as string) ?? '',
      roles: roles.filter((r) => r !== ('suspended' as never)),
      suspended: (parseRoles(p.roles) as string[]).includes('suspended'),
      plan: (p.plan as string) ?? 'free',
      verified: Boolean(p.identity_verified),
      joinedAt: p.created_at as string,
    };
  });

  return (
    <CharitMeShell active="Users" mode="admin">
      <TopBar title="Users" subtitle={`${(count ?? users.length).toLocaleString()} accounts · directory & account controls`} />
      <SuperUsersClient users={users} total={count ?? users.length} />
    </CharitMeShell>
  );
}
