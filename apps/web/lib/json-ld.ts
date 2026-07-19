// ─────────────────────────────────────────────────────────────────────────────
// Safe serializer for JSON-LD injected via dangerouslySetInnerHTML.
//
// JSON.stringify does NOT escape `<`, `>`, or `&`, so user-controlled fields
// (campaign titles, FAQ text, etc.) embedded in a <script type="application/ld+json">
// block can break out with `</script><script>…` — a stored XSS. Escaping these
// characters (and the U+2028/U+2029 line separators, which are invalid in JS
// string literals) to their unicode forms keeps the JSON valid while making
// script-tag breakout impossible.
// ─────────────────────────────────────────────────────────────────────────────

// < > & U+2028 U+2029 — built via escapes so no literal separators appear here.
const UNSAFE = new RegExp('[<>&\\u2028\\u2029]', 'g');

export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(
    UNSAFE,
    (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}
