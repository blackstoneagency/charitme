/**
 * The 12-step campaign-creation flow — pure model.
 *
 * This is the builder's counterpart to `donation-flow-core.ts`, and follows the
 * same rule that module established: **every step must correspond to something
 * this platform can actually store or do.** A step that collects input with
 * nowhere to put it is a form that lies, and the donation model already refused
 * one (the honoree-notification tick box) on exactly that ground.
 *
 * So each of the twelve below is anchored to a real table or route:
 *
 * |  # | step      | backed by                                              |
 * |---:|-----------|--------------------------------------------------------|
 * |  1 | `path`    | `/create/choose-path` — personal / nonprofit / team     |
 * |  2 | `basics`  | `campaigns.category`, `.location`, beneficiary          |
 * |  3 | `title`   | `campaigns.title`, `.slug`                              |
 * |  4 | `story`   | `campaigns.description` (+ story sections)              |
 * |  5 | `media`   | campaign cover + gallery images                         |
 * |  6 | `goal`    | `campaigns.goal_amount` (cents)                         |
 * |  7 | `rewards` | `campaign_rewards` (+ `claim_campaign_reward` RPC)      |
 * |  8 | `payout`  | `profiles.stripe_account_id`, `.stripe_onboarded`       |
 * |  9 | `verify`  | `verification_documents`, `nonprofit_profiles`          |
 * | 10 | `review`  | — (reads back the nine above)                           |
 * | 11 | `publish` | `campaigns.status`, `campaign_status_log`               |
 * | 12 | `share`   | `/campaigns/[slug]/share`, `campaign_updates`           |
 *
 * ⚠️ **Steps 7 and 9 are OPTIONAL, and that is load-bearing.**
 *
 * Rewards suit a product launch and are meaningless for a memorial. Verification
 * is a genuine gate for a nonprofit claiming charitable status, and irrelevant to
 * someone raising money for a neighbour's vet bill. Making either mandatory would
 * block the majority of organizers on a screen that does not apply to them — the
 * single most expensive thing a funnel can do. `required: false` lets the wizard
 * offer them and move on.
 *
 * ⚠️ **Steps 11 and 12 are POST-PUBLISH.** Once the campaign is live it has a
 * public URL that may already have been shared, so "Back" must not reopen the
 * builder as though the campaign were still a draft — the same rule that stops
 * the donation flow reopening a paid form and inviting a second charge. Editing a
 * live campaign is a separate, deliberate act via the dashboard, not an undo.
 */

/**
 * ⚠️ ORDER CHANGED, and the reason is the whole point of this list.
 *
 * The publish gate wants exactly three things — a title, a story of 20
 * characters, and a goal of at least $1 (`campaign-readiness.ts`, which the
 * server's schema shares). Those three used to sit at positions 3, 4 and 6,
 * behind `basics` and with `media` wedged between story and goal, so an
 * organizer passed five screens before their draft was publishable at all.
 *
 * They now come first, which makes "Publish now" reachable on screen three
 * instead of screen six. Everything after them is what it always was —
 * optional strengthening — and now looks like it.
 *
 * ⚠️ No step KEY changed, only the order, and that is deliberate: keys are what
 * `normalizeStep` migrates and what live drafts hold. A draft saved mid-flow
 * still resolves to the same screen it was on. Reordering is safe here in a way
 * that renaming would not be.
 *
 * `path` stays first in the list but is not where the wizard starts — the
 * builder opens on `title` and `path` is reached by going Back, exactly as it
 * was reached from `basics` before.
 */
export const CAMPAIGN_STEPS = [
  'path',
  'title',
  'story',
  'goal',
  'basics',
  'media',
  'rewards',
  'payout',
  'verify',
  'review',
  'publish',
  'share',
] as const;

export type CampaignStep = (typeof CAMPAIGN_STEPS)[number];

export type CampaignStepMeta = {
  id: CampaignStep;
  /** Stepper label. Short — it renders inside a rail on mobile. */
  label: string;
  /** Sentence shown under the heading, describing what this step is for. */
  title: string;
  /** Rough minutes, used for the "about N minutes left" counter. */
  minutes: number;
  /** False when the organizer may skip it entirely (see the module note). */
  required: boolean;
  /** True once the campaign is live; these steps must never re-collect input. */
  postPublish: boolean;
};

