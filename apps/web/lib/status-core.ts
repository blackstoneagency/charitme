// ─────────────────────────────────────────────────────────────────────────────
// Public status page — pure classification, no I/O.
//
// ⚠️ THE ONLY THING THAT MATTERS HERE: a status page must be able to say NO.
//
// A page that reads "All systems operational" because the string is hardcoded is
// worse than having no status page at all — it converts an outage into a
// contradiction the visitor cannot resolve, and it is indistinguishable from a
// working one on the day you need it. So every subsystem below is derived from a
// real probe result, and `overallStatus` degrades automatically.
//
// Split out from the route so the degrade logic is testable without a database.
// ─────────────────────────────────────────────────────────────────────────────

export type SubsystemState = 'operational' | 'degraded' | 'down';

export interface Subsystem {
  key: string;
  label: string;
  description: string;
  state: SubsystemState;
  /** Shown only when not operational — never invent detail for a healthy check. */
  detail?: string;
}

/** A probe either succeeded, succeeded slowly, or failed. */
export interface ProbeResult {
  ok: boolean;
  ms: number;
  error?: string;
}

/** Above this a subsystem is reported degraded even though it answered. */
export const SLOW_MS = 2_000;

export function classify(probe: ProbeResult, downDetail: string): {
  state: SubsystemState;
  detail?: string;
} {
  if (!probe.ok) return { state: 'down', detail: downDetail };
  if (probe.ms >= SLOW_MS) {
    return { state: 'degraded', detail: `Responding slowly (${Math.round(probe.ms)}ms).` };
  }
  return { state: 'operational' };
}

/**
 * The banner state. `down` beats `degraded` beats `operational` — the headline
 * must reflect the WORST subsystem, never an average. Averaging is how three
 * broken things out of ten become "mostly operational".
 */
export function overallStatus(subsystems: readonly Subsystem[]): SubsystemState {
  if (subsystems.some((s) => s.state === 'down')) return 'down';
  if (subsystems.some((s) => s.state === 'degraded')) return 'degraded';
  return 'operational';
}

export function overallHeadline(state: SubsystemState): string {
  if (state === 'down') return 'Some systems are down';
  if (state === 'degraded') return 'Some systems are degraded';
  return 'All systems operational';
}

/**
 * A subsystem whose dependency is not configured on this deployment.
 *
 * Reported as `degraded`, never `operational`: email that cannot send is not
 * working, and marking it green because "nothing errored" is precisely the lie
 * this file exists to prevent. It is not `down` either — nothing has failed, the
 * capability simply is not wired here.
 */
export function notConfigured(key: string, label: string, description: string, what: string): Subsystem {
  return {
    key,
    label,
    description,
    state: 'degraded',
    detail: `${what} is not configured on this deployment.`,
  };
}
