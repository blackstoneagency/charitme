// Pure business logic for the sponsorship marketplace.
// No Supabase/Next imports — unit-testable, reusable server + client.

export const SPONSORSHIP_REQUEST_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'withdrawn',
  'agreed',
  'fulfilled',
] as const;

export type SponsorshipRequestStatus = (typeof SPONSORSHIP_REQUEST_STATUSES)[number];

const TRANSITIONS: Record<SponsorshipRequestStatus, readonly SponsorshipRequestStatus[]> = {
  pending: ['accepted', 'declined', 'withdrawn'],
  accepted: ['agreed', 'declined', 'withdrawn'],
  agreed: ['fulfilled', 'withdrawn'],
  fulfilled: [],
  declined: [],
  withdrawn: [],
};

export function isSponsorshipRequestStatus(v: unknown): v is SponsorshipRequestStatus {
  return typeof v === 'string' && (SPONSORSHIP_REQUEST_STATUSES as readonly string[]).includes(v);
}

export function canTransitionSponsorship(from: SponsorshipRequestStatus, to: SponsorshipRequestStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

/**
 * Which transitions each actor may make. Sponsors may withdraw or confirm an
 * agreement (accepted→agreed); organizers accept/decline and mark fulfilled.
 */
export function allowedSponsorshipTransition(
  actor: 'sponsor' | 'organizer' | 'admin',
  from: SponsorshipRequestStatus,
  to: SponsorshipRequestStatus,
): boolean {
  if (!canTransitionSponsorship(from, to)) return false;
  if (actor === 'admin') return true;
  if (actor === 'sponsor') return to === 'withdrawn' || to === 'agreed';
  // organizer
  return to === 'accepted' || to === 'declined' || to === 'fulfilled';
}

export function sponsorshipStatusLabel(status: SponsorshipRequestStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'accepted':
      return 'Accepted';
    case 'declined':
      return 'Declined';
    case 'withdrawn':
      return 'Withdrawn';
    case 'agreed':
      return 'Agreement confirmed';
    case 'fulfilled':
      return 'Fulfilled';
  }
}

/** Validates a sponsorship offer amount against an opportunity's minimum. */
export function isValidSponsorshipAmount(amountCents: number, minAmountCents: number): boolean {
  if (!Number.isFinite(amountCents) || amountCents < 0) return false;
  return amountCents >= (Number(minAmountCents) || 0);
}

/** Remaining sponsor slots given accepted/agreed/fulfilled requests. */
export function remainingSponsorshipSlots(slots: number, filledCount: number): number {
  return Math.max(0, (Number(slots) || 0) - (Number(filledCount) || 0));
}
