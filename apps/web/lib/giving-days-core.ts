/**
 * Giving days: a time-boxed fundraising event with a slug, a window and a goal.
 *
 * `giving_days` shipped with RLS, a unique slug and a foreign key to
 * `nonprofit_profiles`, and NOTHING in the product read or wrote it — one of 27
 * tables in that state. This module is the pure half: window arithmetic and the
 * access rule, both testable without a database.
 *
 * ⚠️ **The access rule mirrors a policy that will not run.** The table's only
 * policy is `giving_days_owner_write` — admin, or the owner of the linked
 * nonprofit, for USING *and* WITH CHECK — with no public read. A public page
 * therefore has to read through the service-role client, which BYPASSES RLS. So
 * `canManageGivingDay` is not a convenience wrapper around the database's
 * decision; on that path it is the only decision there is, and it has to agree
 * with the policy exactly. `POLICY_MIRRORED` names the policy it copies so the
 * two can be diffed by a human when either changes.
 */

export const POLICY_MIRRORED = 'giving_days_owner_write';

export type GivingDayWindow = Readonly<{
  startsAt: string;
  endsAt: string;
}>;

export type GivingDayPhase = 'upcoming' | 'live' | 'ended';

/**
 * Which side of the window "now" falls on.
 *
 * The boundaries are deliberate: a giving day is LIVE from the instant it starts
 * up to (not including) the instant it ends, matching how the campaign page
 * treats a deadline. An event that says "ends at midnight" must not still be
 * accepting money at midnight.
 */
export function givingDayPhase(window: GivingDayWindow, now: number = Date.now()): GivingDayPhase {
  const starts = Date.parse(window.startsAt);
  const ends = Date.parse(window.endsAt);
  // An unparseable window is not a live event. Treating it as live would put a
  // donate button on a row whose dates nobody can read.
  if (!Number.isFinite(starts) || !Number.isFinite(ends)) return 'ended';
  if (now < starts) return 'upcoming';
  if (now >= ends) return 'ended';
  return 'live';
}

export function isGivingDayLive(window: GivingDayWindow, now: number = Date.now()): boolean {
  return givingDayPhase(window, now) === 'live';
}

/** Inclusive of the start, exclusive of the end — see `givingDayPhase`. */
export function givingDayEndsInMs(window: GivingDayWindow, now: number = Date.now()): number {
  const ends = Date.parse(window.endsAt);
  if (!Number.isFinite(ends)) return 0;
  return Math.max(0, ends - now);
}

export type GivingDayCountdown = Readonly<{ value: number; unit: 'day' | 'hour' | 'minute' }> | null;

/**
 * How long is left, as NUMBER + UNIT rather than a sentence.
 *
 * Structured on purpose. `campaign-lifecycle.test.ts` guards the whole codebase
 * against any surface building its own "N days left" string, because a countdown
 * that does not consult status prints one beside "This campaign has ended" — the
 * repo has shipped that contradiction ten times. Returning data instead of prose
 * means this module cannot produce that sentence at all, and the caller renders
 * it only inside the branch where the phase is already known.
 *
 * `null` when the event is not live, which is what makes the contradiction
 * unrepresentable rather than merely discouraged.
 */
export function givingDayCountdown(window: GivingDayWindow, now: number = Date.now()): GivingDayCountdown {
  if (givingDayPhase(window, now) !== 'live') return null;
  const ms = givingDayEndsInMs(window, now);
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 48) return { value: Math.floor(hours / 24), unit: 'day' };
  if (hours >= 1) return { value: hours, unit: 'hour' };
  return { value: Math.max(1, Math.floor(ms / 60_000)), unit: 'minute' };
}

/** "1 hour" / "6 hours" — pluralisation only, never a status claim. */
export function formatCountdown(countdown: NonNullable<GivingDayCountdown>): string {
  return `${countdown.value} ${countdown.unit}${countdown.value === 1 ? '' : 's'}`;
}

/**
 * Percent of goal, clamped to 0–100 and rounded.
 *
 * Returns `null` — not 0 — when there is no goal to measure against. A progress
 * bar reading 0% is a claim that nothing has been raised; "no goal set" is a
 * different fact and the UI must be able to tell them apart.
 */
export function givingDayProgress(raisedCents: number, goalCents: number | null | undefined): number | null {
  if (goalCents === null || goalCents === undefined || goalCents <= 0) return null;
  const pct = (raisedCents / goalCents) * 100;
  if (!Number.isFinite(pct)) return null;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

export type GivingDayActor = Readonly<{
  userId: string;
  isAdmin: boolean;
  /** Nonprofit profiles this user owns. */
  ownedNonprofitIds: readonly string[];
}>;

/**
 * Mirrors `giving_days_owner_write`: admin, or the owner of the nonprofit the
 * giving day belongs to.
 *
 * A row with no `nonprofit_id` is manageable by admins ONLY. The column is
 * nullable, and the policy's EXISTS subquery finds no matching profile for
 * NULL — so a null owner is not "everyone's", it is nobody's. Defaulting the
 * other way would let any signed-in user edit an unattached event.
 */
export function canManageGivingDay(
  actor: GivingDayActor,
  row: { nonprofit_id: string | null },
): boolean {
  if (actor.isAdmin) return true;
  if (!row.nonprofit_id) return false;
  return actor.ownedNonprofitIds.includes(row.nonprofit_id);
}

/** Lowercase, hyphenated, and never empty — the column is UNIQUE and NOT NULL. */
export function givingDaySlug(title: string, fallback = 'giving-day'): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || fallback;
}

/** `starts_at` must precede `ends_at`; the database does not check it. */
export function isValidWindow(window: GivingDayWindow): boolean {
  const starts = Date.parse(window.startsAt);
  const ends = Date.parse(window.endsAt);
  if (!Number.isFinite(starts) || !Number.isFinite(ends)) return false;
  return starts < ends;
}

/** Newest-first among live, then upcoming, then ended — what a visitor wants. */
export function sortForDisplay<T extends GivingDayWindow>(rows: readonly T[], now: number = Date.now()): T[] {
  const rank: Record<GivingDayPhase, number> = { live: 0, upcoming: 1, ended: 2 };
  return [...rows].sort((a, b) => {
    const byPhase = rank[givingDayPhase(a, now)] - rank[givingDayPhase(b, now)];
    if (byPhase !== 0) return byPhase;
    // Within a phase: soonest-ending live events first, soonest-starting
    // upcoming ones first, most-recent ended ones first.
    const phase = givingDayPhase(a, now);
    if (phase === 'upcoming') return Date.parse(a.startsAt) - Date.parse(b.startsAt);
    if (phase === 'live') return Date.parse(a.endsAt) - Date.parse(b.endsAt);
    return Date.parse(b.endsAt) - Date.parse(a.endsAt);
  });
}
