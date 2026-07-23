import 'server-only';
import { cache } from 'react';
import { createClient } from './supabase-server';
import { redirect } from 'next/navigation';
import { isAdmin, isSuperAdmin } from './roles';
import { ensureUserProfile } from './profile-sync';

// Per-request memoized: layout + page + shell all resolve the session user, and
// supabase.auth.getUser() is a network JWT validation. React cache() collapses
// those to a single auth round-trip per request (no-op outside a request scope).
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/login');
  await ensureUserProfile(user);
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

/**
 * Requires the session user to be a SUPER admin (owner-tier). Gates the
 * Super-Admin Console. Redirects admins to /admin and others to /dashboard.
 */
export async function requireSuperAdmin() {
  const user = await requireUser();
  const allowed = await isSuperAdmin(user.id, user.email);
  if (!allowed) redirect('/admin');
  return user;
}

/**
 * True when the user owns the campaign or is a platform admin.
 * Used by campaign tool APIs so admins can operate on any campaign.
 */
export async function canManageCampaign(
  user: { id: string; email?: string | null },
  campaignUserId: string,
): Promise<boolean> {
  if (campaignUserId === user.id) return true;
  return isAdmin(user.id, user.email);
}
