/**
 * One campaign journey shared by AI and guided creation.
 *
 * The first twelve steps end at preview/readiness. `publish` and `share` are
 * post-publish states and cannot navigate back into an already-live draft.
 */
export const CAMPAIGN_STEPS = [
  'purpose',
  'beneficiary',
  'category',
  'location',
  'goal',
  'plan',
  'story',
  'media',
  'settings',
  'payout',
  'verify',
  'review',
  'publish',
  'share',
] as const;

export type CampaignStep = (typeof CAMPAIGN_STEPS)[number];

export type CampaignStepMeta = {
  id: CampaignStep;
  label: string;
  title: string;
  minutes: number;
  required: boolean;
  postPublish: boolean;
};

export const CAMPAIGN_STEP_META: Readonly<Record<CampaignStep, CampaignStepMeta>> = {
  purpose: {
    id: 'purpose', label: 'Purpose', title: 'What are you raising money for?',
    minutes: 1, required: true, postPublish: false,
  },
  beneficiary: {
    id: 'beneficiary', label: 'Beneficiary', title: 'Who is it for?',
    minutes: 1, required: true, postPublish: false,
  },
  category: {
    id: 'category', label: 'Category', title: 'What category fits best?',
    minutes: 0, required: true, postPublish: false,
  },
  location: {
    id: 'location', label: 'Location', title: 'Where are they located?',
    minutes: 0, required: true, postPublish: false,
  },
  goal: {
    id: 'goal', label: 'Goal', title: 'How much do you need?',
    minutes: 1, required: true, postPublish: false,
  },
  plan: {
    id: 'plan', label: 'Plan', title: 'What will the funds cover?',
    minutes: 1, required: true, postPublish: false,
  },
  story: {
    id: 'story', label: 'Story', title: 'Tell the story',
    minutes: 2, required: true, postPublish: false,
  },
  media: {
    id: 'media', label: 'Media', title: 'Add photos or video',
    minutes: 1, required: true, postPublish: false,
  },
  settings: {
    id: 'settings', label: 'Settings', title: 'Choose campaign settings',
    minutes: 1, required: true, postPublish: false,
  },
  payout: {
    id: 'payout', label: 'Payout', title: 'Set the payout recipient',
    minutes: 1, required: true, postPublish: false,
  },
  verify: {
    id: 'verify', label: 'Verify', title: 'Complete required verification',
    minutes: 1, required: true, postPublish: false,
  },
  review: {
    id: 'review', label: 'Preview', title: 'Preview and publish readiness',
    minutes: 0, required: true, postPublish: false,
  },
  publish: {
    id: 'publish', label: 'Published', title: "You're live",
    minutes: 0, required: true, postPublish: true,
  },
  share: {
    id: 'share', label: 'Share', title: 'Invite your first supporters',
    minutes: 0, required: true, postPublish: true,
  },
};

export function builderSteps(): CampaignStep[] {
  return CAMPAIGN_STEPS.filter((step) => !CAMPAIGN_STEP_META[step].postPublish);
}

export function optionalSteps(): CampaignStep[] {
  return CAMPAIGN_STEPS.filter((step) => !CAMPAIGN_STEP_META[step].required);
}

export function stepPosition(step: CampaignStep): { index: number; total: number } {
  if (CAMPAIGN_STEP_META[step].postPublish) {
    return { index: CAMPAIGN_STEPS.indexOf(step) + 1, total: CAMPAIGN_STEPS.length };
  }
  const steps = builderSteps();
  return { index: steps.indexOf(step) + 1, total: steps.length };
}

export function nextStep(step: CampaignStep): CampaignStep | null {
  const index = CAMPAIGN_STEPS.indexOf(step);
  return index >= 0 && index < CAMPAIGN_STEPS.length - 1 ? CAMPAIGN_STEPS[index + 1]! : null;
}

export function previousStep(step: CampaignStep): CampaignStep | null {
  const index = CAMPAIGN_STEPS.indexOf(step);
  return index > 0 ? CAMPAIGN_STEPS[index - 1]! : null;
}

export function canGoBack(step: CampaignStep): boolean {
  return !CAMPAIGN_STEP_META[step].postPublish && previousStep(step) !== null;
}

export function minutesRemaining(step: CampaignStep): number {
  const index = CAMPAIGN_STEPS.indexOf(step);
  if (index < 0) return 0;
  return CAMPAIGN_STEPS.slice(index)
    .filter((item) => !CAMPAIGN_STEP_META[item].postPublish)
    .reduce((total, item) => total + CAMPAIGN_STEP_META[item].minutes, 0);
}

const LEGACY_STEP_MAP: Record<string, CampaignStep> = {
  path: 'beneficiary',
  type: 'beneficiary',
  basics: 'beneficiary',
  essentials: 'purpose',
  title: 'purpose',
  goal: 'goal',
  story: 'story',
  rewards: 'settings',
  summary: 'review',
  live: 'publish',
};

export function normalizeStep(raw: string | null | undefined): CampaignStep | null {
  if (!raw) return null;
  const legacy = LEGACY_STEP_MAP[raw];
  if (legacy) return legacy;
  return (CAMPAIGN_STEPS as readonly string[]).includes(raw) ? raw as CampaignStep : null;
}

export function firstIncompleteStep(
  completed: Partial<Record<CampaignStep, boolean>>,
): CampaignStep {
  for (const step of builderSteps()) {
    if (!CAMPAIGN_STEP_META[step].required) continue;
    if (!completed[step]) return step;
  }
  return 'review';
}

export function nextIncompleteStepAfter(
  current: CampaignStep,
  completed: Partial<Record<CampaignStep, boolean>>,
): CampaignStep {
  const steps = builderSteps();
  const currentIndex = steps.indexOf(current);
  for (const step of steps.slice(Math.max(0, currentIndex + 1))) {
    if (step === 'review' || !completed[step]) return step;
  }
  return 'review';
}
