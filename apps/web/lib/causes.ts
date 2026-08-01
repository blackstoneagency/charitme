// ─────────────────────────────────────────────────────────────────────────────
// Causes — the donor-facing vocabulary, mapped onto the campaign taxonomy.
//
// The design names 20 "causes" (Sports & Youth, People in Need, Mental Health…).
// The database has 18 `campaigns.category` values, and `CAMPAIGN_CATEGORIES` in
// `@shared/fees` is the single source of truth for those — three hand-maintained
// copies had already drifted once, so this file adds a MAP onto that list rather
// than a fourth copy of it. `causes.test.ts` fails if any `categories` entry
// here stops being a real campaign category.
//
// The two vocabularies are not the same shape, and pretending otherwise is the
// trap. A cause can be:
//
//   • exactly a category   — "Education" → Education
//   • a union of them      — "Animals & Planet" → Animal + Environment
//   • NARROWER than any    — "Mental Health" is a slice of Medical, and nothing
//                            in the schema records that slice
//
// That third case is why `narrower` exists. Campaigns are not tagged at that
// granularity, so a "Mental Health" page can only show Medical campaigns. It
// says so on the page instead of implying the filter is precise — otherwise
// Mental Health and Medical Research would render byte-identical result sets
// while each claiming to be a filtered view.
// ─────────────────────────────────────────────────────────────────────────────

import { CAMPAIGN_CATEGORIES, type CampaignCategory } from '@shared/fees';

export interface Cause {
  /** URL segment under /causes. Stable — these are linkable, indexable pages. */
  slug: string;
  /** Donor-facing name, exactly as the design writes it. */
  label: string;
  /** One line, used on the index cards and as the page meta description. */
  blurb: string;
  /** Campaign categories this cause draws from. Never empty. */
  categories: readonly CampaignCategory[];
  /**
   * True when the cause is a slice of its categories rather than equal to them.
   * The page discloses this; it must never be silently dropped.
   */
  narrower?: boolean;
}

/** The 8 shown under "Popular Causes" in the header dropdown. */
export const POPULAR_CAUSES: readonly Cause[] = [
  {
    slug: 'sports-youth',
    label: 'Sports & Youth',
    blurb: 'Teams, clubs, and young athletes raising for gear, travel, and season fees.',
    categories: ['Sports', 'Competition'],
  },
  {
    slug: 'people-in-need',
    label: 'People in Need',
    blurb: 'Direct help for individuals and families facing hardship.',
    categories: ['Family', 'Wishes', 'Memorial'],
  },
  {
    slug: 'community-relief',
    label: 'Community & Relief',
    blurb: 'Neighbourhood projects and rapid response when disaster hits.',
    categories: ['Community', 'Emergency'],
  },
  {
    slug: 'health-wellness',
    label: 'Health & Wellness',
    blurb: 'Treatment costs, recovery, and care for patients and their families.',
    categories: ['Medical'],
  },
  {
    slug: 'education',
    label: 'Education',
    blurb: 'Tuition, classrooms, supplies, and access to learning.',
    categories: ['Education'],
  },
  {
    slug: 'animals-planet',
    label: 'Animals & Planet',
    blurb: 'Rescue, shelter, conservation, and climate work.',
    categories: ['Animal', 'Environment'],
  },
  {
    slug: 'arts-culture',
    label: 'Arts & Culture',
    blurb: 'Artists, performances, festivals, and creative projects.',
    categories: ['Creative', 'Event'],
  },
  {
    slug: 'faith-belief',
    label: 'Faith & Belief',
    blurb: 'Congregations, missions, and faith-led community work.',
    categories: ['Faith'],
  },
];

/** The 12 shown under "All Causes" in the header dropdown. */
export const ALL_CAUSES_COLUMN: readonly Cause[] = [
  {
    slug: 'sports-recreation',
    label: 'Sports & Recreation',
    blurb: 'Leagues, facilities, and equipment for players at every level.',
    categories: ['Sports'],
  },
  {
    slug: 'youth-development',
    label: 'Youth Development',
    blurb: 'Mentoring, after-school programmes, and scholarships for young people.',
    categories: ['Education', 'Competition'],
    narrower: true,
  },
  {
    slug: 'food-hunger',
    label: 'Food & Hunger',
    blurb: 'Food banks, meal programmes, and emergency food relief.',
    categories: ['Community', 'Emergency'],
    narrower: true,
  },
  {
    slug: 'disaster-relief',
    label: 'Disaster Relief',
    blurb: 'Immediate support after fires, floods, storms, and crises.',
    categories: ['Emergency'],
  },
  {
    slug: 'mental-health',
    label: 'Mental Health',
    blurb: 'Counselling, crisis support, and mental health treatment costs.',
    categories: ['Medical'],
    narrower: true,
  },
  {
    slug: 'medical-research',
    label: 'Medical Research',
    blurb: 'Studies, trials, and research into treatments and cures.',
    categories: ['Medical'],
    narrower: true,
  },
  {
    slug: 'environment',
    label: 'Environment',
    blurb: 'Conservation, clean-up, and climate resilience projects.',
    categories: ['Environment'],
  },
  {
    slug: 'veterans-military',
    label: 'Veterans & Military',
    blurb: 'Support for service members, veterans, and their families.',
    categories: ['Community', 'Family'],
    narrower: true,
  },
  {
    slug: 'human-rights',
    label: 'Human Rights',
    blurb: 'Advocacy, legal aid, and organisations defending civil rights.',
    categories: ['Nonprofit'],
    narrower: true,
  },
  {
    slug: 'seniors-elderly',
    label: 'Seniors & Elderly',
    blurb: 'Care, companionship, and dignity for older people.',
    categories: ['Family', 'Medical'],
    narrower: true,
  },
  {
    slug: 'women-girls',
    label: 'Women & Girls',
    blurb: "Programmes advancing women's health, safety, and opportunity.",
    categories: ['Nonprofit', 'Education'],
    narrower: true,
  },
  {
    slug: 'lgbtq-support',
    label: 'LGBTQ+ Support',
    blurb: 'Community, safety, and healthcare for LGBTQ+ people.',
    categories: ['Nonprofit', 'Community'],
    narrower: true,
  },
];

/** Every cause, in the order the /causes index lists them. */
export const CAUSES: readonly Cause[] = [...POPULAR_CAUSES, ...ALL_CAUSES_COLUMN];

const BY_SLUG = new Map(CAUSES.map((c) => [c.slug, c]));

/** Look up a cause for a `/causes/[slug]` route. `undefined` → the page 404s. */
export function getCause(slug: string): Cause | undefined {
  return BY_SLUG.get(slug);
}

/**
 * Where a cause's "browse" link should point.
 *
 * `/campaigns` filters on a SINGLE `category`, so a multi-category cause cannot
 * be expressed as a query string without silently dropping the other categories.
 * Those keep their own page, which queries with `.in(...)`.
 */
export function causeBrowseHref(cause: Cause): string {
  return cause.categories.length === 1
    ? `/campaigns?category=${encodeURIComponent(cause.categories[0])}`
    : `/causes/${cause.slug}`;
}

/**
 * Categories with no cause pointing at them. Not used for rendering — it exists
 * so the test can report which parts of the taxonomy the nav leaves unreachable,
 * rather than that fact going unnoticed as categories are added.
 */
export function uncoveredCategories(): CampaignCategory[] {
  const covered = new Set(CAUSES.flatMap((c) => c.categories));
  return CAMPAIGN_CATEGORIES.filter((c) => !covered.has(c));
}
