import { createClient } from '../../../../lib/supabase-server';
import { isAdmin, isSuperAdmin } from '../../../../lib/roles';
import { ASSIGNABLE_ROLES } from '../../../../lib/roles-shared';

export async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const allowed = await isAdmin(user.id, user.email);
  if (!allowed) return null;
  return user;
}

export async function verifySuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return await isSuperAdmin(user.id, user.email) ? user : null;
}

export function hasPrivilegedRole(raw: unknown): boolean {
  return Array.isArray(raw) && raw.some((role) => role === 'admin' || role === 'super_admin');
}

export function rolesFor(role: string, status: string): string[] {
  const normalizedRole = (ASSIGNABLE_ROLES as readonly string[]).includes(role) ? role : 'donor';
  const roles = new Set<string>([normalizedRole]);
  if (normalizedRole !== 'donor') roles.add('donor');
  if (normalizedRole === 'super_admin') roles.add('admin');
  if (status === 'Suspended') roles.add('suspended');
  if (status === 'Inactive') roles.add('inactive');
  return [...roles];
}

export function rolesWithStatus(raw: unknown, status: string): string[] {
  const roles = new Set(
    Array.isArray(raw)
      ? raw.map(String).filter((role) => (ASSIGNABLE_ROLES as readonly string[]).includes(role))
      : ['donor'],
  );
  roles.add('donor');
  if (roles.has('super_admin')) roles.add('admin');
  if (status === 'Suspended') roles.add('suspended');
  if (status === 'Inactive') roles.add('inactive');
  return [...roles];
}

export function randomPassword() {
  return `Kf-${crypto.randomUUID()}!`;
}
