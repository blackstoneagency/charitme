import { AI_EMPLOYEE_DOCS, AI_CURRENT_SPRINT } from './ai-roster.generated';

// ─────────────────────────────────────────────────────────────────────────────
// AI Control Center — agent roster and context assembly (PURE).
//
// Phase 1 of the AI Context Manager. This module holds no I/O: it says what each
// agent needs to know and how a readiness status is DERIVED from measured source
// health. Everything network- or database-shaped lives in lib/github.ts and
// lib/ai-context.ts.
//
// WHO the agents are is NOT defined here. The roster is the set of documents in
// AI/employees/ at the repository root, compiled into ai-roster.generated.ts by
// scripts/generate-ai-roster.mjs. Adding an employee means adding a document —
// there is no second list in TypeScript to keep in sync, because a hardcoded
// parallel roster would drift from the documents the owner actually maintains.
//
// What this module adds on top of a document is the LIVE data to attach to it
// (FACT_ASSIGNMENT below), since a markdown charter cannot say how many pull
// requests are open.
//
// Design rule carried over from the rest of the admin console: a status is only
// ever as good as what was actually measured. There is no path here that returns
// 'Ready' for a source nobody checked, and no fact renders as 0 because a read
// failed — unknown is `null` and prints as an em dash.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Where a fact comes from.
 *
 * 'docs' is the AI/ markdown compiled into the bundle. It is an ordinary import,
 * so it cannot fail at request time — which is exactly why the sprint reads from
 * there rather than from a GitHub milestone.
 */
export type ContextSource = 'github' | 'supabase' | 'docs';

/** Measured health of one context source. Never inferred. */
export type SourceHealth = 'connected' | 'unreadable' | 'not-configured';

/** Agent readiness, derived only from the health of its required sources. */
export type AgentStatus = 'Ready' | 'Degraded' | 'Needs setup';

/** Every fact the context manager knows how to assemble. */
export type FactKey =
  | 'sprint'
  | 'openIssues'
  | 'openPullRequests'
  | 'users'
  | 'activeCampaigns'
  | 'donations'
  | 'openSupportCases'
  | 'openRiskFlags';

export type FactSpec = {
  label: string;
  source: ContextSource;
  /** Rendered after the value, e.g. "14 open issues". */
  hint: string;
};

export const FACTS: Readonly<Record<FactKey, FactSpec>> = {
  sprint:           { label: 'Current sprint',        source: 'docs',     hint: 'highest AI/sprints entry' },
  openIssues:       { label: 'Open GitHub issues',    source: 'github',   hint: 'excludes pull requests' },
  openPullRequests: { label: 'Open pull requests',    source: 'github',   hint: 'awaiting review or merge' },
  users:            { label: 'Registered users',      source: 'supabase', hint: 'profiles table' },
  activeCampaigns:  { label: 'Active campaigns',      source: 'supabase', hint: 'status = active' },
  donations:        { label: 'Donations recorded',    source: 'supabase', hint: 'all time' },
  openSupportCases: { label: 'Open support cases',    source: 'supabase', hint: 'queue depth' },
  openRiskFlags:    { label: 'Open risk flags',       source: 'supabase', hint: 'trust & safety backlog' },
};

export type AgentDefinition = {
  id: string;
  name: string;
  mandate: string;
  responsibilities: readonly string[];
  kpis: readonly string[];
  /** Facts assembled into this agent's context pack, in render order. */
  facts: readonly FactKey[];
  /**
   * Sources that must be healthy for this agent to be Ready. DERIVED from
   * `facts`, never hand-written: the first version of this file declared the two
   * separately and QA Engineer ended up reading a Supabase fact while requiring
   * only GitHub, so it would have displayed **Ready** with the database down.
   * Deriving it makes that class of mistake unrepresentable.
   */
  requires: readonly ContextSource[];
};

/**
 * Which live facts attach to which employee document.
 *
 * The documents describe the role; they cannot know what data exists on this
 * platform. An id with no entry here falls back to DEFAULT_FACTS, so dropping a
 * new employee markdown file into AI/employees/ works without a code change.
 */
const FACT_ASSIGNMENT: Readonly<Record<string, readonly FactKey[]>> = {
  'executive-assistant': ['sprint', 'openIssues', 'openPullRequests', 'users', 'activeCampaigns', 'donations', 'openSupportCases'],
  'product-manager':     ['sprint', 'openIssues', 'activeCampaigns'],
  'lead-engineer':       ['sprint', 'openIssues', 'openPullRequests'],
  'release-manager':     ['sprint', 'openIssues', 'openPullRequests'],
  'qa-engineer':         ['openIssues', 'openPullRequests', 'activeCampaigns'],
  'security-engineer':   ['openIssues', 'openRiskFlags', 'openSupportCases'],
  'database-architect':  ['openIssues', 'users', 'donations'],
  'stripe-engineer':     ['openIssues', 'donations'],
  'ux-designer':         ['openIssues', 'activeCampaigns'],
  'marketing-director':  ['users', 'activeCampaigns', 'donations'],
};

