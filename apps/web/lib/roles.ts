import { supabaseAdmin } from './supabase';

export type UserRole = 'donor' | 'organizer' | 'beneficiary' | 'nonprofit' | 'admin';

export function parseRoles(raw: unknown): UserRole[] {
  if (!Array.isArray(raw)) return ['donor'];
  const roles = raw.filter((role): role is UserRole =>
    ['donor', 'organizer', 'beneficiary', 'nonprofit', 'admin'].includes(String(role))
  );
  return roles.length > 0 ? roles : ['donor'];
}

export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const { data } = await supabaseAdmin.from('profiles').select('roles').eq('id', userId).single();
  return parseRoles(data?.roles);
}

export async function isAdmin(userId: string, email?: string | null): Promise<boolean> {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (email && adminEmails.includes(email.toLowerCase())) return true;
  return (await getUserRoles(userId)).includes('admin');
}