export const CAMPAIGN_STEP_META: Readonly<Record<CampaignStep, CampaignStepMeta>> = {
  path: {
    id: 'path', label: 'Path', title: 'Who are you raising for?',
    minutes: 1, required: true, postPublish: false,
  },
  basics: {
    id: 'basics', label: 'Basics', title: 'The essentials',
    minutes: 1, required: true, postPublish: false,
  },
  title: {
    id: 'title', label: 'Title', title: 'Name your campaign',
    minutes: 1, required: true, postPublish: false,
  },
  story: {
    id: 'story', label: 'Story', title: 'Tell your story',
    minutes: 4, required: true, postPublish: false,
  },
  media: {
    id: 'media', label: 'Media', title: 'Add photos',
    minutes: 2, required: true, postPublish: false,
  },
  goal: {
    id: 'goal', label: 'Goal', title: 'Set your goal',
    minutes: 1, required: true, postPublish: false,
  },
  rewards: {
    id: 'rewards', label: 'Rewards', title: 'Offer rewards (optional)',
    minutes: 2, required: false, postPublish: false,
  },
  payout: {
    id: 'payout', label: 'Get Paid', title: 'Where the money goes',
    minutes: 2, required: true, postPublish: false,
  },
  verify: {
    id: 'verify', label: 'Verify', title: 'Verification (optional)',
    minutes: 2, required: false, postPublish: false,
  },
  review: {
    id: 'review', label: 'Review', title: 'Check everything over',
    minutes: 1, required: true, postPublish: false,
  },
  publish: {
    id: 'publish', label: 'Publish', title: "You're live",
    minutes: 1, required: true, postPublish: true,
  },
  share: {
    id: 'share', label: 'Share', title: 'Get your first donors',
    minutes: 1, required: true, postPublish: true,
  },
};

/** Steps rendered inside the builder, i.e. everything before the campaign is live. */
export function builderSteps(): CampaignStep[] {
  return CAMPAIGN_STEPS.filter((s) => !CAMPAIGN_STEP_META[s].postPublish);
}

/** Steps an organizer may skip without blocking publication. */
export function optionalSteps(): CampaignStep[] {
  return CAMPAIGN_STEPS.filter((s) => !CAMPAIGN_STEP_META[s].required);
}

/** "Step 3 of 12" — 1-based, because it is announced to screen readers. */
export function stepPosition(step: CampaignStep): { index: number; total: number } {
  return { index: CAMPAIGN_STEPS.indexOf(step) + 1, total: CAMPAIGN_STEPS.length };
}

export function nextStep(step: CampaignStep): CampaignStep | null {
  const i = CAMPAIGN_STEPS.indexOf(step);
  return i >= 0 && i < CAMPAIGN_STEPS.length - 1 ? CAMPAIGN_STEPS[i + 1]! : null;
}

export function previousStep(step: CampaignStep): CampaignStep | null {
  const i = CAMPAIGN_STEPS.indexOf(step);
  return i > 0 ? CAMPAIGN_STEPS[i - 1]! : null;
}

/**
 * Whether the organizer may still go BACK from this step.
 *
 * Refused once the campaign is live: the URL is public by then and may already
 * be circulating, so reopening the builder would present a published campaign as
 * an unsaved draft. Edits after publication go through the dashboard.
 */
export function canGoBack(step: CampaignStep): boolean {
  if (CAMPAIGN_STEP_META[step].postPublish) return false;
  return previousStep(step) !== null;
}

/** Estimated minutes from this step to publication (post-publish steps excluded). */
export function minutesRemaining(step: CampaignStep): number {
  const idx = CAMPAIGN_STEPS.indexOf(step);
  if (idx < 0) return 0;
  return CAMPAIGN_STEPS.slice(idx)
    .filter((s) => !CAMPAIGN_STEP_META[s].postPublish)
    .reduce((total, s) => total + CAMPAIGN_STEP_META[s].minutes, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy draft migration.
//
// ⚠️ This is the part that breaks real users if it is wrong, and it breaks them
// silently. Drafts persist for 7 days in localStorage AND in
// `campaign_wizard_drafts` for signed-in organizers, so at the moment this ships
// there are people mid-draft holding step keys from EVERY earlier shape of this
// wizard. An unrecognised key renders no branch at all — a blank screen with
// their work apparently gone.
//
// Two generations have to keep working:
//   • the 9-step flow, whose 'type' / 'category' / 'location' merged into
//     'basics';
//   • the 7-step flow, whose 'summary' is now 'review' and whose terminal
//     'live' is now the 'publish' step.
// ─────────────────────────────────────────────────────────────────────────────

const LEGACY_STEP_MAP: Record<string, CampaignStep> = {
  // 9-step flow: three near-empty opening screens merged into one.
  type: 'basics',
  category: 'basics',
  location: 'basics',
  // 7-step flow: renamed for the 12-step model.
  summary: 'review',
  live: 'publish',
};

/**
 * Map a stored step value onto a step that still exists.
 *
 * Returns null when the value is unusable, so the caller can fall back to the
 * first step rather than render nothing.
 */
export function normalizeStep(raw: string | null | undefined): CampaignStep | null {
  if (!raw) return null;
  const legacy = LEGACY_STEP_MAP[raw];
  if (legacy) return legacy;
  return (CAMPAIGN_STEPS as readonly string[]).includes(raw) ? (raw as CampaignStep) : null;
}

/**
 * The step an organizer should land on given what they have already filled in.
 *
 * Used when resuming a draft whose stored step is missing or unusable: rather
 * than dumping them at step 1 to click through work they have already done,
 * resume at the first REQUIRED step that is still incomplete. Optional steps are
 * never treated as blocking, so an organizer who skipped rewards is not sent
 * back to them.
 */
export function firstIncompleteStep(
  completed: Partial<Record<CampaignStep, boolean>>,
): CampaignStep {
  for (const step of builderSteps()) {
    if (!CAMPAIGN_STEP_META[step].required) continue;
    if (!completed[step]) return step;
  }
  return 'review';
}
