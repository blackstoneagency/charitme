// Validation for caller-supplied Supabase Storage object paths.
//
// The delete endpoint authorises by `path.startsWith('campaigns/<userId>/')`.
// That prefix check is only sound if the rest of the path cannot escape the
// folder. Supabase Storage happens to treat keys as opaque strings today (so
// `a/../b` is a literal key rather than a traversal), but relying on that is
// fragile: the check would silently become a "delete anything in the bucket"
// hole if key normalisation ever changed. Validate the shape explicitly.

/** Characters allowed in a single path segment. */
const SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

/**
 * True when `path` is a plain, relative, single-bucket object key:
 * non-empty slash-separated segments, no `.`/`..`, no leading slash, no scheme,
 * no backslashes, no percent-encoding, no control characters.
 */
export function isSafeStoragePath(path: unknown): path is string {
  if (typeof path !== 'string') return false;
  if (path.length === 0 || path.length > 512) return false;
  if (path.startsWith('/') || path.includes('://') || path.includes('\\')) return false;
  if (path.includes('%')) return false;
  if (CONTROL_RE.test(path)) return false;

  const segments = path.split('/');
  if (segments.length < 2) return false; // always at least folder/file
  return segments.every((s) => s !== '.' && s !== '..' && SEGMENT_RE.test(s));
}
