// ─────────────────────────────────────────────────────────────────────────────
// F10 — donor-view readiness.
//
// The builder could tell an organizer whether a campaign was *valid*, but not
// whether it was *convincing*. This answers the only question that matters right
// before publishing: "if I were a donor landing on this page, would I give?"
//
// Every check reflects something a donor actually evaluates (is there a face to
// the story, do I know who the money helps, is the ask concrete). Pure, so it is
// fully unit-tested and can run on each keystroke without a round-trip.
// ─────────────────────────────────────────────────────────────────────────────

export interface DonorPreviewInput {
  title: string;
  description: string;
  goalCents: number;
  coverImageUrl: string;
  imageCount: number;
  forSelf: string;            // 'true' | 'false'
  beneficiaryName: string;
  category: string;
  country: string;
}

export interface DonorCheck {
  id: string;
  /** Written from the donor's point of view, not the system's. */
  label: string;
  passed: boolean;
  /** Why a donor cares — shown when the check fails. */
  why: string;
  /** Which wizard step fixes it. */
  step: 'basics' | 'story' | 'title' | 'goal' | 'media';
}

/** Story length a donor reads as "they actually explained this". */
export const STORY_CONVINCING_CHARS = 400;

export function evaluateDonorView(input: DonorPreviewInput): {
  checks: DonorCheck[];
  passedCount: number;
  total: number;
  /** 0..100 — how ready this reads to a donor, not whether it can publish. */
  confidence: number;
} {
  const story = input.description.trim();
  const checks: DonorCheck[] = [
    {
      id: 'cover',
      label: 'Has a cover photo',
      passed: Boolean(input.coverImageUrl) || input.imageCount > 0,
      why: 'Donors scroll past campaigns with no image — it is the first thing they see.',
      step: 'media',
    },
    {
      id: 'title',
      label: 'Title says what the money is for',
      passed: input.title.trim().length >= 15,
      why: 'A short or vague title makes donors guess. Name the person and the need.',
      step: 'title',
    },
    {
      id: 'story',
      label: 'Story explains the situation',
      passed: story.length >= STORY_CONVINCING_CHARS,
      why: `Around ${STORY_CONVINCING_CHARS} characters is where a story starts to feel complete rather than rushed.`,
      step: 'story',
    },
    {
      id: 'goal',
      label: 'Goal is set',
      passed: input.goalCents >= 100,
      why: 'Donors give more when they can see progress toward a specific number.',
      step: 'goal',
    },
    {
      id: 'beneficiary',
      label: 'Clear who the funds help',
      // Fundraising for yourself is self-evident; for someone else, name them.
      passed: input.forSelf === 'true' || input.beneficiaryName.trim().length > 0,
      why: 'When a campaign is for someone else, donors want to know who.',
      step: 'basics',
    },
    {
      id: 'multiple_photos',
      label: 'More than one photo',
      passed: input.imageCount >= 2,
      why: 'Extra photos are the cheapest trust signal there is — they show the story is real.',
      step: 'media',
    },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  return {
    checks,
    passedCount,
    total: checks.length,
    confidence: Math.round((passedCount / checks.length) * 100),
  };
}
