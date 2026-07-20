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

// Emails that are always treated as admins regardless of DB roles or env vars.
// Add additional owner/operator emails here. Stored lowercase — the check below
// lowercases the incoming email before comparing.
const HARDCODED_ADMIN_EMAILS: ReadonlySet<string> = new Set([
  'blackstoneagencyllc@gmail.com',
  'daniel.hughen@gmail.com',
]);

export async function isAdmin(userId: string, email?: string | null): Promise<boolean> {
  // 1. Hardcoded owner emails — highest priority, always admin
  if (email && HARDCODED_ADMIN_EMAILS.has(email.toLowerCase())) return true;

  // 2. ADMIN_EMAILS env var (comma-separated, set in Vercel / .env.local)
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (email && adminEmails.includes(email.toLowerCase())) return true;

  // 3. Database roles array on the user's profile
  return (await getUserRoles(userId)).includes('admin');
}