const DEFAULT_FACTS: readonly FactKey[] = ['sprint', 'openIssues', 'openPullRequests'];

/** The sprint named by AI/sprints, or null when no numbered sprint exists. */
export const CURRENT_SPRINT = AI_CURRENT_SPRINT;

/**
 * The roster: one agent per AI/employees/*.md document, in document order.
 *
 * `requires` is derived from the assigned facts, so an agent can never claim
 * readiness for a source it silently reads.
 */
export const AI_AGENTS: readonly AgentDefinition[] = AI_EMPLOYEE_DOCS.map((doc) => {
  const facts = FACT_ASSIGNMENT[doc.id] ?? DEFAULT_FACTS;
  return {
    id: doc.id,
    name: doc.name,
    mandate: doc.mission,
    responsibilities: doc.responsibilities,
    kpis: doc.kpis,
    facts,
    requires: [...new Set(facts.map((k) => FACTS[k].source))],
  };
});

/** Look up an agent by id. Returns null rather than throwing on an unknown id. */
export function agentById(id: string): AgentDefinition | null {
  return AI_AGENTS.find((a) => a.id === id) ?? null;
}

/**
 * Derive readiness from measured health.
 *
 * `not-configured` outranks `unreadable` because it is the more actionable
 * answer: one needs a credential, the other needs a retry. An agent is only
 * 'Ready' when every source it requires was actually reached.
 */
export function resolveAgentStatus(
  agent: Pick<AgentDefinition, 'requires'>,
  health: Readonly<Partial<Record<ContextSource, SourceHealth>>>,
): AgentStatus {
  const states = agent.requires.map((s) => health[s] ?? 'not-configured');
  if (states.includes('not-configured')) return 'Needs setup';
  if (states.includes('unreadable')) return 'Degraded';
  return 'Ready';
}

/** Colour token for a status. Grey is deliberate: unknown must not look green. */
export function statusTone(status: AgentStatus): 'green' | 'amber' | 'grey' {
  if (status === 'Ready') return 'green';
  if (status === 'Degraded') return 'amber';
  return 'grey';
}

/** A single assembled fact. `value === null` means unread, which is not zero. */
export type ContextFact = {
  key: FactKey;
  label: string;
  hint: string;
  source: ContextSource;
  value: string | null;
};

export type FactValues = Partial<Record<FactKey, string | number | null>>;

export type ContextPack = {
  agentId: string;
  agentName: string;
  mandate: string;
  responsibilities: readonly string[];
  kpis: readonly string[];
  facts: ContextFact[];
  /** Labels of facts that could not be read. Empty means the pack is complete. */
  missing: string[];
  builtAt: string;
};

/** Render one fact value; unknown becomes an em dash, never 0 and never blank. */
export function formatFactValue(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Assemble an agent's context pack from already-resolved values. Pure: callers
 * do the I/O and hand the results in, so this is fully testable and cannot
 * silently substitute a default for a failed read.
 */
export function buildContextPack(
  agent: AgentDefinition,
  values: FactValues,
  builtAt: string,
): ContextPack {
  const facts: ContextFact[] = agent.facts.map((key) => ({
    key,
    label: FACTS[key].label,
    hint: FACTS[key].hint,
    source: FACTS[key].source,
    value: formatFactValue(values[key]),
  }));
  return {
    agentId: agent.id,
    agentName: agent.name,
    mandate: agent.mandate,
    responsibilities: agent.responsibilities,
    kpis: agent.kpis,
    facts,
    missing: facts.filter((f) => f.value === null).map((f) => f.label),
    builtAt,
  };
}

/**
 * The pack as markdown, ready to paste into an agent session. Unknown facts are
 * carried through as "unknown (read failed)" rather than dropped — an agent that
 * silently never sees a fact will assume the favourable value for it.
 */
export function contextPackToMarkdown(pack: ContextPack): string {
  const lines: string[] = [
    `# ${pack.agentName} — context pack`,
    '',
    pack.mandate,
    '',
    '## Responsibilities',
    ...pack.responsibilities.map((r) => `- ${r}`),
  ];
  if (pack.kpis.length > 0) {
    lines.push('', '## Measured on', ...pack.kpis.map((k) => `- ${k}`));
  }
  lines.push(
    '',
    '## Current state',
    ...pack.facts.map((f) => `- ${f.label}: ${f.value ?? 'unknown (read failed)'}`),
  );
  if (pack.missing.length > 0) {
    lines.push(
      '',
      '## Gaps',
      `The following could not be read and are UNKNOWN, not zero: ${pack.missing.join(', ')}.`,
    );
  }
  lines.push('', `_Built ${pack.builtAt}_`);
  return lines.join('\n');
}
