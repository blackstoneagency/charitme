// ─────────────────────────────────────────────────────────────────────────────
// The 12-step "Create a Campaign with AI" flow.
//
// Pure: no I/O, no React, no Supabase. The step order, the per-step gate, and
// the money arithmetic are the parts that decide whether a campaign can be
// created, so they are the parts that must be testable without a database.
//
// The flow splits at step 8. Steps 1–8 shape a DRAFT and touch nothing;
// step 8 creates the campaign; steps 9–12 act on the campaign that now exists.
// That boundary is why `requiresCampaign` is recorded per step rather than
// inferred — a step that calls a campaign-scoped API before the campaign exists
// fails with a 404 that reads like a bug in the API.
// ─────────────────────────────────────────────────────────────────────────────

import { CAMPAIGN_CATEGORIES, type CampaignCategory } from '@shared/fees';

export const AI_STEP_IDS = [
  'cause',        // 1  what are you raising for
  'understand',   // 2  here's what I understand — confirm
  'questions',    // 3  a few questions to personalise
  'story',        // 4  here's your campaign story
  'title',        // 5  title + cover image
  'goal',         // 6  goal recommendation
  'impact',       // 7  what the goal will fund
  'review',       // 8  final review → CREATES THE CAMPAIGN
  'team',         // 9  add team members (optional)
  'sharing',      // 10 social + sharing kit
  'tips',         // 11 tips for success
  'ready',        // 12 campaign ready
] as const;

export type AiStepId = (typeof AI_STEP_IDS)[number];

export interface AiStep {
  id: AiStepId;
  /** 1-based, matching the numbers in the design. */
  number: number;
  title: string;
  /** Short line under the title. */
  blurb: string;
  /** True for steps 9–12, which act on a campaign that must already exist. */
  requiresCampaign: boolean;
  /** True when the step may be skipped without blocking (step 9 only). */
  optional: boolean;
}

export const AI_STEPS: readonly AiStep[] = [
  { id: 'cause',      number: 1,  title: "Let's create your campaign",   blurb: "I'll guide you step by step.",                 requiresCampaign: false, optional: false },
  { id: 'understand', number: 2,  title: "Here's what I understand",     blurb: 'Check I have this right before we build.',     requiresCampaign: false, optional: false },
  { id: 'questions',  number: 3,  title: 'A few questions',              blurb: 'These personalise your campaign.',             requiresCampaign: false, optional: false },
  { id: 'story',      number: 4,  title: "Here's your campaign story",   blurb: 'Regenerate it or edit it yourself.',           requiresCampaign: false, optional: false },
  { id: 'title',      number: 5,  title: 'Campaign title & image',       blurb: 'Pick a title and a cover photo.',              requiresCampaign: false, optional: false },
  { id: 'goal',       number: 6,  title: 'Goal recommendation',          blurb: 'Based on similar campaigns.',                  requiresCampaign: false, optional: false },
  { id: 'impact',     number: 7,  title: 'What your goal will fund',     blurb: 'Your plan, shown to donors.',                  requiresCampaign: false, optional: false },
  { id: 'review',     number: 8,  title: 'Final review',                 blurb: 'This creates your campaign.',                  requiresCampaign: false, optional: false },
  { id: 'team',       number: 9,  title: 'Add team members',             blurb: 'Optional — you can do this later.',            requiresCampaign: true,  optional: true  },
  { id: 'sharing',    number: 10, title: 'Social & sharing kit',         blurb: 'Ready-to-post captions.',                      requiresCampaign: true,  optional: false },
  { id: 'tips',       number: 11, title: 'Tips for success',             blurb: 'What actually moves donations.',               requiresCampaign: true,  optional: false },
  { id: 'ready',      number: 12, title: 'Campaign ready',               blurb: 'Share it and start raising.',                  requiresCampaign: true,  optional: false },
];

/** The step at which the campaign row is written. Steps after this cannot go back. */
export const CREATE_AT_STEP: AiStepId = 'review';

export function stepIndex(id: AiStepId): number {
  return AI_STEP_IDS.indexOf(id);
}

export function stepByNumber(n: number): AiStep | undefined {
  return AI_STEPS.find((s) => s.number === n);
}

/**
 * The step after `id`, or `null` at the end.
 *
 * Deliberately does NOT know about validation — `canAdvance` answers that. Two
 * concerns in one function is how a wizard ends up able to skip a gate by
 * navigating rather than submitting.
 */
export function nextStep(id: AiStepId): AiStepId | null {
  const i = stepIndex(id);
  return i >= 0 && i < AI_STEP_IDS.length - 1 ? AI_STEP_IDS[i + 1]! : null;
}

