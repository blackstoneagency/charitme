import 'server-only';
import type { SourceHealth } from './ai-agents-core';
import { countFromPagination, deriveOpenIssues, parseRepoSlug } from './github-core';

// ─────────────────────────────────────────────────────────────────────────────
// GitHub repository snapshot — the delivery-side half of the AI context pack.
//
// Deliberately narrow: open issue count, open PR count, and the current sprint
// (the earliest open milestone). Nothing here writes.
//
// Only repo-scoped `repos/{owner}/{repo}/...` endpoints are used. The Search API
// would give issue counts in one call, but it is not repo-scoped and is refused
// outright by gateways that bind a token to specific repositories — this
// project's own agent sandbox returns 403 "sessions are bound to their
// configured repositories" for it. The arithmetic that replaces it lives in
// github-core.ts.
//
// Failure behaviour is the point. Counts are `number | null`; `null` means "we
// could not read it" and renders as an em dash. A repo with 14 open issues and a
// repo we could not reach must never both display "0" — on this screen 0 is the
// reassuring answer, so it has to be earned.
//
// No token → `not-configured`, and we do NOT fall back to an unauthenticated
// call: this repository is private, so an anonymous request returns 404 and would
// be indistinguishable from "the repo is empty".
// ─────────────────────────────────────────────────────────────────────────────

const API = 'https://api.github.com';
const TIMEOUT_MS = 8_000;
/** One minute — sprint boards do not move faster, and this bounds API spend. */
const REVALIDATE_SECONDS = 60;

/** The repo the console reports on. Actions sets GITHUB_REPOSITORY for free. */
export function githubRepoSlug(): string | null {
  return parseRepoSlug(process.env.GITHUB_REPO ?? process.env.GITHUB_REPOSITORY);
}

function githubToken(): string | null {
  const token = (process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT ?? '').trim();
  return token === '' ? null : token;
}

/** True when both a token and a well-formed repo slug are present. */
export function githubConfigured(): boolean {
  return githubToken() !== null && githubRepoSlug() !== null;
}

export type Sprint = {
  title: string;
  number: number;
  dueOn: string | null;
  openIssues: number;
  closedIssues: number;
  url: string;
};

export type RepoSnapshot = {
  health: SourceHealth;
  repo: string | null;
  openIssues: number | null;
  openPullRequests: number | null;
  /** null with health 'connected' means "no open milestone", which is a fact. */
  sprint: Sprint | null;
  /** Operator-facing explanation when health is not 'connected'. Never a secret. */
  reason: string | null;
};

const NOT_CONFIGURED = (reason: string): RepoSnapshot => ({
  health: 'not-configured',
  repo: githubRepoSlug(),
  openIssues: null,
  openPullRequests: null,
  sprint: null,
  reason,
});

type Fetched<T> =
  | { ok: true; body: T; link: string | null }
  | { ok: false; reason: string };

async function gh<T>(path: string): Promise<Fetched<T>> {
  const token = githubToken();
  if (!token) return { ok: false, reason: 'GITHUB_TOKEN is not set' };
  try {
    const res = await fetch(`${API}${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'charitme-ai-control-center',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      // Status only — a GitHub (or gateway) error body can echo the request, so
      // it is not safe to surface verbatim on an admin screen.
      const hint =
        res.status === 401 ? 'the token was rejected'
        : res.status === 403 ? 'forbidden or rate-limited'
        : res.status === 404 ? 'repo not found, or the token cannot see it'
        : 'unexpected response';
      return { ok: false, reason: `GitHub returned ${res.status} — ${hint}` };
    }
    return { ok: true, body: (await res.json()) as T, link: res.headers.get('link') };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return {
      ok: false,
      reason: timedOut ? `GitHub did not respond within ${TIMEOUT_MS / 1000}s` : 'GitHub request failed',
    };
  }
}

type RepoResult = { open_issues_count?: number };
type MilestoneResult = {
  title?: string;
  number?: number;
  due_on?: string | null;
  open_issues?: number;
  closed_issues?: number;
  html_url?: string;
};

/** Read the repository's delivery state. Never throws; degrades to nulls. */
export async function fetchRepoSnapshot(): Promise<RepoSnapshot> {
  const repo = githubRepoSlug();
  if (!githubToken()) return NOT_CONFIGURED('GITHUB_TOKEN is not set');
  if (!repo) return NOT_CONFIGURED('GITHUB_REPO is not set (expected "owner/name")');

  const [repoRes, pullsRes, milestonesRes] = await Promise.all([
    gh<RepoResult>(`/repos/${repo}`),
    // per_page=1 so the last page number IS the count; see countFromPagination.
    gh<unknown[]>(`/repos/${repo}/pulls?state=open&per_page=1`),
    gh<MilestoneResult[]>(`/repos/${repo}/milestones?state=open&sort=due_on&direction=asc&per_page=1`),
  ]);

  const openPullRequests = pullsRes.ok
    ? countFromPagination(pullsRes.link, Array.isArray(pullsRes.body) ? pullsRes.body.length : null)
    : null;

  const issuesAndPulls =
    repoRes.ok && typeof repoRes.body.open_issues_count === 'number' ? repoRes.body.open_issues_count : null;

  let sprint: Sprint | null = null;
  if (milestonesRes.ok) {
    const m = Array.isArray(milestonesRes.body) ? milestonesRes.body[0] : undefined;
    if (m && typeof m.title === 'string' && typeof m.number === 'number') {
      sprint = {
        title: m.title,
        number: m.number,
        dueOn: m.due_on ?? null,
        openIssues: m.open_issues ?? 0,
        closedIssues: m.closed_issues ?? 0,
        url: m.html_url ?? `https://github.com/${repo}/milestone/${m.number}`,
      };
    }
  }

  const failures = [repoRes, pullsRes, milestonesRes].filter((r) => !r.ok) as { ok: false; reason: string }[];

  return {
    // Any failed leg means the snapshot is partial. Callers that print a number
    // still get null for the specific leg that failed.
    health: failures.length === 0 ? 'connected' : 'unreadable',
    repo,
    openIssues: deriveOpenIssues(issuesAndPulls, openPullRequests),
    openPullRequests,
    sprint,
    reason: failures.length === 0 ? null : failures[0].reason,
  };
}
