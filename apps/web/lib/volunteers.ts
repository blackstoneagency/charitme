import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Volunteers domain — shared types, validation, and a deterministic skill-match
// scorer (pure; unit-testable; AI-fallback). Mirrors lib/grants.ts.
// ─────────────────────────────────────────────────────────────────────────────

export type VolunteerStatus = 'open' | 'upcoming' | 'closed';
export type VolunteerApplicationStatus =
  | 'applied' | 'accepted' | 'declined' | 'withdrawn' | 'completed';

export interface VolunteerOpportunity {
  id: string;
  slug: string;
  title: string;
  org_name: string;
  summary: string | null;
  description: string | null;
  category: string | null;
  skills: string[];
  location: string | null;
  country: string | null;
  is_remote: boolean;
  starts_at: string | null;
  ends_at: string | null;
  slots: number | null;
  slots_filled: number;
  time_commitment: string | null;
  contact_url: string | null;
  status: VolunteerStatus;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export const OPPORTUNITY_PUBLIC_COLUMNS =
  'id,slug,title,org_name,summary,category,skills,location,country,is_remote,' +
  'starts_at,ends_at,slots,slots_filled,time_commitment,status,verified,created_at,updated_at';

export const OPPORTUNITY_DETAIL_COLUMNS = OPPORTUNITY_PUBLIC_COLUMNS + ',description,contact_url';

// ── Validation ───────────────────────────────────────────────────────────────
export const OpportunitySearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(80).optional(),
  skill: z.string().trim().max(80).optional(),
  remote: z.enum(['true', 'false']).optional(),
  status: z.enum(['open', 'upcoming', 'closed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});
export type OpportunitySearchParams = z.infer<typeof OpportunitySearchSchema>;

export const VolunteerApplySchema = z.object({
  message: z.string().trim().max(5000).optional(),
});

export const VolunteerMatchRequestSchema = z.object({
  skills: z.array(z.string().trim().max(80)).max(40).optional(),
  category: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  remoteOk: z.boolean().optional(),
  keywords: z.string().trim().max(500).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});
export type VolunteerMatchRequest = z.infer<typeof VolunteerMatchRequestSchema>;

// ── Deterministic matching scorer ────────────────────────────────────────────

export interface VolunteerMatchResult {
  opportunityId: string;
  score: number;
  reasons: string[];
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

/**
 * Score how well an opportunity fits a volunteer. Pure/deterministic. Max 100:
 * skill overlap 45, category 25, geography/remote 20, keyword 10. Closed → 0.
 */
export function scoreVolunteerMatch(
  opp: VolunteerOpportunity,
  req: VolunteerMatchRequest,
): VolunteerMatchResult {
  const reasons: string[] = [];
  let score = 0;

  if (opp.status === 'closed') {
    return { opportunityId: opp.id, score: 0, reasons: ['Opportunity is closed'] };
  }

  // Skill overlap (up to 45)
  const want = (req.skills ?? []).map(norm).filter(Boolean);
  const have = opp.skills.map(norm).filter(Boolean);
  if (want.length && have.length) {
    const overlap = want.filter((s) => have.includes(s));
    if (overlap.length) {
      score += Math.min(45, overlap.length * 15);
      reasons.push(`Matching skills: ${overlap.join(', ')}`);
    }
  } else if (want.length && have.length === 0) {
    score += 10; // no required skills → open to anyone
    reasons.push('No specific skills required');
  }

  // Category (25)
  if (req.category && norm(opp.category) && norm(opp.category) === norm(req.category)) {
    score += 25;
    reasons.push(`Category matches (${opp.category})`);
  }

  // Geography / remote (20)
  if (opp.is_remote && req.remoteOk !== false) {
    score += 20;
    reasons.push('Remote-friendly');
  } else if (req.country && norm(opp.country) && norm(opp.country) === norm(req.country)) {
    score += 20;
    reasons.push(`Located in ${opp.country}`);
  }

  // Keyword (10)
  if (req.keywords) {
    const hay = norm(`${opp.title} ${opp.summary} ${opp.org_name}`);
    const hit = req.keywords.split(/[\s,]+/).map(norm).filter((w) => w.length >= 4 && hay.includes(w));
    if (hit.length) {
      score += 10;
      reasons.push(`Keyword match: ${hit.slice(0, 3).join(', ')}`);
    }
  }

  return { opportunityId: opp.id, score: Math.min(100, Math.round(score)), reasons };
}

export function rankVolunteerMatches(
  opps: VolunteerOpportunity[],
  req: VolunteerMatchRequest,
): VolunteerMatchResult[] {
  return opps
    .map((o) => scoreVolunteerMatch(o, req))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, req.limit);
}

export function volunteerApplicationStatusLabel(status: VolunteerApplicationStatus): string {
  switch (status) {
    case 'applied':   return 'Applied';
    case 'accepted':  return 'Accepted';
    case 'declined':  return 'Not selected';
    case 'withdrawn': return 'Withdrawn';
    case 'completed': return 'Completed';
  }
}

/** True when an opportunity still has open slots. */
export function hasOpenSlots(opp: Pick<VolunteerOpportunity, 'slots' | 'slots_filled'>): boolean {
  return opp.slots == null || opp.slots_filled < opp.slots;
}
