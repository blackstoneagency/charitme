// ─────────────────────────────────────────────────────────────────────────────
// Sponsorship marketplace — pure domain logic (no I/O, unit-testable).
// Sibling `sponsorships.ts` performs the Supabase queries.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from 'zod';

export const SPONSORSHIP_CATEGORIES = [
  'Community',
  'Sports',
  'Education',
  'Events',
  'Arts',
  'Faith',
  'Environment',
  'Health',
  'Youth',
  'Technology',
] as const;

export type SponsorshipCategory = (typeof SPONSORSHIP_CATEGORIES)[number];

export type OpportunityStatus = 'draft' | 'open' | 'closed' | 'fulfilled' | 'cancelled';
export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'fulfilled';

export interface SponsorshipOpportunity {
  id: string;
  organizer_id: string;
  campaign_id: string | null;
  title: string;
  description: string;
  category: string;
  benefits: string | null;
  min_amount_cents: number;
  target_amount_cents: number | null;
  raised_amount_cents: number;
  currency: string;
  status: OpportunityStatus;
  created_at: string;
  updated_at: string;
}

export interface SponsorshipRequest {
  id: string;
  opportunity_id: string;
  sponsor_id: string;
  company_name: string | null;
  amount_cents: number;
  message: string | null;
  benefits_requested: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
}

/** Whether the opportunity is currently accepting sponsorship requests. */
export function isAcceptingRequests(o: Pick<SponsorshipOpportunity, 'status'>): boolean {
  return o.status === 'open';
}

/** Progress toward an opportunity's target (0–100), or null if no target set. */
export function fundingProgress(
  o: Pick<SponsorshipOpportunity, 'raised_amount_cents' | 'target_amount_cents'>,
): number | null {
  if (!o.target_amount_cents || o.target_amount_cents <= 0) return null;
  return Math.min(100, Math.round((o.raised_amount_cents / o.target_amount_cents) * 100));
}

// ── Request state machine ─────────────────────────────────────────────────────

const ORGANIZER_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ['accepted', 'declined'],
  accepted: ['fulfilled', 'declined'],
  declined: [],
  withdrawn: [],
  fulfilled: [],
};

const SPONSOR_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ['withdrawn'],
  accepted: ['withdrawn'],
  declined: [],
  withdrawn: [],
  fulfilled: [],
};

export type RequestActor = 'organizer' | 'sponsor';

export function canTransitionRequest(
  actor: RequestActor,
  from: RequestStatus,
  to: RequestStatus,
): boolean {
  const table = actor === 'organizer' ? ORGANIZER_TRANSITIONS : SPONSOR_TRANSITIONS;
  return table[from]?.includes(to) ?? false;
}

/**
 * Amount (cents) to add to the opportunity's `raised_amount_cents` when a request
 * moves from one status to another. Committed = accepted or fulfilled.
 */
export function committedAmountDelta(
  from: RequestStatus,
  to: RequestStatus,
  amountCents: number,
): number {
  const wasCommitted = from === 'accepted' || from === 'fulfilled';
  const willCommit = to === 'accepted' || to === 'fulfilled';
  if (!wasCommitted && willCommit) return amountCents;
  if (wasCommitted && !willCommit) return -amountCents;
  return 0;
}

// ── Validation schemas ────────────────────────────────────────────────────────

export const OpportunityCreateSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(8000),
  category: z.enum(SPONSORSHIP_CATEGORIES).default('Community'),
  benefits: z.string().trim().max(4000).optional().nullable(),
  min_amount_cents: z.number().int().min(0).max(100_000_000).default(0),
  target_amount_cents: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
  currency: z.string().trim().length(3).default('USD'),
  campaign_id: z.string().uuid().optional().nullable(),
  status: z.enum(['draft', 'open']).default('open'),
});

export const OpportunityUpdateSchema = OpportunityCreateSchema.partial().extend({
  status: z.enum(['draft', 'open', 'closed', 'fulfilled', 'cancelled']).optional(),
});

export const RequestCreateSchema = z.object({
  opportunity_id: z.string().uuid(),
  amount_cents: z.number().int().min(100).max(1_000_000_000),
  company_name: z.string().trim().max(160).optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
  benefits_requested: z.string().trim().max(2000).optional().nullable(),
});

export const RequestUpdateSchema = z.object({
  status: z.enum(['accepted', 'declined', 'withdrawn', 'fulfilled']),
});
