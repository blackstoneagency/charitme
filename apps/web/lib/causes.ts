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
  /** Short hero line under the title. Optional — the page omits it when absent. */
  tagline?: string;
  /**
   * The 2-3 sentence hero paragraph on the cause landing page. Longer than
   * `blurb`, which has to fit a card and a meta description.
   */
  intro?: string;
  /**
   * "How your support helps" — what a donation to this cause actually buys.
   *
   * Editorial copy, deliberately NOT data: it explains where money goes, which
   * is a claim about the cause rather than a measurement of it. Fabricated
   * *metrics* are the thing this repo refuses; explanatory copy is not that, as
   * long as it never states a number it has not measured.
   *
   * Optional, and per-cause. A generic version repeated across 20 causes would
   * be filler, so a cause with nothing specific to say shows nothing.
   */
  helps?: readonly { readonly title: string; readonly body: string; readonly icon?: HelpIcon }[];
  /** Heading and subline for the "real impact" band above the campaign list. */
  impactTitle?: string;
  impactBlurb?: string;
  /**
   * The closing band's heading and body.
   *
   * Optional: a cause with nothing specific to say falls back to the shared
   * `cl.cta_*` strings, which are translated. Overriding is therefore an
   * ENGLISH-ONLY choice, and deliberately reserved for the causes whose design
   * names a specific line ("Be part of their journey") rather than applied
   * everywhere — twenty untranslated headings would be a regression, not a
   * feature.
   */
  ctaTitle?: string;
  ctaBlurb?: string;
}

/**
 * The glyph beside a "how your support helps" card.
 *
 * A closed set rather than free-form SVG in the data: the icons are drawn once
 * in `HelpGlyph.tsx`, so a cause cannot introduce a one-off that then has to be
 * restyled separately when the card design changes. A card with no `icon` falls
 * back to the heart, which is why the field is optional.
 */
export type HelpIcon =
  | 'gear'
  | 'coach'
  | 'run'
  | 'community'
  | 'learn'
  | 'food'
  | 'home'
  | 'health'
  | 'hope';

