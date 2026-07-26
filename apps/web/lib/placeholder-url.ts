// ─────────────────────────────────────────────────────────────────────────────
// Placeholder-URL detection.
//
// Seed and imported data carries RFC 2606 documentation domains — production
// currently holds **240 grants whose "Apply" link points at `example.org`** and
// **120 events whose "Join link" does**. Rendering those as real links sends
// visitors to a domain that is reserved, by standard, to never resolve: the link
// looks live, is clickable, and always fails.
//
// RFC 2606 §2–3 reserves `.test`, `.example`, `.invalid`, `.localhost` and the
// second-level names `example.com` / `example.net` / `example.org` precisely so
// they can be recognised as non-real. That is what makes this a sound check and
// not a guess about someone's domain.
//
// The rule is deliberately narrow: it must never hide a link a real fundraiser
// entered. Anything it does not positively recognise is treated as real.
// ─────────────────────────────────────────────────────────────────────────────

/** TLDs reserved by RFC 2606 §2 — guaranteed never to resolve. */
const RESERVED_TLDS = new Set(['test', 'example', 'invalid', 'localhost']);

/** Second-level names reserved by RFC 2606 §3 for documentation. */
const RESERVED_DOMAINS = new Set(['example.com', 'example.net', 'example.org']);

/**
 * True when a URL is a documentation/placeholder address that cannot resolve.
 *
 * Non-strings, empty values and unparseable input return `false` — callers use
 * this to *suppress* a link, and the safe default is to leave a link alone.
 */
export function isPlaceholderUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const raw = value.trim();
  if (!raw) return false;

  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    // Not an absolute URL — a relative path is an internal link, never a placeholder.
    return false;
  }
  if (!host) return false;

  const withoutTrailingDot = host.endsWith('.') ? host.slice(0, -1) : host;
  const labels = withoutTrailingDot.split('.');
  const tld = labels[labels.length - 1] ?? '';
  if (RESERVED_TLDS.has(tld)) return true;

  // `example.org` and any subdomain of it (`docs.example.org`).
  const lastTwo = labels.slice(-2).join('.');
  return RESERVED_DOMAINS.has(lastTwo);
}

/**
 * The URL if it is safe to present as a working link, otherwise `null`.
 *
 * Use at the render site so a placeholder degrades to "no link" rather than a
 * link that is guaranteed to 404.
 */
export function realUrlOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  return isPlaceholderUrl(raw) ? null : raw;
}
