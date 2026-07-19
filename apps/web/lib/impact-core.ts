// ─────────────────────────────────────────────────────────────────────────────
// Impact tracking — pure domain logic (no I/O, unit-testable).
// Includes the Transparency Score. Sibling `impact.ts` performs the queries.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from 'zod';

export interface ImpactPlan {
  id: string;
  campaign_id: string;
  title: string;
  summary: string | null;
  total_budget_cents: number;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export interface ImpactPlanItem {
  id: string;
  plan_id: string;
  label: string;
  category: string | null;
  planned_amount_cents: number;
  spent_amount_cents: number;
  sort: number;
}

export interface ImpactUpdate {
  id: string;
  campaign_id: string;
  title: string;
  body: string;
  amount_spent_cents: number | null;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export interface ImpactEvidence {
  id: string;
  update_id: string;
  kind: 'image' | 'receipt' | 'video' | 'document' | 'link';
  url: string;
  caption: string | null;
}

export interface ImpactMetric {
  id: string;
  campaign_id: string;
  label: string;
  unit: string | null;
  target_value: number | null;
  current_value: number;
  sort: number;
}

export const EVIDENCE_KINDS = ['image', 'receipt', 'video', 'document', 'link'] as const;

// ── Budget helpers ────────────────────────────────────────────────────────────

export function sumPlanned(items: readonly Pick<ImpactPlanItem, 'planned_amount_cents'>[]): number {
  return items.reduce((s, i) => s + i.planned_amount_cents, 0);
}
export function sumSpent(items: readonly Pick<ImpactPlanItem, 'spent_amount_cents'>[]): number {
  return items.reduce((s, i) => s + i.spent_amount_cents, 0);
}

/** Percent of budget spent (0–100), clamped. Null budget/0 → based on any spend. */
export function budgetProgress(totalBudgetCents: number, spentCents: number): number {
  if (totalBudgetCents <= 0) return spentCents > 0 ? 100 : 0;
  return Math.min(100, Math.round((spentCents / totalBudgetCents) * 100));
}

/** Metric progress toward target (0–100), or null if no positive target. */
export function metricProgress(metric: Pick<ImpactMetric, 'target_value' | 'current_value'>): number | null {
  if (!metric.target_value || metric.target_value <= 0) return null;
  return Math.min(100, Math.round((metric.current_value / metric.target_value) * 100));
}

// ── Transparency Score ────────────────────────────────────────────────────────

export interface TransparencyInput {
  hasPublishedPlan: boolean;
  totalBudgetCents: number;
  totalSpentCents: number;
  publishedUpdateCount: number;
  updatesWithEvidenceCount: number;
  metricCount: number;
}

export interface TransparencyResult {
  score: number; // 0–100
  rating: 'Building' | 'Developing' | 'Strong' | 'Exceptional';
  factors: { label: string; points: number; max: number }[];
}

/**
 * Deterministic 0–100 transparency score from tracked impact signals.
 * Weights: plan 20, spend coverage 25, updates 25, evidence 20, metrics 10.
 */
export function transparencyScore(input: TransparencyInput): TransparencyResult {
  const plan = input.hasPublishedPlan ? 20 : 0;

  const spendCoverage = input.totalBudgetCents > 0
    ? Math.min(1, input.totalSpentCents / input.totalBudgetCents) * 25
    : input.totalSpentCents > 0 ? 15 : 0;

  const updates = (Math.min(input.publishedUpdateCount, 4) / 4) * 25;

  const evidence = input.publishedUpdateCount > 0
    ? (Math.min(input.updatesWithEvidenceCount, input.publishedUpdateCount) / input.publishedUpdateCount) * 20
    : 0;

  const metrics = (Math.min(input.metricCount, 3) / 3) * 10;

  const score = Math.round(plan + spendCoverage + updates + evidence + metrics);
  const rating =
    score >= 90 ? 'Exceptional' : score >= 75 ? 'Strong' : score >= 50 ? 'Developing' : 'Building';

  return {
    score,
    rating,
    factors: [
      { label: 'Published spending plan', points: Math.round(plan), max: 20 },
      { label: 'Spend tracked against budget', points: Math.round(spendCoverage), max: 25 },
      { label: 'Progress updates', points: Math.round(updates), max: 25 },
      { label: 'Evidence attached', points: Math.round(evidence), max: 20 },
      { label: 'Outcome metrics', points: Math.round(metrics), max: 10 },
    ],
  };
}

// ── Validation schemas ────────────────────────────────────────────────────────

const PlanItemSchema = z.object({
  label: z.string().trim().min(1).max(160),
  category: z.string().trim().max(80).optional().nullable(),
  planned_amount_cents: z.number().int().min(0).max(1_000_000_000_000).default(0),
  spent_amount_cents: z.number().int().min(0).max(1_000_000_000_000).default(0),
});

export const PlanUpsertSchema = z.object({
  campaign_id: z.string().uuid(),
  title: z.string().trim().min(2).max(160).default('Impact Plan'),
  summary: z.string().trim().max(8000).optional().nullable(),
  status: z.enum(['draft', 'published']).default('published'),
  items: z.array(PlanItemSchema).max(60).default([]),
});

export const PlanPatchSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  summary: z.string().trim().max(8000).optional().nullable(),
  status: z.enum(['draft', 'published']).optional(),
});

const EvidenceSchema = z.object({
  kind: z.enum(EVIDENCE_KINDS).default('image'),
  url: z.string().url().max(1000),
  caption: z.string().trim().max(300).optional().nullable(),
});

export const UpdateCreateSchema = z.object({
  campaign_id: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(1).max(12000),
  amount_spent_cents: z.number().int().min(0).max(1_000_000_000_000).optional().nullable(),
  status: z.enum(['draft', 'published']).default('published'),
  evidence: z.array(EvidenceSchema).max(12).default([]),
});

export const UpdatePatchSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  body: z.string().trim().min(1).max(12000).optional(),
  amount_spent_cents: z.number().int().min(0).max(1_000_000_000_000).optional().nullable(),
  status: z.enum(['draft', 'published']).optional(),
});

export const MetricCreateSchema = z.object({
  campaign_id: z.string().uuid(),
  label: z.string().trim().min(1).max(160),
  unit: z.string().trim().max(40).optional().nullable(),
  target_value: z.number().min(0).max(1_000_000_000_000).optional().nullable(),
  current_value: z.number().min(0).max(1_000_000_000_000).default(0),
});

export const MetricPatchSchema = z.object({
  label: z.string().trim().min(1).max(160).optional(),
  unit: z.string().trim().max(40).optional().nullable(),
  target_value: z.number().min(0).max(1_000_000_000_000).optional().nullable(),
  current_value: z.number().min(0).max(1_000_000_000_000).optional(),
});
