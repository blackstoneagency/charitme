import { supabaseAdmin } from './supabase';
import { ASSIGNABLE_ROLES, parseRoles, type UserRole } from './roles-shared';

// Re-exported so existing importers of lib/roles keep working unchanged.
export { ASSIGNABLE_ROLES, parseRoles };
export type { UserRole };




export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const { data } = await supabaseAdmin.from('profiles').select('roles').eq('id', userId).single();
  return parseRoles(data?.roles);
}

// Emails that are always treated as SUPER admins (full platform control),
// regardless of DB roles or env vars. Super admin implies admin.
const HARDCODED_SUPER_ADMIN_EMAILS: ReadonlySet<string> = new Set([
  'daniel.hughen@gmail.com',
  'blackstoneagencyllc@gmail.com',
]);

// Emails that are always treated as admins regardless of DB roles or env vars.
// Add additional owner/operator emails here. Stored lowercase — the check below
// lowercases the incoming email before comparing.
const HARDCODED_ADMIN_EMAILS: ReadonlySet<string> = new Set([
  'blackstoneagencyllc@gmail.com',
  'daniel.hughen@gmail.com',
]);

export async function isAdmin(userId: string, email?: string | null): Promise<boolean> {
  const lower = email?.toLowerCase();
  // 1. Hardcoded owner/super emails — highest priority, always admin
  if (lower && (HARDCODED_ADMIN_EMAILS.has(lower) || HARDCODED_SUPER_ADMIN_EMAILS.has(lower))) return true;

  // 2. ADMIN_EMAILS env var (comma-separated, set in Vercel / .env.local)
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (lower && adminEmails.includes(lower)) return true;

  // 3. Database roles array on the user's profile (admin OR super_admin)
  const roles = await getUserRoles(userId);
  return roles.includes('admin') || roles.includes('super_admin');
}

/**
 * Super admins get the exclusive Super-Admin Console (roles, users, marketing,
 * platform settings, feature flags, announcements). Checks hardcoded super
 * emails first, then the `super_admin` role on the profile.
 */
export async function isSuperAdmin(userId: string, email?: string | null): Promise<boolean> {
  const lower = email?.toLowerCase();
  if (lower && HARDCODED_SUPER_ADMIN_EMAILS.has(lower)) return true;
  return (await getUserRoles(userId)).includes('super_admin');
}
