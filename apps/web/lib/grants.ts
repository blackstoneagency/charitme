import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Grants domain — shared types, validation, and a deterministic matching scorer.
// The scorer is pure (no DB / no network) so it is fully unit-testable and also
// serves as the fallback when the AI provider is unavailable (mirrors the
// fallbackAiCampaign pattern in lib/openai.ts).
// ─────────────────────────────────────────────────────────────────────────────

export type GrantStatus = 'open' | 'upcoming' | 'closed';
export type FunderType =
  | 'foundation' | 'government' | 'corporate' | 'community' | 'individual' | 'other';
export type GrantApplicationStatus =
  | 'draft' | 'submitted' | 'under_review' | 'awarded' | 'rejected' | 'withdrawn';

export interface Grant {
  id: string;
  slug: string;
  title: string;
  funder_name: string;
  funder_type: FunderType;
  summary: string | null;
  description: string | null;
  category: string | null;
  focus_areas: string[];
  eligibility: string | null;
  eligible_entity_types: string[];
  amount_min: number | null;
  amount_max: number | null;
  currency: string;
  location: string | null;
  country: string | null;
  application_url: string | null;
  deadline_at: string | null;
  rolling_deadline: boolean;
  status: GrantStatus;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface GrantApplication {
  id: string;
  grant_id: string;
  applicant_user_id: string;
  campaign_id: string | null;
  organization_name: string | null;
  status: GrantApplicationStatus;
  amount_requested: number | null;
  narrative: string | null;
  answers: Record<string, unknown>;
  submitted_at: string | null;
  decision_at: string | null;
  award_amount: number | null;
  created_at: string;
  updated_at: string;
}

// Column projections reused across API routes.
export const GRANT_PUBLIC_COLUMNS =
  'id,slug,title,funder_name,funder_type,summary,category,focus_areas,eligibility,' +
  'eligible_entity_types,amount_min,amount_max,currency,location,country,' +
  'application_url,deadline_at,rolling_deadline,status,verified,created_at,updated_at';

export const GRANT_DETAIL_COLUMNS = GRANT_PUBLIC_COLUMNS + ',description';

// ── Validation ───────────────────────────────────────────────────────────────
export const GrantSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(80).optional(),
  focus: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(80).optional(),
  status: z.enum(['open', 'upcoming', 'closed']).optional(),
  minAmount: z.coerce.number().int().nonnegative().optional(),
  maxAmount: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});
export type GrantSearchParams = z.infer<typeof GrantSearchSchema>;

export const GrantApplicationCreateSchema = z.object({
  grantId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  organizationName: z.string().trim().min(1).max(200).optional(),
  amountRequested: z.number().int().positive().max(1_000_000_000).optional(),
  narrative: z.string().trim().max(20_000).optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
});

export const GrantApplicationUpdateSchema = z.object({
  organizationName: z.string().trim().min(1).max(200).optional(),
  amountRequested: z.number().int().positive().max(1_000_000_000).optional(),
  narrative: z.string().trim().max(20_000).optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
  // Applicants may submit or withdraw; other transitions are admin-only.
  status: z.enum(['draft', 'submitted', 'withdrawn']).optional(),
});

export const GrantMatchRequestSchema = z.object({
  category: z.string().trim().max(80).optional(),
  focusAreas: z.array(z.string().trim().max(80)).max(25).optional(),
  entityType: z.string().trim().max(80).optional(),
  amountNeeded: z.number().int().nonnegative().max(1_000_000_000).optional(),
  country: z.string().trim().max(80).optional(),
  keywords: z.string().trim().max(500).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});
export type GrantMatchRequest = z.infer<typeof GrantMatchRequestSchema>;

// ── Deterministic matching scorer ────────────────────────────────────────────

export interface GrantMatchResult {
  grantId: string;
  score: number;        // 0..100
  reasons: string[];
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

/**
 * Score how well a single grant fits an applicant's need. Pure and deterministic.
 * Weighting (max 100): category 30, focus-area overlap 25, entity eligibility 20,
 * amount fit 15, geography 5, keyword hit 5. Closed grants are floored to 0.
 */
export function scoreGrantMatch(grant: Grant, req: GrantMatchRequest): GrantMatchResult {
  const reasons: string[] = [];
  let score = 0;

  if (grant.status === 'closed') {
    return { grantId: grant.id, score: 0, reasons: ['Grant is closed'] };
  }

  // Category (30)
  if (req.category && norm(grant.category) && norm(grant.category) === norm(req.category)) {
    score += 30;
    reasons.push(`Category matches (${grant.category})`);
  }

  // Focus-area overlap (up to 25)
  const wantFocus = (req.focusAreas ?? []).map(norm).filter(Boolean);
  const haveFocus = grant.focus_areas.map(norm).filter(Boolean);
  if (wantFocus.length && haveFocus.length) {
    const overlap = wantFocus.filter((f) => haveFocus.includes(f));
    if (overlap.length) {
      const pts = Math.min(25, overlap.length * 12);
      score += pts;
      reasons.push(`Shared focus: ${overlap.join(', ')}`);
    }
  }

  // Entity eligibility (20)
  if (req.entityType) {
    const et = norm(req.entityType);
    const eligible = grant.eligible_entity_types.map(norm);
    if (eligible.length === 0) {
      score += 8; // unspecified eligibility → partial credit
      reasons.push('Eligibility open to all applicant types');
    } else if (eligible.includes(et)) {
      score += 20;
      reasons.push(`Eligible for ${req.entityType}`);
    }
  }

  // Amount fit (15)
  if (typeof req.amountNeeded === 'number' && req.amountNeeded > 0) {
    const min = grant.amount_min ?? 0;
    const max = grant.amount_max ?? Number.MAX_SAFE_INTEGER;
    if (req.amountNeeded >= min && req.amountNeeded <= max) {
      score += 15;
      reasons.push('Requested amount is within award range');
    } else if (max < req.amountNeeded) {
      reasons.push('Award ceiling below requested amount');
    }
  }

  // Geography (5)
  if (req.country && norm(grant.country) && norm(grant.country) === norm(req.country)) {
    score += 5;
    reasons.push(`Available in ${grant.country}`);
  }

  // Keyword hit (5)
  if (req.keywords) {
    const hay = norm(`${grant.title} ${grant.summary} ${grant.eligibility}`);
    const hit = req.keywords
      .split(/[\s,]+/)
      .map(norm)
      .filter((w) => w.length >= 4 && hay.includes(w));
    if (hit.length) {
      score += 5;
      reasons.push(`Keyword match: ${hit.slice(0, 3).join(', ')}`);
    }
  }

  return { grantId: grant.id, score: Math.min(100, Math.round(score)), reasons };
}

/** Rank a set of grants against a need, best first, dropping zero-score matches. */
export function rankGrantMatches(
  grants: Grant[],
  req: GrantMatchRequest,
): GrantMatchResult[] {
  return grants
    .map((g) => scoreGrantMatch(g, req))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, req.limit);
}

/** Human label for an application status (UI + notifications). */
export function grantApplicationStatusLabel(status: GrantApplicationStatus): string {
  switch (status) {
    case 'draft':        return 'Draft';
    case 'submitted':    return 'Submitted';
    case 'under_review': return 'Under review';
    case 'awarded':      return 'Awarded';
    case 'rejected':     return 'Not selected';
    case 'withdrawn':    return 'Withdrawn';
  }
}
