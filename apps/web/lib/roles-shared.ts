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