/** The 8 shown under "Popular Causes" in the header dropdown. */
export const POPULAR_CAUSES: readonly Cause[] = [
  {
    slug: 'sports-youth',
    label: 'Sports & Youth',
    impactTitle: 'Real impact. Real champions.',
    impactBlurb: 'Thanks to supporters like you, young athletes achieve more every day.',
    blurb: 'Teams, clubs, and young athletes raising for gear, travel, and season fees.',
    intro: 'Every kid deserves the chance to play, grow, and dream big. Your support provides gear, coaching, mentorship, and safe spaces for young athletes to thrive on and off the field.',
    categories: ['Sports', 'Competition'],
    tagline: 'Building champions. Building futures.',
    ctaTitle: 'Be part of their journey',
    ctaBlurb: 'Your donation today helps young athletes dream bigger, work harder, and go further.',
    helps: [
      { title: 'Provide gear', icon: 'gear', body: 'Boots, kit and equipment, so cost is not the reason a kid sits out the season.' },
      { title: 'Fund coaching', icon: 'coach', body: 'Qualified coaches and mentors who build skill and confidence together.' },
      { title: 'Create opportunities', icon: 'run', body: 'League fees, travel and clinics that open doors beyond the local pitch.' },
      { title: 'Build community', icon: 'community', body: 'Clubs where teamwork, inclusion and belonging are the point, not a by-product.' },
      { title: 'Support beyond sport', icon: 'learn', body: 'Study support and life skills, because the season ends and the rest does not.' },
    ],
  },
  {
    slug: 'people-in-need',
    label: 'People in Need',
    impactTitle: 'Real impact. Real relief.',
    impactBlurb: 'Thanks to supporters like you, families get help the week they need it.',
    blurb: 'Direct help for individuals and families facing hardship.',
    tagline: 'Real help. Real people. Right now.',
    intro: 'Behind every campaign is a family facing a bill, a move, or a loss they did not plan for. Your support goes directly to the person who asked for it.',
    categories: ['Family', 'Wishes', 'Memorial'],
    helps: [
      { title: 'Fight hunger', icon: 'food', body: 'Groceries and meals for households choosing between food and rent this month.' },
      { title: 'Shelter and housing', icon: 'home', body: 'Deposits, arrears and emergency stays that keep a family off the street.' },
      { title: 'Health and care', icon: 'health', body: 'Treatment, medication and the travel it takes to get to an appointment.' },
      { title: 'Hope and dignity', icon: 'hope', body: 'Funeral costs, replacement essentials and the practical help that comes after a loss.' },
    ],
  },
  {
    slug: 'community-relief',
    label: 'Community & Relief',
    impactTitle: 'Real impact. Real neighbours.',
    impactBlurb: 'Thanks to supporters like you, communities recover faster together.',
    blurb: 'Neighbourhood projects and rapid response when disaster hits.',
    tagline: 'Neighbours first. Always.',
    intro: 'When a street floods or a community centre closes, the people nearest to it move first. Your support funds the response already under way.',
    categories: ['Community', 'Emergency'],
  },
  {
    slug: 'health-wellness',
    label: 'Health & Wellness',
    impactTitle: 'Real impact. Real recovery.',
    impactBlurb: 'Thanks to supporters like you, patients face treatment with less to worry about.',
    blurb: 'Treatment costs, recovery, and care for patients and their families.',
    tagline: 'Care should never depend on a balance.',
    intro: 'Treatment, recovery, and the costs that follow. Your support helps patients and families cover what insurance leaves behind.',
    categories: ['Medical'],
  },
  {
    slug: 'education',
    label: 'Education',
    impactTitle: 'Real impact. Real futures.',
    impactBlurb: 'Thanks to supporters like you, more students stay in the classroom.',
    blurb: 'Tuition, classrooms, supplies, and access to learning.',
    tagline: 'Every child. Every classroom.',
    intro: 'Tuition, supplies, and the basics a classroom runs on. Your support keeps students learning when funding falls short.',
    categories: ['Education'],
  },
  {
    slug: 'animals-planet',
    label: 'Animals & Planet',
    impactTitle: 'Real impact. Real sanctuary.',
    impactBlurb: 'Thanks to supporters like you, more animals are fed, treated and rehomed.',
    blurb: 'Rescue, shelter, conservation, and climate work.',
    tagline: 'Protecting what cannot ask.',
    intro: 'Shelters, rescues, habitats, and the people who keep them running. Your support pays for food, veterinary care, and land.',
    categories: ['Animal', 'Environment'],
  },
  {
    slug: 'arts-culture',
    label: 'Arts & Culture',
    impactTitle: 'Real impact. Real work.',
    impactBlurb: 'Thanks to supporters like you, more artists finish what they started.',
    blurb: 'Artists, performances, festivals, and creative projects.',
    tagline: 'Keep the work alive.',
    intro: 'Studios, stages, and the artists who fill them. Your support funds the work that no ticket price covers.',
    categories: ['Creative', 'Event'],
  },
  {
    slug: 'faith-belief',
    label: 'Faith & Belief',
    impactTitle: 'Real impact. Real service.',
    impactBlurb: 'Thanks to supporters like you, congregations reach further into their communities.',
    blurb: 'Congregations, missions, and faith-led community work.',
    tagline: 'Communities of care.',
    intro: 'Congregations, outreach, and the practical help that comes with them. Your support funds the work rather than the building.',
    categories: ['Faith'],
  },
];