/**
 * The step before `id`, or `null`.
 *
 * Returns `null` for every step after the campaign is created: once the row
 * exists, "Back" into the drafting steps would offer edits that silently do not
 * apply to the created campaign. Those steps link to the real editor instead.
 */
export function prevStep(id: AiStepId): AiStepId | null {
  const i = stepIndex(id);
  if (i <= 0) return null;
  if (AI_STEPS[i]!.requiresCampaign) return null;
  return AI_STEP_IDS[i - 1]!;
}

// ── The draft ────────────────────────────────────────────────────────────────

export interface ImpactLine {
  /** e.g. "Clean water wells" */
  label: string;
  /** e.g. 5 — the organizer's stated quantity. */
  quantity: number;
  /** Cents this line accounts for. */
  cents: number;
}

export interface AiDraft {
  category: string;
  /** Free text from step 1. */
  cause: string;
  /** Step 2 — the restated summary the organizer confirmed. */
  understood: string;
  confirmed: boolean;
  // Step 3
  beneficiary: string;
  location: string;
  timeframe: string;
  // Step 4/5
  story: string;
  title: string;
  coverImageUrl: string;
  // Step 6
  goalCents: number;
  // Step 7
  impact: ImpactLine[];
}

export const EMPTY_DRAFT: AiDraft = {
  category: '', cause: '', understood: '', confirmed: false,
  beneficiary: '', location: '', timeframe: '',
  story: '', title: '', coverImageUrl: '', goalCents: 0, impact: [],
};

/** Mirrors the publish bar in `lib/campaign-readiness.ts`. */
export const AI_MIN_STORY_CHARS = 150;
export const AI_MIN_GOAL_CENTS = 100_000; // $1,000
export const AI_MAX_GOAL_CENTS = 1_000_000_000; // $10,000,000

export interface StepGate {
  ok: boolean;
  /** Why the step cannot be left. Shown next to the disabled control. */
  reason?: string;
}

/**
 * May the flow leave `step` with this draft?
 *
 * One gate per step, in one place, so the button's `disabled` and the submit
 * handler cannot disagree — a wizard whose button is enabled but whose submit
 * refuses is indistinguishable from a broken button.
 */
export function canAdvance(step: AiStepId, draft: AiDraft): StepGate {
  switch (step) {
    case 'cause':
      if (!draft.category) return { ok: false, reason: 'Choose what you are raising money for.' };
      if (draft.cause.trim().length < 10) return { ok: false, reason: 'Describe your cause in a sentence or two.' };
      return { ok: true };
    case 'understand':
      return draft.confirmed
        ? { ok: true }
        : { ok: false, reason: 'Confirm this is right, or edit it.' };
    case 'questions':
      if (!draft.beneficiary.trim()) return { ok: false, reason: 'Say who the campaign helps.' };
      return { ok: true };
    case 'story':
      return draft.story.trim().length >= AI_MIN_STORY_CHARS
        ? { ok: true }
        : { ok: false, reason: `Your story needs at least ${AI_MIN_STORY_CHARS} characters.` };
    case 'title':
      return draft.title.trim().length >= 3
        ? { ok: true }
        : { ok: false, reason: 'Give your campaign a title.' };
    case 'goal':
      if (draft.goalCents < AI_MIN_GOAL_CENTS) {
        return { ok: false, reason: `Set a goal of at least $${(AI_MIN_GOAL_CENTS / 100).toLocaleString()}.` };
      }
      if (draft.goalCents > AI_MAX_GOAL_CENTS) {
        return { ok: false, reason: 'That goal is above the platform maximum.' };
      }
      return { ok: true };
    case 'impact':
      // Deliberately NOT required. The impact plan is the organizer's own
      // statement about what the money will buy; forcing one would push people
      // to invent line items to get past a wizard, which is precisely the
      // fabricated-outcome problem this flow is supposed to avoid.
      return { ok: true };
    case 'review':
      // The last gate before a row is written: re-check everything, because a
      // user who edited a field after passing its own step must not slip
      // through on a stale pass.
      for (const s of ['cause', 'understand', 'questions', 'story', 'title', 'goal'] as AiStepId[]) {
        const gate = canAdvance(s, draft);
        if (!gate.ok) return gate;
      }
      return { ok: true };
    default:
      return { ok: true };
  }
}

// ── Step 7 arithmetic ────────────────────────────────────────────────────────

/** Cents accounted for by the impact plan. */
export function impactAllocatedCents(lines: readonly ImpactLine[]): number {
  return lines.reduce((sum, l) => sum + Math.max(0, Math.round(l.cents || 0)), 0);
}

