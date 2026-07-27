import 'server-only';
import { supabaseAdmin } from './supabase';
import { fetchRepoSnapshot, type RepoSnapshot } from './github';
import {
  buildContextPack,
  type AgentDefinition,
  type ContextPack,
  type ContextSource,
  type FactValues,
  type SourceHealth,
} from './ai-agents-core';

// ─────────────────────────────────────────────────────────────────────────────
// Context assembly — the I/O half of the AI Context Manager.
//
// Reads the two sources an agent can draw on (the repository and the platform
// database) and hands the results to the pure builder. Every count is
// `number | null`: supabase-js RESOLVES rather than throws on a query error, so
// a bare `count` is null on failure and `count ?? 0` would quietly report a
// healthy-looking zero for an unreadable table. That coercion is the single
// defect class this console exists to avoid reporting, so it does not appear
// here.
// ─────────────────────────────────────────────────────────────────────────────

export type PlatformFacts = {
  health: SourceHealth;
  users: number | null;
  activeCampaigns: number | null;
  donations: number | null;
  openSupportCases: number | null;
  openRiskFlags: number | null;
};

type Countable = { count: number | null; error: unknown };

/** `null` on any error — an unread table is unknown, never zero. */
function toCount(result: Countable): number | null {
  return result.error ? null : result.count;
}

export async function fetchPlatformFacts(): Promise<PlatformFacts> {
  const head = { count: 'exact' as const, head: true };
  try {
    const [users, campaigns, donations, support, risk] = await Promise.all([
      supabaseAdmin.from('profiles').select('id', head),
      supabaseAdmin.from('campaigns').select('id', head).eq('status', 'active'),
      supabaseAdmin.from('donations').select('id', head),
      supabaseAdmin.from('support_cases').select('id', head).in('status', ['open', 'in_progress']),
      supabaseAdmin.from('risk_flags').select('id', head).eq('resolved', false),
    ]);

    const counts = [users, campaigns, donations, support, risk].map(toCount);
    return {
      // Reaching the database at all is what 'connected' asserts; individual
      // nulls still travel with the specific fact that failed.
      health: counts.every((c) => c === null) ? 'unreadable' : 'connected',
      users: counts[0],
      activeCampaigns: counts[1],
      donations: counts[2],
      openSupportCases: counts[3],
      openRiskFlags: counts[4],
    };
  } catch {
    return {
      health: 'unreadable',
      users: null,
      activeCampaigns: null,
      donations: null,
      openSupportCases: null,
      openRiskFlags: null,
    };
  }
}

export type ContextSnapshot = {
  repo: RepoSnapshot;
  platform: PlatformFacts;
  health: Record<ContextSource, SourceHealth>;
};

/** Read both sources once. Callers derive every agent's status from this. */
export async function fetchContextSnapshot(): Promise<ContextSnapshot> {
  const [repo, platform] = await Promise.all([fetchRepoSnapshot(), fetchPlatformFacts()]);
  return { repo, platform, health: { github: repo.health, supabase: platform.health } };
}

/** Flatten a snapshot into the fact values the pure builder consumes. */
export function snapshotToFactValues(snapshot: ContextSnapshot): FactValues {
  const { repo, platform } = snapshot;
  return {
    // A connected repo with no open milestone is a real answer, not a failure —
    // so it reports "No open milestone" rather than an em dash.
    sprint: repo.health === 'connected' ? (repo.sprint?.title ?? 'No open milestone') : null,
    openIssues: repo.openIssues,
    openPullRequests: repo.openPullRequests,
    users: platform.users,
    activeCampaigns: platform.activeCampaigns,
    donations: platform.donations,
    openSupportCases: platform.openSupportCases,
    openRiskFlags: platform.openRiskFlags,
  };
}

/** Assemble one agent's context pack from a freshly read snapshot. */
export async function buildAgentContext(agent: AgentDefinition): Promise<{
  pack: ContextPack;
  snapshot: ContextSnapshot;
}> {
  const snapshot = await fetchContextSnapshot();
  const pack = buildContextPack(agent, snapshotToFactValues(snapshot), new Date().toISOString());
  return { pack, snapshot };
}