/** The 12 shown under "All Causes" in the header dropdown. */
export const ALL_CAUSES_COLUMN: readonly Cause[] = [
  {
    slug: 'sports-recreation',
    label: 'Sports & Recreation',
    impactTitle: 'Real impact. Real teams.',
    impactBlurb: 'Thanks to supporters like you, more people get to keep playing.',
    blurb: 'Leagues, facilities, and equipment for players at every level.',
    tagline: 'Play is not a luxury.',
    intro: 'Teams, clubs, leagues, and the gear that makes them possible. Your support keeps people playing.',
    categories: ['Sports'],
  },
  {
    slug: 'youth-development',
    label: 'Youth Development',
    impactTitle: 'Real impact. Real potential.',
    impactBlurb: 'Thanks to supporters like you, young people get backing before they need rescuing.',
    blurb: 'Mentoring, after-school programmes, and scholarships for young people.',
    tagline: 'Backing young people, early.',
    intro: 'Mentoring, programmes, and opportunities that arrive before a young person needs rescuing. Your support funds what comes first.',
    categories: ['Education', 'Competition'],
    narrower: true,
  },
  {
    slug: 'food-hunger',
    label: 'Food & Hunger',
    impactTitle: 'Real impact. Real meals.',
    impactBlurb: 'Thanks to supporters like you, food reaches the people who need it this week.',
    blurb: 'Food banks, meal programmes, and emergency food relief.',
    tagline: 'No one should go without.',
    intro: 'Food banks, meal programmes, and emergency supplies. Your support puts food where it is needed this week.',
    categories: ['Community', 'Emergency'],
    narrower: true,
  },
  {
    slug: 'disaster-relief',
    label: 'Disaster Relief',
    impactTitle: 'Real impact. Real response.',
    impactBlurb: 'Thanks to supporters like you, help arrives while it still counts.',
    blurb: 'Immediate support after fires, floods, storms, and crises.',
    tagline: 'When every hour counts.',
    intro: 'Shelter, water, and supplies in the days after a disaster. Your support reaches the response while it is still moving.',
    categories: ['Emergency'],
  },
  {
    slug: 'mental-health',
    label: 'Mental Health',
    impactTitle: 'Real impact. Real support.',
    impactBlurb: 'Thanks to supporters like you, more people get care without waiting for a crisis.',
    blurb: 'Counselling, crisis support, and mental health treatment costs.',
    tagline: 'Support worth asking for.',
    intro: 'Counselling, crisis support, and treatment costs. Your support helps people get care without waiting for a crisis.',
    categories: ['Medical'],
    narrower: true,
  },
  {
    slug: 'medical-research',
    label: 'Medical Research',
    impactTitle: 'Real impact. Real answers.',
    impactBlurb: 'Thanks to supporters like you, research keeps moving between grants.',
    blurb: 'Studies, trials, and research into treatments and cures.',
    tagline: 'Funding the next answer.',
    intro: 'Trials, equipment, and the research that outlives a single diagnosis. Your support funds the work in progress.',
    categories: ['Medical'],
    narrower: true,
  },
  {
    slug: 'environment',
    label: 'Environment',
    impactTitle: 'Real impact. Real ground.',
    impactBlurb: 'Thanks to supporters like you, conservation work carries on where it matters.',
    blurb: 'Conservation, clean-up, and climate resilience projects.',
    tagline: 'One planet. No spare.',
    intro: 'Conservation, clean-up, and climate work run by people on the ground. Your support funds the labour, not the letterhead.',
    categories: ['Environment'],
  },
  {
    slug: 'veterans-military',
    label: 'Veterans & Military',
    impactTitle: 'Real impact. Real service returned.',
    impactBlurb: 'Thanks to supporters like you, veterans get what was promised.',
    blurb: 'Support for service members, veterans, and their families.',
    tagline: 'Owed, not given.',
    intro: 'Housing, treatment, and transition support for people who served. Your support covers what was promised and missed.',
    categories: ['Community', 'Family'],
    narrower: true,
  },
  {
    slug: 'human-rights',
    label: 'Human Rights',
    impactTitle: 'Real impact. Real dignity.',
    impactBlurb: 'Thanks to supporters like you, more people have someone in their corner.',
    blurb: 'Advocacy, legal aid, and organisations defending civil rights.',
    tagline: 'Dignity is not negotiable.',
    intro: 'Legal aid, advocacy, and protection for people at risk. Your support funds the case and the person behind it.',
    categories: ['Nonprofit'],
    narrower: true,
  },
  {
    slug: 'seniors-elderly',
    label: 'Seniors & Elderly',
    impactTitle: 'Real impact. Real company.',
    impactBlurb: 'Thanks to supporters like you, older people are less alone and better cared for.',
    blurb: 'Care, companionship, and dignity for older people.',
    tagline: 'Nobody ages out of mattering.',
    intro: 'Care costs, isolation, and the bills that outlast a pension. Your support reaches older people directly.',
    categories: ['Family', 'Medical'],
    narrower: true,
  },
  {
    slug: 'women-girls',
    label: 'Women & Girls',
    impactTitle: 'Real impact. Real equality.',
    impactBlurb: 'Thanks to supporters like you, more women and girls get a fair footing.',
    blurb: "Programmes advancing women's health, safety, and opportunity.",
    tagline: 'Equal footing, everywhere.',
    intro: 'Safety, health, education, and economic independence. Your support funds the programmes women and girls actually asked for.',
    categories: ['Nonprofit', 'Education'],
    narrower: true,
  },
  {
    slug: 'lgbtq-support',
    label: 'LGBTQ+ Support',
    impactTitle: 'Real impact. Real belonging.',
    impactBlurb: 'Thanks to supporters like you, more people find somewhere safe.',
    blurb: 'Community, safety, and healthcare for LGBTQ+ people.',
    tagline: 'Safe, seen, supported.',
    intro: 'Housing, healthcare, and community for LGBTQ+ people. Your support goes where acceptance is not yet a given.',
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
