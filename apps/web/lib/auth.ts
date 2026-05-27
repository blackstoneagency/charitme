import 'server-only';
import { createClient } from './supabase-server';
import { redirect } from 'next/navigation';
import { isAdmin } from './roles';

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Requires the session user to be an admin.
 * Checks ADMIN_EMAILS env var first, then profile roles.
 * Redirects to /dashboard if not an admin.
 */
export async function requireAdmin() {
  const user = await requireUser();
  const allowed = await isAdmin(user.id, user.email);
  if (!allowed) redirect('/dashboard');
  return user;
}
