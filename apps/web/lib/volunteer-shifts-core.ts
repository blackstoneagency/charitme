// ─────────────────────────────────────────────────────────────────────────────
// CHAR-1102 — volunteer shifts / check-in / verified hours: pure domain logic.
//
// No Supabase import on purpose. Everything here is decidable from its inputs,
// so it is unit-testable without a database — which matters because the rules
// below decide what gets exported to an employer.
// ─────────────────────────────────────────────────────────────────────────────

export type ShiftStatus = 'scheduled' | 'cancelled' | 'completed';
export type HoursStatus = 'pending' | 'verified' | 'rejected';
export type HoursSource = 'manual' | 'check_in';

export interface VolunteerShift {
  id: string;
  opportunity_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  filled_count: number;
  status: ShiftStatus;
}

export interface VolunteerHoursRow {
  id: string;
  shift_id: string | null;
  opportunity_id: string;
  volunteer_user_id: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  hours: number;
  source: HoursSource;
  status: HoursStatus;
}

/** Hours are reported to two decimals; anything finer is noise for this purpose. */
export const HOURS_PRECISION = 2;

/**
 * A single check-in may not exceed this. A volunteer who forgets to check out
 * would otherwise accrue hours until someone noticed, and that figure could be
 * exported to their employer as verified time.
 */
export const MAX_SHIFT_HOURS = 24;

export function roundHours(hours: number): number {
  const f = 10 ** HOURS_PRECISION;
  return Math.round(hours * f) / f;
}

/**
 * Elapsed hours between check-in and check-out.
 *
 * Returns 0 rather than a negative or NaN figure for unusable input: a missing
 * or malformed timestamp means "we do not know", and 0 pending hours is the
 * honest representation of that. Callers must not treat 0 as "verified none".
 */
