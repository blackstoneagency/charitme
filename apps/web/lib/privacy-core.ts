// ─────────────────────────────────────────────────────────────────────────────
// Privacy requests (GDPR/CCPA) — pure domain logic (no I/O, unit-testable).
// Sibling `privacy.ts` performs the Supabase queries + export assembly.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from 'zod';

export type PrivacyRequestType = 'export' | 'deletion';
export type PrivacyRequestStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export interface PrivacyRequest {
  id: string;
  user_id: string;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  note: string | null;
  resolution_note: string | null;
  resolver_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export function isActive(status: PrivacyRequestStatus): boolean {
  return status === 'pending' || status === 'in_progress';
}

// ── State machine ─────────────────────────────────────────────────────────────

const USER_TRANSITIONS: Record<PrivacyRequestStatus, PrivacyRequestStatus[]> = {
  pending: ['cancelled'],
  in_progress: ['cancelled'],
  completed: [],
  rejected: [],
  cancelled: [],
};

const ADMIN_TRANSITIONS: Record<PrivacyRequestStatus, PrivacyRequestStatus[]> = {
  pending: ['in_progress', 'completed', 'rejected'],
  in_progress: ['completed', 'rejected'],
  completed: [],
  rejected: [],
  cancelled: [],
};

export type PrivacyActor = 'user' | 'admin';

export function canTransitionRequest(
  actor: PrivacyActor,
  from: PrivacyRequestStatus,
  to: PrivacyRequestStatus,
): boolean {
  const table = actor === 'admin' ? ADMIN_TRANSITIONS : USER_TRANSITIONS;
  return table[from]?.includes(to) ?? false;
}

/** A status is terminal (resolved) — used to stamp resolved_at. */
export function isTerminal(status: PrivacyRequestStatus): boolean {
  return status === 'completed' || status === 'rejected' || status === 'cancelled';
}

// ── PII redaction for the "right to be forgotten" ─────────────────────────────

/**
 * Produce the anonymized profile patch applied when a deletion request is
 * completed. Financial/transaction records are intentionally retained (legal
 * requirement); only personally-identifying profile fields are scrubbed.
 */
export function anonymizedProfilePatch(userId: string): Record<string, unknown> {
  const tag = userId.slice(0, 8);
  return {
    full_name: 'Deleted User',
    email: `deleted+${tag}@charitme.invalid`,
    avatar_url: null,
    bio: null,
    org_name: null,
  };
}

// ── Validation schemas ────────────────────────────────────────────────────────

export const RequestCreateSchema = z.object({
  type: z.enum(['export', 'deletion']),
  note: z.string().trim().max(2000).optional().nullable(),
});

export const RequestUpdateSchema = z.object({
  status: z.enum(['in_progress', 'completed', 'rejected', 'cancelled']),
  resolution_note: z.string().trim().max(2000).optional().nullable(),
});
