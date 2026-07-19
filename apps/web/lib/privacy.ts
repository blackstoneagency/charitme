// Pure business logic for privacy (data export / account deletion) requests.
// No Supabase/Next imports — unit-testable, reusable server + client.

export const PRIVACY_REQUEST_TYPES = ['export', 'deletion'] as const;
export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];

export const PRIVACY_REQUEST_STATUSES = ['pending', 'processing', 'completed', 'rejected', 'cancelled'] as const;
export type PrivacyRequestStatus = (typeof PRIVACY_REQUEST_STATUSES)[number];

const TRANSITIONS: Record<PrivacyRequestStatus, readonly PrivacyRequestStatus[]> = {
  pending: ['processing', 'completed', 'rejected', 'cancelled'],
  processing: ['completed', 'rejected', 'cancelled'],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function isPrivacyRequestType(v: unknown): v is PrivacyRequestType {
  return typeof v === 'string' && (PRIVACY_REQUEST_TYPES as readonly string[]).includes(v);
}

export function isPrivacyRequestStatus(v: unknown): v is PrivacyRequestStatus {
  return typeof v === 'string' && (PRIVACY_REQUEST_STATUSES as readonly string[]).includes(v);
}

export function canTransitionPrivacyRequest(from: PrivacyRequestStatus, to: PrivacyRequestStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

/**
 * Which transitions an actor may make. Users may only cancel their own pending/
 * processing request; admins drive processing/completion/rejection.
 */
export function allowedPrivacyTransition(
  actor: 'user' | 'admin',
  from: PrivacyRequestStatus,
  to: PrivacyRequestStatus,
): boolean {
  if (!canTransitionPrivacyRequest(from, to)) return false;
  if (actor === 'admin') return true;
  return to === 'cancelled';
}

/** A status is terminal (no further transitions). */
export function isTerminalPrivacyStatus(status: PrivacyRequestStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function privacyRequestTypeLabel(type: PrivacyRequestType): string {
  return type === 'export' ? 'Data export' : 'Account deletion';
}

export function privacyRequestStatusLabel(status: PrivacyRequestStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'rejected':
      return 'Rejected';
    case 'cancelled':
      return 'Cancelled';
  }
}