/**
 * Cents the plan has NOT accounted for. Never negative.
 *
 * Shown to the organizer as "still to allocate". The clamp matters: an
 * over-allocated plan reporting a negative remainder would render as
 * "-$4,000 left", which reads like a platform arithmetic bug rather than the
 * organizer's own over-commitment. `impactOverAllocatedCents` says that plainly
 * instead.
 */
export function impactRemainingCents(goalCents: number, lines: readonly ImpactLine[]): number {
  return Math.max(0, Math.round(goalCents) - impactAllocatedCents(lines));
}

/** Cents allocated BEYOND the goal, or 0. The honest half of the pair above. */
export function impactOverAllocatedCents(goalCents: number, lines: readonly ImpactLine[]): number {
  return Math.max(0, impactAllocatedCents(lines) - Math.round(goalCents));
}

/**
 * Suggested impact lines for a goal — a STARTING POINT the organizer edits.
 *
 * ⚠️ These are projections of what the organizer plans to buy, never claims
 * about what has been achieved. The design's tiles ("5 Clean Water Wells",
 * "2,500+ People Served") read as results; presented as results they would be
 * fabricated outcomes for a campaign that has raised nothing, which this repo
 * refuses elsewhere. They are labelled as a plan in the UI, stored as the
 * organizer's stated plan, and every quantity is derived from the goal and the
 * organizer's own unit cost rather than invented here.
 */
export function suggestImpactLines(goalCents: number, category: string): ImpactLine[] {
  const goal = Math.max(0, Math.round(goalCents));
  if (goal <= 0) return [];
  // Three even parts is a neutral starting split, not a claim about this
  // category's real cost structure — which nothing in this product knows.
  const part = Math.floor(goal / 3);
  const labels = IMPACT_LABELS[category] ?? IMPACT_LABELS.Other!;
  return labels.map((label, i) => ({
    label,
    quantity: 1,
    // The last line absorbs the rounding remainder so the three lines always
    // sum to exactly the goal — otherwise "still to allocate" shows $0.02.
    cents: i === labels.length - 1 ? goal - part * (labels.length - 1) : part,
  }));
}

const IMPACT_LABELS: Record<string, string[]> = {
  Medical:     ['Treatment and procedures', 'Medication and supplies', 'Travel and recovery costs'],
  Education:   ['Tuition and fees', 'Books and materials', 'Living and transport costs'],
  Emergency:   ['Immediate essentials', 'Temporary housing', 'Replacing what was lost'],
  Community:   ['Materials and equipment', 'Site and setup costs', 'Running the programme'],
  Animal:      ['Veterinary treatment', 'Food and shelter', 'Ongoing care'],
  Memorial:    ['Funeral and service costs', 'Outstanding expenses', 'Support for the family'],
  Nonprofit:   ['Programme delivery', 'Equipment and supplies', 'Reaching more people'],
  Sports:      ['Equipment and kit', 'Travel and entry fees', 'Coaching and facilities'],
  Other:       ['Direct costs', 'Materials and supplies', 'Delivery and follow-through'],
};

/**
 * Categories offered on step 1.
 *
 * ⚠️ DERIVED from `CAMPAIGN_CATEGORIES`, never re-listed. A local copy is how
 * three category lists in this repo had already drifted, and here it would be
 * worse than cosmetic: step 1 writes `draft.category` straight into
 * `POST /api/campaigns`, which validates against `z.enum(CAMPAIGN_CATEGORIES)`.
 * A chip naming a category the enum does not have would pass every step and
 * then 400 at step 8, after the whole flow had been filled in.
 *
 * The design shows a short row of the most common causes rather than all
 * eighteen, so this picks a subset BY NAME and asserts each name exists — an
 * unknown name is a build-time type error, not a runtime 400.
 */
const FEATURED_CAUSES = [
  'Medical', 'Memorial', 'Education', 'Emergency', 'Community', 'Animal', 'Nonprofit', 'Sports',
] as const satisfies readonly CampaignCategory[];

export const AI_CAUSE_CHOICES: readonly CampaignCategory[] = FEATURED_CAUSES;

/** Every category, for the "more categories" control behind the featured row. */
export const AI_ALL_CATEGORIES: readonly CampaignCategory[] = CAMPAIGN_CATEGORIES;

/**
 * The one-line restatement shown on step 2.
 *
 * Built from what the organizer actually typed rather than generated, so the
 * "is this right?" question is answerable: a restatement that quietly adds
 * detail the organizer never gave cannot be checked by reading it.
 */
export function restateCause(draft: Pick<AiDraft, 'category' | 'cause'>): string {
  const cause = draft.cause.trim().replace(/\s+/g, ' ');
  if (!cause) return '';
  const lower = cause.charAt(0).toLowerCase() + cause.slice(1);
  return `You want to raise money for ${lower.replace(/\.$/, '')}.`;
}
