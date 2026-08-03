import { boundedQuery } from '../../../../lib/query-timeout';
import 'server-only';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireSuperAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { parseRoles } from '../../../../lib/roles';
import RolesClient, { type RoleUser } from './RolesClient';

export const dynamic = 'force-dynamic';

export default async function SuperAdminRolesPage() {
  await requireSuperAdmin();

  const { data } = await boundedQuery(() => supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, avatar_url, roles, created_at')
    .order('created_at', { ascending: false })
    .limit(2000));

  const users: RoleUser[] = (data ?? []).map((p) => ({
    id: p.id as string,
    name: (p.full_name as string) || (p.email as string)?.split('@')[0] || 'User',
    email: (p.email as string) ?? '',
    avatarUrl: (p.avatar_url as string) ?? null,
    roles: parseRoles(p.roles),
  }));

  return (
    <CharitMeShell active="Roles & Permissions" mode="admin">
      <TopBar title="Roles & Permissions" subtitle={`${users.length.toLocaleString()} accounts · assign platform roles`} />
      <RolesClient users={users} />
    </CharitMeShell>
  );
}
