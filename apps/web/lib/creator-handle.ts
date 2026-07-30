// ─────────────────────────────────────────────────────────────────────────────
// Creator handle policy.
//
// Pure, and separate from the route, for one reason: `app/api/creators/profile`
// imports `server-only`, so a test cannot import it — the rules would have
// shipped with the route's source scanned for auth and nothing checking what
// they actually accept. A handle becomes a permanent public URL and is UNIQUE at
// the database level, so "what counts as a valid handle" is worth testing
// directly.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Names that must never become a creator handle. Two groups, both real:
 *   • route collisions — `/creators/<handle>` is a real path segment, so
 *     `/creators/settings` must not resolve to a person
 *   • impersonation — a handle that reads as CharitMe staff
 *
 * Kept as an explicit list rather than a pattern: a regex here would either be
 * too loose to matter, or would reject legitimate names — `admin` must go, but
 * a creator called `adminah` is fine.
 */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  'new', 'edit', 'settings', 'admin', 'api', 'support', 'help', 'about',
  'charitme', 'staff', 'team', 'official', 'moderator', 'billing', 'security',
  'me', 'you', 'null', 'undefined',
]);

/**
 * 3–30 characters, lowercase alphanumeric plus `-`/`_`, and it may not start or
 * end with a separator. The edge rule is not cosmetic: a trailing hyphen makes
 * two visually different handles that read as the same name, which is the shape
 * impersonation uses.
 */
export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])$/;

export const HANDLE_MESSAGE =
  'Handle must be 3–30 characters: lowercase letters, numbers, hyphens or underscores, starting and ending with a letter or number.';

export const RESERVED_MESSAGE = 'That handle is reserved.';

/** `null` when the handle is acceptable, otherwise the message to show the user. */
export function handleError(raw: string): string | null {
  const handle = raw.trim().toLowerCase();
  if (!HANDLE_RE.test(handle)) return HANDLE_MESSAGE;
  if (RESERVED_HANDLES.has(handle)) return RESERVED_MESSAGE;
  return null;
}
