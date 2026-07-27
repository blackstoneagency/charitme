// ─────────────────────────────────────────────────────────────────────────────
// AI Control Center — agent roster and context assembly (PURE).
//
// Phase 1 of the AI Context Manager. This module holds no I/O: it declares which
// agents exist, what each one needs to know, and how a readiness status is
// DERIVED from measured source health. Everything network- or database-shaped
// lives in lib/github.ts and lib/ai-context.ts.
//
// Design rule carried over from the rest of the admin console: a status is only
// ever as good as what was actually measured. There is no path here that returns
// 'Ready' for a source nobody checked, and no fact renders as 0 because a read
// failed — unknown is `null` and prints as an em dash.
// ─────────────────────────────────────────────────────────────────────────────

/** External systems an agent draws its context from. */
export type ContextSource = 'github' | 'supabase';

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
  sprint:           { label: 'Current sprint',        source: 'github',   hint: 'earliest open milestone' },
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
  /** Sources that must be healthy for this agent to be Ready. */
  requires: readonly ContextSource[];
  /** Facts assembled into this agent's context pack, in render order. */
  facts: readonly FactKey[];
};

export const AI_AGENTS: readonly AgentDefinition[] = [
  {
    id: 'executive-assistant',
    name: 'Executive Assistant',
    mandate: 'Turns platform and repository state into a single decision brief for the owner.',
    responsibilities: [
      'Summarise what changed since the last check-in',
      'Surface the few decisions that actually need the owner',
      'Route work to the specialist agents',
    ],
    requires: ['github', 'supabase'],
    facts: ['sprint', 'openIssues', 'openPullRequests', 'users', 'activeCampaigns', 'donations', 'openSupportCases'],
  },
  {
    id: 'lead-engineer',
    name: 'Lead Engineer',
    mandate: 'Owns the delivery queue: what is in flight, what is blocked, what ships next.',
    responsibilities: [
      'Triage open issues into the current sprint',
      'Keep pull requests moving toward merge',
      'Flag work that has stalled',
    ],
    requires: ['github'],
    facts: ['sprint', 'openIssues', 'openPullRequests'],
  },
  {
    id: 'qa-engineer',
    name: 'QA Engineer',
    mandate: 'Guards the release gate — nothing ships without evidence that it works.',
    responsibilities: [
      'Reproduce and confirm reported defects',
      'Check that changes carry tests',
      'Verify the live surface, not just the diff',
    ],
    requires: ['github', 'supabase'],
    facts: ['openIssues', 'openPullRequests', 'activeCampaigns'],
  },
  {
    id: 'security-engineer',
    name: 'Security Engineer',
    mandate: 'Watches the trust boundary: authorisation, data exposure, and abuse signals.',
    responsibilities: [
      'Review changes that touch auth or payments',
      'Work the trust & safety backlog',
      'Escalate anything that widens access',
    ],
    requires: ['github', 'supabase'],
    facts: ['openIssues', 'openRiskFlags', 'openSupportCases'],
  },
  {
    id: 'marketing-director',
    name: 'Marketing Director',
    mandate: 'Owns growth: who is arriving, what they start, and what they give.',
    responsibilities: [
      'Track acquisition and campaign creation',
      'Brief content and lifecycle messaging',
      'Report on donation conversion',
    ],
    requires: ['supabase'],
    facts: ['users', 'activeCampaigns', 'donations'],
  },
] as const;

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
    '',
    '## Current state',
    ...pack.facts.map((f) => `- ${f.label}: ${f.value ?? 'unknown (read failed)'}`),
  ];
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