export function hoursBetween(checkedInAt: string | null, checkedOutAt: string | null): number {
  if (!checkedInAt || !checkedOutAt) return 0;
  const start = Date.parse(checkedInAt);
  const end = Date.parse(checkedOutAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  if (end <= start) return 0;
  return roundHours((end - start) / 3_600_000);
}

export interface CheckoutResult {
  hours: number;
  capped: boolean;
}

/**
 * Hours to record at check-out, with the runaway-clock cap applied.
 *
 * `capped` is returned rather than swallowed so the caller can surface it —
 * a capped entry is a data-quality signal an organizer should look at, not
 * something to silently record as if it were measured.
 */
export function hoursForCheckout(checkedInAt: string | null, checkedOutAt: string | null): CheckoutResult {
  const raw = hoursBetween(checkedInAt, checkedOutAt);
  if (raw > MAX_SHIFT_HOURS) return { hours: MAX_SHIFT_HOURS, capped: true };
  return { hours: raw, capped: false };
}

export type CheckInRefusal =
  | 'shift_cancelled'
  | 'shift_full'
  | 'already_checked_in'
  | 'too_early'
  | 'shift_over';

/** How long before a shift starts a volunteer may check in. */
export const EARLY_CHECKIN_WINDOW_MINUTES = 30;
/** How long after a shift ends a check-in is still accepted. */
export const LATE_CHECKIN_GRACE_MINUTES = 60;

export interface CheckInDecision {
  allowed: boolean;
  reason?: CheckInRefusal;
}

/**
 * Whether a volunteer may check in to a shift right now.
 *
 * Ordering is deliberate: state problems (cancelled, already checked in) are
 * reported before timing ones, so a volunteer who already checked in is told
 * that rather than "too early" when they scan again.
 */
export function canCheckIn(
  shift: Pick<VolunteerShift, 'starts_at' | 'ends_at' | 'capacity' | 'filled_count' | 'status'>,
  opts: { now: Date; hasOpenCheckIn: boolean },
): CheckInDecision {
  if (shift.status === 'cancelled') return { allowed: false, reason: 'shift_cancelled' };
  if (opts.hasOpenCheckIn) return { allowed: false, reason: 'already_checked_in' };
  if (shift.capacity !== null && shift.filled_count >= shift.capacity) {
    return { allowed: false, reason: 'shift_full' };
  }

  const now = opts.now.getTime();
  const start = Date.parse(shift.starts_at);
  const end = Date.parse(shift.ends_at);
  if (Number.isNaN(start) || Number.isNaN(end)) return { allowed: false, reason: 'too_early' };

  if (now < start - EARLY_CHECKIN_WINDOW_MINUTES * 60_000) return { allowed: false, reason: 'too_early' };
  if (now > end + LATE_CHECKIN_GRACE_MINUTES * 60_000) return { allowed: false, reason: 'shift_over' };

  return { allowed: true };
}

export interface HoursTotals {
  verified: number;
  pending: number;
  rejected: number;
}

/**
 * Totals by verification state.
 *
 * Kept separate rather than summed into one number because the distinction is
 * the entire point: only `verified` may be presented to an employer. A single
 * "total hours" figure would invite exactly the conflation this feature exists
 * to prevent.
 */
export function totalHours(rows: Pick<VolunteerHoursRow, 'hours' | 'status'>[]): HoursTotals {
  const totals: HoursTotals = { verified: 0, pending: 0, rejected: 0 };
  for (const r of rows) {
    const h = Number.isFinite(r.hours) ? r.hours : 0;
    totals[r.status] = roundHours(totals[r.status] + h);
  }
  return totals;
}

export interface ExportRow {
  volunteerUserId: string;
  opportunityId: string;
  hours: number;
  date: string | null;
}

/**
 * Rows eligible for a corporate volunteer-hours export.
 *
 * Verified only, and never a soft-deleted row. This is the function an employer
 * report is built from, so it errs toward excluding rather than including.
 */
export function exportableHours(
  rows: (Pick<VolunteerHoursRow, 'hours' | 'status' | 'volunteer_user_id' | 'opportunity_id' | 'checked_in_at'> & {
    deleted_at?: string | null;
  })[],
): ExportRow[] {
  return rows
    .filter((r) => r.status === 'verified' && !r.deleted_at && r.hours > 0)
    .map((r) => ({
      volunteerUserId: r.volunteer_user_id,
      opportunityId: r.opportunity_id,
      hours: r.hours,
      date: r.checked_in_at ? r.checked_in_at.slice(0, 10) : null,
    }));
}

/**
 * Check-in code for a shift's QR.
 *
 * Not a security token — it proves presence at one shift and nothing else, and
 * it is scoped to a single shift row. Avoids look-alike characters so a code
 * read off a screen or printout is not mistyped (no O/0, I/1).
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CHECKIN_CODE_LENGTH = 8;

export function formatCheckInCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidCheckInCode(raw: string): boolean {
  const code = formatCheckInCode(raw);
  if (code.length !== CHECKIN_CODE_LENGTH) return false;
  return [...code].every((c) => CODE_ALPHABET.includes(c));
}

/** Generate a code using the supplied randomness source (injected for tests). */
export function generateCheckInCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < CHECKIN_CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
  }
  return out;
}

export type ShiftTransitionRefusal = 'same_status' | 'already_cancelled' | 'not_a_transition';

export interface ShiftTransition {
  allowed: boolean;
  reason?: ShiftTransitionRefusal;
}

/**
 * Whether an organizer may move a shift from `from` to `to`.
 *
 * `cancelled` is terminal: re-opening a shift people were told was cancelled
 * would let volunteers arrive to nothing, so the fix is to schedule a new one.
 * `completed` is not terminal — an organizer who closes a shift early can put it
 * back to `scheduled` if the session actually continues.
 */
export function canTransitionShift(from: ShiftStatus, to: ShiftStatus): ShiftTransition {
  if (from === to) return { allowed: false, reason: 'same_status' };
  if (from === 'cancelled') return { allowed: false, reason: 'already_cancelled' };
  if (to === 'scheduled' && from === 'completed') return { allowed: true };
  if (to === 'cancelled' || to === 'completed') return { allowed: true };
  return { allowed: false, reason: 'not_a_transition' };
}

/**
 * Cancelling a shift never voids hours already logged against it.
 *
 * Stated as code because it is a judgement call someone could reasonably get
 * wrong: a volunteer who turned up and worked is owed that time regardless of
 * what later happens to the shift record. Cancellation stops FUTURE check-ins
 * (canCheckIn refuses a cancelled shift); it is not a way to erase attendance.
 */
export function cancellationVoidsLoggedHours(): boolean {
  return false;
}
