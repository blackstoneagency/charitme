// ─────────────────────────────────────────────────────────────────────────────
// Forgiving URL entry.
//
// Several profile fields are validated server-side with zod's `.url()`, which
// rejects a bare domain. People overwhelmingly type "myorg.com", not
// "https://myorg.com", and the resulting failure surfaced only as a generic
// "Invalid input" toast that did not say which field was at fault. Adding the
// scheme is what the organizer meant, so do that rather than reject the save.
//
// Deliberately conservative: anything already carrying a scheme is returned
// untouched, and anything that does not look like a domain is left alone so the
// server still rejects genuine nonsense rather than having it silently
// "fixed" into a valid-looking URL.
// ─────────────────────────────────────────────────────────────────────────────

// A hierarchical scheme must be followed by "//". Matching a bare `scheme:`
// would misread a host:port — "example.com:8080" looks like the scheme
// "example.com" because dots and hyphens are legal scheme characters.
const HAS_HIERARCHICAL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** Schemes with no `//` authority, which must still be left alone. */
const HAS_OPAQUE_SCHEME = /^(?:mailto|tel|sms|data|javascript):/i;

/** A bare host with at least one dot and a plausible TLD, optionally with a path. */
const LOOKS_LIKE_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i;

/**
 * Add `https://` to a bare domain. Returns the input unchanged when it is empty,
 * already has a scheme, is protocol-relative, or does not look like a domain.
 */
export function normalizeUrl(input: string): string {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return trimmed;
  if (HAS_HIERARCHICAL_SCHEME.test(trimmed) || HAS_OPAQUE_SCHEME.test(trimmed)) return trimmed;
  // Protocol-relative ("//cdn.example.com") already resolves against the page.
  if (trimmed.startsWith('//')) return trimmed;
  if (!LOOKS_LIKE_DOMAIN.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
