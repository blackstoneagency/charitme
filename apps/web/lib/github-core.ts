// ─────────────────────────────────────────────────────────────────────────────
// GitHub counting — the pure arithmetic, split out so it is directly testable.
//
// Two facts about the REST API drive everything here:
//
//  1. `repos/{o}/{r}.open_issues_count` counts pull requests AS issues. Verified
//     against this repository: it reports 1, and the single open item is PR #93 —
//     so the true answer is 0 issues and 1 pull request. Printing that field as
//     "Open GitHub issues" is simply wrong.
//
//  2. There is no endpoint that returns a bare open-issue count. The Search API
//     can do it (`is:issue is:open`), but it is not repo-scoped and is
//     unavailable behind gateways that restrict a token to its repositories —
//     which is exactly what happens in this project's own agent sandbox (403:
//     "sessions are bound to their configured repositories"). So the console
//     uses only `repos/{owner}/{repo}/...` paths and derives the issue count.
// ─────────────────────────────────────────────────────────────────────────────

/** Validate an "owner/name" slug. Returns null rather than a malformed path. */
export function parseRepoSlug(raw: string | null | undefined): string | null {
  const slug = (raw ?? '').trim();
  return /^[\w.-]+\/[\w.-]+$/.test(slug) ? slug : null;
}

/**
 * Total item count from a `per_page=1` listing.
 *
 * GitHub paginates, and with one item per page the last page number IS the total.
 * When the result fits on a single page GitHub omits the Link header entirely, so
 * the body length is the answer — that is the common case here, not an edge one.
 *
 * Returns null when neither signal is usable, so the caller shows an em dash
 * instead of inventing a zero.
 */
export function countFromPagination(linkHeader: string | null, pageLength: number | null): number | null {
  const last = parseLastPage(linkHeader);
  if (last !== null) return last;
  return pageLength === null ? null : pageLength;
}

/** Extract the `rel="last"` page number from a Link header. */
export function parseLastPage(linkHeader: string | null | undefined): number | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    if (!/rel\s*=\s*"?last"?/.test(part)) continue;
    const url = part.match(/<([^>]+)>/)?.[1];
    if (!url) continue;
    const page = url.match(/[?&]page=(\d+)/)?.[1];
    if (page === undefined) continue;
    const n = Number.parseInt(page, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/**
 * True issue count = the API's issues-and-PRs total, minus the pull requests.
 *
 * Either input being unknown makes the result unknown — a half-known subtraction
 * would print a confident wrong number. The clamp at 0 covers the harmless race
 * where a PR opens between the two reads; it can never manufacture a positive.
 */
export function deriveOpenIssues(
  openIssuesAndPulls: number | null,
  openPullRequests: number | null,
): number | null {
  if (openIssuesAndPulls === null || openPullRequests === null) return null;
  return Math.max(0, openIssuesAndPulls - openPullRequests);
}
