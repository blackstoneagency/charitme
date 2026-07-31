// ─────────────────────────────────────────────────────────────────────────────
// Role primitives — the pure, CLIENT-SAFE half of the role system.
//
// Split out of lib/roles.ts because that module imports `supabaseAdmin`, which is
// server-only. Anything a 'use client' component needs (the union, the assignable
// list, and whitelist parsing) is pure data and lives here; the lookups that hit
// the database stay in lib/roles.ts and re-export these for existing callers.
//
// Without this split, importing a role helper into a client component fails the
// production build with "You're importing a component that needs server-only" —
// which typecheck, lint and unit tests all pass straight through.
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'donor' | 'organizer' | 'beneficiary' | 'nonprofit' | 'admin' | 'super_admin';

export const ASSIGNABLE_ROLES: readonly UserRole[] = [
  'donor', 'organizer', 'beneficiary', 'nonprofit', 'admin', 'super_admin',
] as const;

export function parseRoles(raw: unknown): UserRole[] {
  if (!Array.isArray(raw)) return ['donor'];
  const roles = raw.filter((role): role is UserRole =>
    (ASSIGNABLE_ROLES as readonly string[]).includes(String(role))
  );
  return roles.length > 0 ? roles : ['donor'];
}

// ─────────────────────────────────────────────────────────────────────────────
// Suspension.
//
// There is no `profiles.status` column — the live table has 26 columns and
// `status` is not among them. Suspension is written by the super-admin console
// as a bare 'suspended' string appended to the `roles` jsonb.
//
// `parseRoles` above whitelists against ASSIGNABLE_ROLES, and 'suspended' is
// deliberately not in that list (it is a status, not a grantable role). So the
// marker is invisible to every consumer of the shared helper — getUserRoles,
// isAdmin, isSuperAdmin. That is correct for role resolution and catastrophic
// for enforcement: staff suspended a fraudulent fundraiser, the console showed
// "Suspended" (it reads the raw array through its own local parser), and the
// account carried on collecting donations.
//
// This reads the RAW array on purpose. Do not route it through parseRoles.
// ─────────────────────────────────────────────────────────────────────────────

export const SUSPENDED_MARKER = 'suspended';

/** True when the raw `profiles.roles` value carries the suspension marker. */
export function isSuspendedRoles(raw: unknown): boolean {
  if (Array.isArray(raw)) return raw.map(String).includes(SUSPENDED_MARKER);
  // Older rows and some clients store the jsonb as a string.
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).includes(SUSPENDED_MARKER);
    } catch {
      return raw.trim() === SUSPENDED_MARKER;
    }
  }
  return false;
}
