// ─────────────────────────────────────────────────────────────────────────────
// Notification message builders — pure, unit-testable. The `notify()` helper in
// `notify.ts` performs the insert; these decide what each event says.
// ─────────────────────────────────────────────────────────────────────────────

export interface NotificationDraft {
  kind: string;
  title: string;
  body: string;
  link: string;
}

// ── Sponsorships ──────────────────────────────────────────────────────────────

/** To the organizer when a sponsor sends a new offer. */
export function sponsorshipOfferReceived(
  sponsorLabel: string,
  amountLabel: string,
  opportunityTitle: string,
): NotificationDraft {
  return {
    kind: 'sponsorship_offer',
    title: `New sponsorship offer: ${amountLabel}`,
    body: `${sponsorLabel} offered ${amountLabel} to sponsor "${opportunityTitle}".`,
    link: '/sponsor/manage',
  };
}

/** To the sponsor when the organizer resolves their offer. Null for no-op statuses. */
export function sponsorshipOfferResolved(
  status: string,
  opportunityTitle: string,
): NotificationDraft | null {
  const verb: Record<string, string> = { accepted: 'accepted', declined: 'declined', fulfilled: 'marked fulfilled' };
  if (!verb[status]) return null;
  return {
    kind: `sponsorship_${status}`,
    title: `Your sponsorship offer was ${verb[status]}`,
    body: `Your offer to sponsor "${opportunityTitle}" was ${verb[status]}.`,
    link: '/sponsor',
  };
}

// ── Corporate matching ────────────────────────────────────────────────────────

/** To the program sponsor when an employee submits a match claim. */
export function matchingClaimReceived(amountLabel: string, companyName: string): NotificationDraft {
  return {
    kind: 'matching_claim',
    title: `New match claim: ${amountLabel}`,
    body: `An employee submitted a ${amountLabel} donation for ${companyName} to match.`,
    link: '/matching/manage',
  };
}

/** To the employee when the sponsor resolves their claim. Null for no-op statuses. */
export function matchingClaimResolved(status: string, companyName: string): NotificationDraft | null {
  const verb: Record<string, string> = { approved: 'approved', declined: 'declined', paid: 'paid' };
  if (!verb[status]) return null;
  return {
    kind: `matching_${status}`,
    title: `Match ${verb[status]} by ${companyName}`,
    body: `Your matching-gift claim was ${verb[status]}.`,
    link: '/matching',
  };
}

// ── Events ────────────────────────────────────────────────────────────────────

/** To the event organizer when someone RSVPs. */
export function eventRsvpReceived(attendeeLabel: string, eventTitle: string): NotificationDraft {
  return {
    kind: 'event_rsvp',
    title: `New RSVP for "${eventTitle}"`,
    body: `${attendeeLabel} registered for your event.`,
    link: '/events/manage',
  };
}
