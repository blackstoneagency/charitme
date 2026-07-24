// ─────────────────────────────────────────────────────────────────────────────
// Campaign publish-readiness engine (pure, unit-testable).
//
// Real-time checklist of what a draft still needs, each item pointing at the exact
// wizard step to fix it. `required` items mirror EXACTLY what POST /api/campaigns
// enforces to publish (status='active'): title ≥ 3 chars, story ≥ 20 chars, goal
// ≥ $1 — so `readyToPublish` never disagrees with the server. Everything else is a
// recommendation that lifts the score but doesn't block publishing.
// Sibling UI: rendered in the wizard's review step.
// ─────────────────────────────────────────────────────────────────────────────

// Mirrors the wizard's step keys. 'type', 'category' and 'location' were merged
// into a single 'basics' screen, so readiness items for those now deep-link there.
export type ReadinessStep =
  | 'basics' | 'story' | 'title' | 'goal' | 'media' | 'payout';

export interface ReadinessInput {
  title: string;
  description: string;
  goalCents: number;
  category: string;
  country: string;
  coverImageUrl: string;
  forSelf: string;          // '' | 'true' | 'false'
  beneficiaryName: string;
  payoutLinked: boolean;
}

export interface ReadinessItem {
  id: string;
  label: string;
  done: boolean;
  required: boolean;        // blocks publishing when not done
  step: ReadinessStep;
  hint?: string;            // shown when not done
}

export interface ReadinessResult {
  items: ReadinessItem[];
  /** 0–100 — share of ALL applicable items complete (equal weight). */
  score: number;
  /** True only when every REQUIRED item is complete (mirrors the publish API). */
  readyToPublish: boolean;
  missingRequired: ReadinessItem[];
}

function has(v: string | undefined | null): boolean {
  return !!v && v.trim().length > 0;
}

export function publishReadiness(input: ReadinessInput): ReadinessResult {
  const forSomeoneElse = input.forSelf === 'false';

  const items: ReadinessItem[] = [
    {
      id: 'title', label: 'Campaign title', step: 'title', required: true,
      done: input.title.trim().length >= 3,
      hint: 'Add a clear title (at least 3 characters).',
    },
    {
      id: 'story', label: 'Your story', step: 'story', required: true,
      done: input.description.trim().length >= 20,
      hint: 'Write at least a couple of sentences about your cause.',
    },
    {
      id: 'goal', label: 'Fundraising goal', step: 'goal', required: true,
      done: input.goalCents >= 100,
      hint: 'Set a goal of at least $1.',
    },
    {
      id: 'category', label: 'Category', step: 'basics', required: false,
      done: has(input.category),
      hint: 'Pick a category so donors can find your campaign.',
    },
    {
      id: 'location', label: 'Location', step: 'basics', required: false,
      done: has(input.country),
      hint: 'Add your country to build trust.',
    },
    {
      id: 'media', label: 'Cover photo', step: 'media', required: false,
      done: has(input.coverImageUrl),
      hint: 'Campaigns with a photo raise significantly more.',
    },
    {
      id: 'payout', label: 'Payout method', step: 'payout', required: false,
      done: input.payoutLinked,
      hint: 'Connect a payout method so you can receive donations.',
    },
  ];

  // Only relevant when raising for someone else.
  if (forSomeoneElse) {
    items.splice(3, 0, {
      id: 'beneficiary', label: 'Who it benefits', step: 'story', required: false,
      done: has(input.beneficiaryName),
      hint: 'Name the person or group you’re raising funds for.',
    });
  }

  const doneCount = items.filter((i) => i.done).length;
  const score = Math.round((doneCount / items.length) * 100);
  const missingRequired = items.filter((i) => i.required && !i.done);

  return { items, score, readyToPublish: missingRequired.length === 0, missingRequired };
}
