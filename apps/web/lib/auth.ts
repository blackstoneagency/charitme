import 'server-only';
import { createClient } from './supabase-server';
import { supabaseAdmin } from './supabase';
import { redirect } from 'next/navigation';

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
 * Requires the session user to have the 'admin' role in their profiles.roles jsonb array.
 * Redirects to /dashboard if not an admin.
 */
export async function requireAdmin() {
  const user = await requireUser();
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('roles')
    .eq('id', user.id)
    .single();
  const roles: string[] = Array.isArray(profile?.roles) ? (profile.roles as string[]) : [];
  if (!roles.includes('admin')) redirect('/dashboard');
  return user;
}
