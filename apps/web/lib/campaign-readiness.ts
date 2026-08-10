import { formatMoneyShort } from '@shared/currencies';

export type ReadinessStep =
  | 'purpose'
  | 'beneficiary'
  | 'category'
  | 'location'
  | 'goal'
  | 'plan'
  | 'story'
  | 'media'
  | 'settings'
  | 'payout'
  | 'verify';

export const PUBLISH_MIN_TITLE_CHARS = 3;
export const PUBLISH_MIN_STORY_CHARS = 20;
export const PUBLISH_MIN_GOAL_CENTS = 100;

export type ReadinessInput = {
  title: string;
  description: string;
  goalCents: number;
  currency?: string;
  category: string;
  country: string;
  coverImageUrl: string;
  forSelf: string;
  beneficiaryName: string;
  beneficiaryRelationship: string;
  payoutLinked: boolean;
  useOfFundsComplete: boolean;
  organizerComplete: boolean;
  verificationComplete: boolean;
  policyAccepted: boolean;
};

export type ReadinessItem = {
  id: string;
  label: string;
  done: boolean;
  required: boolean;
  step: ReadinessStep;
  hint?: string;
};

export type ReadinessStatus = 'needs_attention' | 'ready_to_publish' | 'under_review' | 'published';

export type ReadinessResult = {
  items: ReadinessItem[];
  score: number;
  readyToPublish: boolean;
  missingRequired: ReadinessItem[];
  status: ReadinessStatus;
};

function has(value: string | undefined | null): boolean {
  return Boolean(value?.trim());
}

export function publishReadiness(input: ReadinessInput): ReadinessResult {
  const forSomeoneElse = input.forSelf === 'false';
  const items: ReadinessItem[] = [
    {
      id: 'title', label: 'Campaign title', step: 'purpose', required: true,
      done: input.title.trim().length >= PUBLISH_MIN_TITLE_CHARS,
      hint: 'Add a clear title with at least 3 characters.',
    },
    {
      id: 'organizer', label: 'Organizer details', step: 'beneficiary', required: true,
      done: input.organizerComplete,
      hint: 'Sign in and complete the organizer name on your profile.',
    },
    {
      id: 'beneficiary', label: 'Beneficiary details', step: 'beneficiary', required: true,
      done: has(input.forSelf)
        && (!forSomeoneElse || (has(input.beneficiaryName) && has(input.beneficiaryRelationship))),
      hint: 'Tell donors who will benefit and your relationship to them.',
    },
    {
      id: 'category', label: 'Category', step: 'category', required: true,
      done: has(input.category),
      hint: 'Choose a category so donors can find the campaign.',
    },
    {
      id: 'location', label: 'Location', step: 'location', required: true,
      done: has(input.country),
      hint: 'Add the beneficiary location.',
    },
    {
      id: 'goal', label: 'Fundraising goal', step: 'goal', required: true,
      done: input.goalCents >= PUBLISH_MIN_GOAL_CENTS,
      hint: `Set a goal of at least ${formatMoneyShort(PUBLISH_MIN_GOAL_CENTS, input.currency)}.`,
    },
    {
      id: 'plan', label: 'Use of funds', step: 'plan', required: true,
      done: input.useOfFundsComplete,
      hint: 'Add a budget whose line items total the fundraising goal.',
    },
    {
      id: 'story', label: 'Campaign story', step: 'story', required: true,
      done: input.description.trim().length >= PUBLISH_MIN_STORY_CHARS,
      hint: 'Write at least a couple of sentences about the need and impact.',
    },
    {
      id: 'media', label: 'Cover photo', step: 'media', required: true,
      done: has(input.coverImageUrl),
      hint: 'Upload a clear cover photo before publishing.',
    },
    {
      id: 'policy', label: 'Policy acknowledgement', step: 'settings', required: true,
      done: input.policyAccepted,
      hint: 'Confirm the campaign is accurate and follows platform policies.',
    },
    {
      id: 'payout', label: 'Verified payout account', step: 'payout', required: true,
      done: input.payoutLinked,
      hint: 'Finish Stripe Connect onboarding so donations can be routed safely.',
    },
    {
      id: 'verification', label: 'Required verification', step: 'verify', required: true,
      done: input.verificationComplete,
      hint: 'Complete identity verification and any organization checks before publishing.',
    },
  ];

  const missingRequired = items.filter((item) => item.required && !item.done);
  const doneCount = items.filter((item) => item.done).length;
  const score = Math.round((doneCount / items.length) * 100);
  const readyToPublish = missingRequired.length === 0;
  return {
    items,
    score,
    readyToPublish,
    missingRequired,
    status: readyToPublish ? 'ready_to_publish' : 'needs_attention',
  };
}
