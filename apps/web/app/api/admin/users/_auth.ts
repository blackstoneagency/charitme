import { createClient } from '../../../../lib/supabase-server';
import { isAdmin } from '../../../../lib/roles';

export async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const allowed = await isAdmin(user.id, user.email);
  if (!allowed) return null;
  return user;
}

export function rolesFor(role: string, status: string): string[] {
  const normalizedRole = ['donor', 'organizer', 'nonprofit', 'beneficiary', 'admin'].includes(role) ? role : 'donor';
  const roles = new Set<string>([normalizedRole]);
  if (normalizedRole !== 'donor') roles.add('donor');
  if (status === 'Suspended') roles.add('suspended');
  if (status === 'Inactive') roles.add('inactive');
  return [...roles];
}

export function randomPassword() {
  return `Kf-${crypto.randomUUID()}!`;
}
