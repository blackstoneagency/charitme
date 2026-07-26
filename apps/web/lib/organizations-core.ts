// ─────────────────────────────────────────────────────────────────────────────
// Organization role hierarchy — pure logic, no I/O.
//
// This mirrors the `case min_role ... end` ladder inside `is_org_member()` in
// 20260807000000_organizations_multitenancy.sql. The SQL is the enforcement
// point (RLS runs there, and it must); this exists because SQL branches cannot
// be unit-tested in this repo, and because any API route that gates on org role
// needs the same answer as the database — a route that disagrees with RLS either
// shows a 500 where it meant to show a 403, or implies access the DB will refuse.
//
// Deliberately NOT a security boundary on its own. Nothing here replaces the RLS
// policy; use it to decide what to render and to fail fast, never as the only
// check before a mutation.
// ─────────────────────────────────────────────────────────────────────────────

/** Org-scoped roles. Distinct from platform roles: an org `owner` runs one tenant, a platform admin is staff. */
export const ORG_ROLES = ['owner', 'admin', 'editor', 'viewer', 'member'] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

/**
 * Rank for the *privilege ladder* only — higher satisfies lower.
 *
 * `viewer` and `member` intentionally share rank 0. They are different labels for
 * the same authority level (the SQL `else true` branch admits both); the
 * distinction is descriptive, for UI copy, not a permission difference. Giving
 * `viewer` its own rank would silently create a privilege tier the database does
 * not enforce.
 */
const RANK: Record<OrgRole, number> = {
  owner: 3,
  admin: 2,
  editor: 1,
  viewer: 0,
  member: 0,
};

export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === 'string' && (ORG_ROLES as readonly string[]).includes(value);
}

/**
 * Does `role` satisfy a `minRole` requirement?
 *
 * Returns false for anything unrecognised rather than throwing — an unknown role
 * arriving from the database (a value added by a later migration, say) must fail
 * CLOSED. This is the same instinct as the `coalesce(..., false)` in the SQL
 * helper: under three-valued or unknown input, deny.
 */
export function orgRoleSatisfies(role: unknown, minRole: OrgRole = 'member'): boolean {
  if (!isOrgRole(role)) return false;
  return RANK[role] >= RANK[minRole];
}

/** Convenience predicates matching the policy names in the migration. */
export const canAdministerOrg = (role: unknown): boolean => orgRoleSatisfies(role, 'admin');
export const canEditBrands = (role: unknown): boolean => orgRoleSatisfies(role, 'editor');
export const isOwner = (role: unknown): boolean => orgRoleSatisfies(role, 'owner');
