// ─────────────────────────────────────────────────────────────────────────────
// Campaign creation — AI follow-up questions (pure, unit-testable).
//
// After the AI drafts a campaign, it can't infer a few human facts (who the money
// is for, the organizer's relationship, timing). This computes the ONE next
// unanswered question at a time, skipping anything the AI or the organizer's
// profile already filled. Every question is skippable ("I'm not sure"). Sibling
// UI: app/create/AiFollowUps.tsx.
// ─────────────────────────────────────────────────────────────────────────────

/** The subset of the wizard form the follow-up flow reads/writes. */
export interface FollowUpForm {
  forSelf: string;                 // '' | 'true' | 'false'
  beneficiaryName: string;
  beneficiaryRelationship: string;
  category: string;
  goal: string;                    // dollar string
  deadline: string;                // ISO date or ''
}

export type FollowUpKind = 'choice' | 'text' | 'money' | 'date';

export interface FollowUpQuestion {
  id: string;
  field: keyof FollowUpForm;
  question: string;
  help?: string;
  kind: FollowUpKind;
  options?: { value: string; label: string }[];
  /** A skippable question offers "I'm not sure" and moves on without an answer. */
  skippable: boolean;
  /** Value written when the user picks "I'm not sure" / skip (kept simple). */
  skipValue?: string;
}

const RELATIONSHIP_OPTIONS = [
  { value: 'Family member', label: 'Family member' },
  { value: 'Friend', label: 'Friend' },
  { value: 'Colleague', label: 'Colleague' },
  { value: 'Community member', label: 'Community member' },
  { value: 'Organization', label: 'An organization / nonprofit' },
  { value: 'Other', label: 'Other' },
];

const CATEGORY_OPTIONS = [
  'Medical', 'Memorial', 'Emergency', 'Nonprofit', 'Education', 'Animal',
  'Environment', 'Business', 'Community', 'Creative', 'Faith', 'Other',
].map((c) => ({ value: c, label: c }));

function has(v: string | undefined | null): boolean {
  return !!v && v.trim().length > 0;
}

function goalIsSet(goal: string): boolean {
  const n = Number.parseFloat(goal);
  return Number.isFinite(n) && n > 0;
}

/**
 * The full ordered follow-up plan for a form — questions whose answers are still
 * missing, in the order they should be asked. Answered/known fields are omitted,
 * and beneficiary details are only asked when the campaign is for someone else.
 */
export function followUpPlan(form: FollowUpForm): FollowUpQuestion[] {
  const plan: FollowUpQuestion[] = [];

  if (!has(form.forSelf)) {
    plan.push({
      id: 'for-self',
      field: 'forSelf',
      question: 'Who is this fundraiser for?',
      kind: 'choice',
      options: [
        { value: 'true', label: 'Myself' },
        { value: 'false', label: 'Someone else' },
      ],
      skippable: false,
    });
  }

  const forSomeoneElse = form.forSelf === 'false';
  if (forSomeoneElse && !has(form.beneficiaryName)) {
    plan.push({
      id: 'beneficiary-name',
      field: 'beneficiaryName',
      question: 'Who are you raising funds for?',
      help: 'A first name is fine — this shows on the campaign.',
      kind: 'text',
      skippable: true,
    });
  }
  if (forSomeoneElse && !has(form.beneficiaryRelationship)) {
    plan.push({
      id: 'relationship',
      field: 'beneficiaryRelationship',
      question: 'What is your relationship to them?',
      kind: 'choice',
      options: RELATIONSHIP_OPTIONS,
      skippable: true,
    });
  }

  if (!has(form.category)) {
    plan.push({
      id: 'category',
      field: 'category',
      question: 'What kind of campaign is this?',
      kind: 'choice',
      options: CATEGORY_OPTIONS,
      skippable: false,
    });
  }

  if (!goalIsSet(form.goal)) {
    plan.push({
      id: 'goal',
      field: 'goal',
      question: 'How much do you need to raise?',
      help: 'A rough estimate is fine — you can change it anytime.',
      kind: 'money',
      skippable: false,
    });
  }

  if (!has(form.deadline)) {
    plan.push({
      id: 'deadline',
      field: 'deadline',
      question: 'Is there a date you need the funds by?',
      help: 'Optional — many campaigns run without a deadline.',
      kind: 'date',
      skippable: true,
      skipValue: '',
    });
  }

  return plan;
}

/** The single next unanswered follow-up, or null when nothing is left to ask. */
export function nextFollowUp(form: FollowUpForm): FollowUpQuestion | null {
  return followUpPlan(form)[0] ?? null;
}

/** How many follow-ups remain — for progress display. */
export function remainingFollowUps(form: FollowUpForm): number {
  return followUpPlan(form).length;
}
