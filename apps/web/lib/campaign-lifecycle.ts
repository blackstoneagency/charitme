// ─────────────────────────────────────────────────────────────────────────────
// One answer to "is this campaign still running, and how long is left?"
//
// These two facts were computed independently in at least three places, and the
// countdown consulted ONLY the deadline while the call-to-action also consulted
// `status` and `accept_donations`. A campaign whose status was no longer active
// but whose deadline was still in the future therefore rendered both:
//
//     "136 days left"          ← from the deadline alone
//     "This campaign has ended." ← from status
//
// on the same panel, at the same moment. A donor cannot tell which is true, and
// the honest answer is that the campaign has ended — the deadline is simply a
// date that has not arrived yet.
//
// So the countdown is derived FROM the lifecycle rather than beside it. If a
// campaign is not running, there is no "time left" to report, and
// `campaignTimeLabel` refuses to invent one.
// ─────────────────────────────────────────────────────────────────────────────

export type CampaignLifecycle =
  /** Accepting donations right now. */
  | 'active'
  /** Organizer paused donations; the campaign itself has not ended. */
  | 'paused'
  /** Live, but payout setup is incomplete, so donations cannot be taken yet. */
  | 'payout-pending'
  /** Over: status is no longer active, or the deadline has passed. */
  | 'ended';

export interface CampaignLifecycleInput {
  status: string | null | undefined;
  deadline: string | null | undefined;
  /** `accept_donations`; absent is treated as true, matching the column default. */
  acceptDonations?: boolean | null;
  /** Whether payout setup is complete. Only consulted when otherwise active. */
  payoutReady?: boolean;
}

const MS_PER_DAY = 86_400_000;

/**
 * Whole days until the deadline, floored at 0. `null` when there is no deadline.
 *
 * This is the raw date arithmetic ONLY. It deliberately knows nothing about
 * status — callers must not render it directly; use `campaignTimeLabel`, which
 * cannot contradict the lifecycle.
 */
export function campaignDaysLeft(
  deadline: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!deadline) return null;
  const at = new Date(deadline).getTime();
  // An unparseable deadline is missing data, not "0 days left" — saying a
  // campaign ends today because a date failed to parse is a confident lie.
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - now) / MS_PER_DAY));
}

/**
 * The single state every surface should branch on.
 *
 * Order matters: `ended` is checked first, so a campaign that is over can never
 * be reported as paused or awaiting payout — those read as "coming back", which
 * an ended campaign is not.
 */
export function campaignLifecycle(
  input: CampaignLifecycleInput,
  now: number = Date.now(),
): CampaignLifecycle {
  const days = campaignDaysLeft(input.deadline, now);

  if (input.status !== 'active') return 'ended';
  if (days !== null && days <= 0) return 'ended';
  if (input.acceptDonations === false) return 'paused';
  if (input.payoutReady === false) return 'payout-pending';
  return 'active';
}

/** True only when donations can actually be taken. */
export function isCampaignAcceptingDonations(
  input: CampaignLifecycleInput,
  now: number = Date.now(),
): boolean {
  return campaignLifecycle(input, now) === 'active';
}

/**
 * What the countdown should say — the only thing a surface may render for time.
 *
 * Returns `'Ended'` for a finished campaign even when its deadline is months
 * away, which is the whole point: the label can never contradict the state
 * shown next to it.
 */
export function campaignTimeLabel(
  input: CampaignLifecycleInput,
  now: number = Date.now(),
): string {
  if (campaignLifecycle(input, now) === 'ended') return 'Ended';

  const days = campaignDaysLeft(input.deadline, now);
  if (days === null) return 'No deadline';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}
