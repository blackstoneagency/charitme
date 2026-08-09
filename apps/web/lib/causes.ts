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
  /**
   * Short hero line under the title. Optional — the page omits it when absent.
   *
   * Also omitted when `heroTitle` is set: that cause already leads with a
   * slogan, and a slogan under a slogan reads as filler. It is still REQUIRED of
   * every cause (and required to be unique) because the tests use it as the
   * "this cause has authored copy" signal — so on People in Need it is currently
   * carried but not rendered. Deliberate, not an oversight.
   */
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
  /**
   * A slogan to use as the H1 instead of the cause name.
   *
   * ⚠️ This exists because the two design references DISAGREE, and each is right
   * about its own page: Sports & Youth heads with the cause name and a tagline
   * beneath, People in Need heads with "Hope changes everything." over a small
   * cause-name eyebrow.
   *
   * The original rule — H1 is the cause name — was written against a draft that
   * put ONE slogan in all twenty H1s, so twenty pages competed for the same
   * heading in search. A per-cause slogan is not that, and
   * `cause-landing.test.ts` enforces the part that actually mattered: every
   * `heroTitle` must be distinct, and the cause name still renders (as the
   * eyebrow) so the page is still findable by it.
   *
   * When set, the tagline is not rendered — the reference puts the lede directly
   * under the slogan, and a slogan followed by a second slogan reads as filler.
   */
  heroTitle?: string;
  /**
   * Which card floats in the hero.
   *
   * `support` (default) is the one-line "your support changes everything" card.
   * `programs` is the taller list the People in Need reference draws — see
   * `programs` below. A cause that declares none keeps the support card.
   */
  heroCard?: 'support' | 'programs';
  /**
   * Rows for the hero's `programs` card.
   *
   * Deliberately NOT the same list as `helps`, even though the two look alike:
   * the reference gives the hero card four broad programme areas and the
   * mid-page grid four ways to give, and they name different things. Collapsing
   * them into one list would print the same four items twice on one page.
   *
   * Editorial, like `helps` — a claim about what the cause funds, never a count.
   */
  programs?: readonly { readonly title: string; readonly body: string; readonly icon: HelpIcon }[];
  /** Heading over the helps grid. Defaults to "How your support helps". */
  helpsTitle?: string;
  /**
   * `center` (default) matches the Sports & Youth reference; `start` matches
   * People in Need, which left-aligns the heading and gives each card a link.
   */
  helpsAlign?: 'center' | 'start';
  /**
   * Link label on each helps card, e.g. "Help now". Omitted by default: a card
   * that is purely explanatory should not grow an affordance.
   *
   * All four point at the same place — this cause's campaigns — which is what
   * the reference does and what the label honestly means. It is not a per-card
   * filter, because `helps` are editorial groupings and nothing in the schema
   * tags a campaign as "shelter" rather than "food".
   */
  helpsCta?: string;
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
  | 'hope'
  // Added for Health & Wellness. Reusing the sports glyphs there would have put
  // a whistle beside "keep prescriptions filled" — the exact failure the note on
  // `HelpGlyph` describes, where identical or unrelated shapes leave colour
  // doing work colour cannot do alone.
  | 'meds'
  | 'travel'
  // Added when the remaining 17 causes were built out. Same reasoning as above,
  // at scale: each cause needs FIVE distinct glyphs, and without these the grid
  // would have fallen back to a mortarboard beside "clean water" and a whistle
  // beside "legal aid". A closed union is what keeps that from becoming
  // free-form SVG scattered through the data.
  | 'tools'
  | 'book'
  | 'laptop'
  | 'paw'
  | 'palette'
  | 'music'
  | 'medal'
  | 'water'
  | 'phone'
  | 'mind'
  | 'flask'
  | 'scales'
  | 'shield'
  | 'briefcase'
  // Added for the /success-stories category strip, which needs an "everything"
  // affordance and a nature glyph the cause helps never called for.
  | 'all'
  | 'leaf';

/** The 8 shown under "Popular Causes" in the header dropdown. */
export const POPULAR_CAUSES: readonly Cause[] = [
  {
    slug: 'sports-youth',
    label: 'Sports & Youth',
    impactTitle: 'Real Impact. Real Champions.',
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
    impactTitle: 'Real Impact. Real Relief.',
    blurb: 'Direct help for individuals and families facing hardship.',
    tagline: 'Real help. Real people. Right now.',
    heroTitle: 'Hope changes everything.',
    heroCard: 'programs',
    helpsTitle: 'Ways You Can Help',
    helpsAlign: 'start',
    helpsCta: 'Help now',
    ctaTitle: 'Hope, delivered as something practical',
    ctaBlurb: 'Your donation becomes a meal, a deposit or a bill paid — the specific things that stop a hard month becoming a lost year.',
    intro: 'Millions of people face hunger, homelessness, poverty, and crisis every day. Your support brings hope, healing, and a better tomorrow.',
    categories: ['Family', 'Wishes', 'Memorial'],
    programs: [
      { title: 'Provide food', icon: 'food', body: 'Help families put meals on the table.' },
      { title: 'Safe shelter', icon: 'home', body: 'Give a safe place to sleep and rebuild.' },
      { title: 'Emergency aid', icon: 'health', body: 'Deliver urgent help when it is needed most.' },
      { title: 'Long-term support', icon: 'hope', body: 'Create lasting change through care and resources.' },
    ],
    helps: [
      { title: 'Fight hunger', icon: 'food', body: 'Provide nutritious meals to those who need it most.' },
      { title: 'Shelter & housing', icon: 'home', body: 'Help families find safety, stability, and a place to call home.' },
      { title: 'Health & care', icon: 'health', body: 'Support healthcare, mental health, and essential services.' },
      { title: 'Hope & dignity', icon: 'hope', body: 'Empower people to rebuild their lives with dignity.' },
    ],
  },
  {
    slug: 'community-relief',
    label: 'Community & Relief',
    impactTitle: 'Real Impact. Real Neighbours.',
    blurb: 'Neighbourhood projects and rapid response when disaster hits.',
    tagline: 'Neighbours first. Always.',
    intro: 'When a street floods or a community centre closes, the people nearest to it move first. Your support funds the response already under way.',
    categories: ['Community', 'Emergency'],
    ctaTitle: 'Back the people who got there first',
    ctaBlurb: 'Your donation reaches a response that is already moving, run by the neighbours who started it.',
    helps: [
      { title: 'Answer the first hours', icon: 'travel', body: 'Fuel, hire and supplies for the volunteers who reach a street before any convoy does.' },
      { title: 'Keep people fed', icon: 'food', body: 'Hot meals and pantry stock for households cut off from the shops they rely on.' },
      { title: 'Reopen the doors', icon: 'tools', body: 'Repairs to the hall, the kitchen or the centre that a neighbourhood organises from.' },
      { title: 'Somewhere to sleep', icon: 'home', body: 'Emergency beds and bedding when a home becomes unsafe with no notice.' },
      { title: 'Hold the street together', icon: 'community', body: 'The coordination, insurance and training that keep a volunteer effort running.' },
    ],
  },
  {
    slug: 'health-wellness',
    label: 'Health & Wellness',
    impactTitle: 'Real Impact. Real Recovery.',
    blurb: 'Treatment costs, recovery, and care for patients and their families.',
    tagline: 'Care should never depend on a balance.',
    intro: 'Treatment, recovery, and the costs that follow. Your support helps patients and families cover what insurance leaves behind.',
    categories: ['Medical'],
    ctaTitle: 'Help someone get through treatment',
    ctaBlurb: 'Your donation today covers the bills, the journeys and the aftercare that a diagnosis does not come with.',
    helps: [
      { title: 'Cover treatment costs', icon: 'health', body: 'Surgery, therapy and the balance a policy leaves for the patient to find.' },
      { title: 'Keep prescriptions filled', icon: 'meds', body: 'Medication and supplies, so a course of treatment is not rationed to make it last.' },
      { title: 'Get patients to care', icon: 'travel', body: 'Fuel, fares and lodging for appointments that are nowhere near home.' },
      { title: 'Adapt the home', icon: 'home', body: 'Ramps, rails and equipment fitted for a discharge date, not months after it.' },
      { title: 'Support the whole family', icon: 'community', body: 'Lost income, childcare and the household bills that do not pause for illness.' },
    ],
  },
  {
    slug: 'education',
    label: 'Education',
    impactTitle: 'Real Impact. Real Futures.',
    blurb: 'Tuition, classrooms, supplies, and access to learning.',
    tagline: 'Every child. Every classroom.',
    intro: 'Tuition, supplies, and the basics a classroom runs on. Your support keeps students learning when funding falls short.',
    categories: ['Education'],
    ctaTitle: 'Keep a student in the room',
    ctaBlurb: 'Your donation covers the fees, the kit and the journey that decide whether a place is taken up.',
    helps: [
      { title: 'Cover fees and places', icon: 'learn', body: 'Tuition and enrolment costs, so a place is not lost over a bill that arrives at the wrong time.' },
      { title: 'Stock the classroom', icon: 'book', body: 'Books, paper and the everyday supplies a teacher currently buys out of their own pay.' },
      { title: 'Close the digital gap', icon: 'laptop', body: 'Devices and connectivity for pupils expected to submit work they cannot get online to send.' },
      { title: 'Get pupils there', icon: 'travel', body: 'Fares and transport that turn a long walk into an attendance record worth having.' },
      { title: 'Feed the school day', icon: 'food', body: 'Breakfast and lunch provision, because a hungry morning undoes the teaching that follows.' },
    ],
  },
  {
    slug: 'animals-planet',
    label: 'Animals & Planet',
    impactTitle: 'Real Impact. Real Sanctuary.',
    blurb: 'Rescue, shelter, conservation, and climate work.',
    tagline: 'Protecting what cannot ask.',
    intro: 'Shelters, rescues, habitats, and the people who keep them running. Your support pays for food, veterinary care, and land.',
    categories: ['Animal', 'Environment'],
    ctaTitle: 'Speak for the ones who cannot ask',
    ctaBlurb: 'Your donation pays for the feed, the veterinary bill and the land that a rescue cannot fundraise its way around twice.',
    helps: [
      { title: 'Feed and shelter', icon: 'paw', body: 'Food, bedding and warm space for animals arriving faster than a rescue can place them.' },
      { title: 'Pay the vet', icon: 'health', body: 'Treatment, surgery and neutering — the cost that closes small rescues more than any other.' },
      { title: 'Keep the doors open', icon: 'home', body: 'Rent, power and the licence fees a sanctuary needs before it can take a single animal.' },
      { title: 'Protect the habitat', icon: 'leaf', body: 'Planting, fencing and land management that give wildlife somewhere to return to.' },
      { title: 'Clean the water', icon: 'water', body: 'River and coastal clean-up, because the animals downstream live in what we leave.' },
    ],
  },
  {
    slug: 'arts-culture',
    label: 'Arts & Culture',
    impactTitle: 'Real Impact. Real Work.',
    blurb: 'Artists, performances, festivals, and creative projects.',
    tagline: 'Keep the work alive.',
    intro: 'Studios, stages, and the artists who fill them. Your support funds the work that no ticket price covers.',
    categories: ['Creative', 'Event'],
    ctaTitle: 'Pay for the part nobody sees',
    ctaBlurb: 'Your donation covers the rehearsal, the rent and the materials that happen long before a ticket is ever sold.',
    helps: [
      { title: 'Fund the making', icon: 'palette', body: 'Materials, commissions and the studio time that turns an idea into finished work.' },
      { title: 'Keep the stage lit', icon: 'music', body: 'Rehearsal space, sound and the running costs a box office never fully covers.' },
      { title: 'Hold onto the space', icon: 'home', body: 'Rent and repairs for the venues and studios a city keeps pricing artists out of.' },
      { title: 'Open it to everyone', icon: 'community', body: 'Free and pay-what-you-can places, so cost is not what decides who gets in the room.' },
      { title: 'Pass the craft on', icon: 'learn', body: 'Workshops and apprenticeships that teach the skills a recording cannot.' },
    ],
  },
  {
    slug: 'faith-belief',
    label: 'Faith & Belief',
    impactTitle: 'Real Impact. Real Service.',
    blurb: 'Congregations, missions, and faith-led community work.',
    tagline: 'Communities of care.',
    intro: 'Congregations, outreach, and the practical help that comes with them. Your support funds the work rather than the building.',
    categories: ['Faith'],
    ctaTitle: 'Fund the work, not the letterhead',
    ctaBlurb: 'Your donation goes to the kitchen, the night shelter and the advice desk — the parts of a congregation that serve people who never attend it.',
    helps: [
      { title: 'Serve the meal', icon: 'food', body: 'Community kitchens that ask no questions and turn nobody away at the door.' },
      { title: 'Open the night shelter', icon: 'home', body: 'Beds through the cold months, rotated across congregations that share the load.' },
      { title: 'Sit with people', icon: 'phone', body: 'Pastoral visits, bereavement support and the call that comes when nobody else does.' },
      { title: 'Give practical advice', icon: 'scales', body: 'Debt, housing and paperwork help from trained volunteers, free at the point of asking.' },
      { title: 'Keep the hall usable', icon: 'tools', body: 'Roof, heating and access repairs for a building the whole neighbourhood books.' },
    ],
  },
];

/** The 12 shown under "All Causes" in the header dropdown. */
export const ALL_CAUSES_COLUMN: readonly Cause[] = [
  {
    slug: 'sports-recreation',
    label: 'Sports & Recreation',
    impactTitle: 'Real Impact. Real Teams.',
    blurb: 'Leagues, facilities, and equipment for players at every level.',
    tagline: 'Play is not a luxury.',
    intro: 'Teams, clubs, leagues, and the gear that makes them possible. Your support keeps people playing.',
    categories: ['Sports'],
    ctaTitle: 'Keep the fixture on',
    ctaBlurb: 'Your donation pays the subs, the pitch fee and the repair bill that decide whether a club makes it to next season.',
    helps: [
      { title: 'Kit the squad', icon: 'gear', body: 'Boots, strips and equipment, replaced on the schedule they actually wear out on.' },
      { title: 'Pay the pitch fee', icon: 'medal', body: 'League entry, referees and hire charges that fall due before any subs come in.' },
      { title: 'Fix the ground', icon: 'tools', body: 'Drainage, floodlights and changing rooms — the repairs that quietly cancel Saturdays.' },
      { title: 'Travel to play', icon: 'travel', body: 'Coach hire and away-day costs for squads currently funding their own fixtures.' },
      { title: 'Open it to more players', icon: 'community', body: 'Adaptive sessions and reduced subs, so the team reflects the place it plays in.' },
    ],
  },
  {
    slug: 'youth-development',
    label: 'Youth Development',
    impactTitle: 'Real Impact. Real Potential.',
    blurb: 'Mentoring, after-school programmes, and scholarships for young people.',
    tagline: 'Backing young people, early.',
    intro: 'Mentoring, programmes, and opportunities that arrive before a young person needs rescuing. Your support funds what comes first.',
    categories: ['Education', 'Competition'],
    narrower: true,
    ctaTitle: 'Arrive before the crisis does',
    ctaBlurb: 'Your donation funds the hour a week, the placement and the safe room that stop a hard year becoming a lost one.',
    helps: [
      { title: 'Match a mentor', icon: 'coach', body: 'Recruitment, training and checks for the adults who show up week after week.' },
      { title: 'Fill the hours after school', icon: 'community', body: 'Clubs and holiday provision in towns where the youth centre has already closed.' },
      { title: 'Build employable skills', icon: 'briefcase', body: 'Placements, references and interview practice for young people leaving care.' },
      { title: 'Put tools in their hands', icon: 'laptop', body: 'Laptops, instruments and kit for a first serious attempt at something.' },
      { title: 'Back what they are good at', icon: 'medal', body: 'Entry fees and travel for competitions that a household budget rules out.' },
    ],
  },
  {
    slug: 'food-hunger',
    label: 'Food & Hunger',
    impactTitle: 'Real Impact. Real Meals.',
    blurb: 'Food banks, meal programmes, and emergency food relief.',
    tagline: 'No one should go without.',
    intro: 'Food banks, meal programmes, and emergency supplies. Your support puts food where it is needed this week.',
    categories: ['Community', 'Emergency'],
    narrower: true,
    ctaTitle: 'Fill the shelves this week',
    ctaBlurb: 'Your donation buys stock, fuel and cold storage for a service that cannot ask people to come back later.',
    helps: [
      { title: 'Stock the food bank', icon: 'food', body: 'Bulk staples bought when donations dip and demand does not.' },
      { title: 'Cook and serve', icon: 'home', body: 'Community kitchens through school holidays, when a free lunch disappears for six weeks.' },
      { title: 'Reach further out', icon: 'travel', body: 'Van costs and deliveries to villages and estates the nearest centre cannot serve.' },
      { title: 'Rescue the surplus', icon: 'leaf', body: 'Chilling, storage and collection that turn supermarket waste into meals.' },
      { title: 'Keep it dignified', icon: 'community', body: 'Choice-based shopping models rather than a parcel someone else packed.' },
    ],
  },
  {
    slug: 'disaster-relief',
    label: 'Disaster Relief',
    impactTitle: 'Real Impact. Real Response.',
    blurb: 'Immediate support after fires, floods, storms, and crises.',
    tagline: 'When every hour counts.',
    intro: 'Shelter, water, and supplies in the days after a disaster. Your support reaches the response while it is still moving.',
    categories: ['Emergency'],
    ctaTitle: 'Give while it still changes the outcome',
    ctaBlurb: 'Your donation reaches the days when shelter, water and medicine decide how bad this gets — and the months after the cameras leave.',
    helps: [
      { title: 'Shelter tonight', icon: 'home', body: 'Tents, tarpaulins and bedding for households displaced in a single evening.' },
      { title: 'Make the water safe', icon: 'water', body: 'Filtration and sanitation that stop an outbreak following the flood in.' },
      { title: 'Treat the injured', icon: 'health', body: 'Field medicine and supplies while local services are still cut off or overwhelmed.' },
      { title: 'Move it to where it is needed', icon: 'travel', body: 'Fuel, vehicles and road clearance — aid in a warehouse helps nobody.' },
      { title: 'Stay for the rebuild', icon: 'tools', body: 'Repairs and reconstruction in the months after the headlines have moved on.' },
    ],
  },
  {
    slug: 'mental-health',
    label: 'Mental Health',
    impactTitle: 'Real Impact. Real Support.',
    blurb: 'Counselling, crisis support, and mental health treatment costs.',
    tagline: 'Support worth asking for.',
    intro: 'Counselling, crisis support, and treatment costs. Your support helps people get care without waiting for a crisis.',
    categories: ['Medical'],
    narrower: true,
    ctaTitle: 'Make help available before the crisis',
    ctaBlurb: 'Your donation pays for the session, the staffed line and the room that let someone ask for help while asking is still easy.',
    helps: [
      { title: 'Fund the sessions', icon: 'mind', body: 'Counselling for people the waiting list has priced out of getting better this year.' },
      { title: 'Keep the line staffed', icon: 'phone', body: 'Overnight crisis cover, because the hardest hours are the ones with fewest volunteers.' },
      { title: 'Reach people early', icon: 'learn', body: 'School and workplace support that arrives before a crisis makes the introduction.' },
      { title: 'Somewhere to turn up', icon: 'community', body: 'Peer groups and drop-ins where the conversation happens without a referral.' },
      { title: 'Back to work gently', icon: 'briefcase', body: 'Supported returns after long absence, at a pace that does not undo the recovery.' },
    ],
  },
  {
    slug: 'medical-research',
    label: 'Medical Research',
    impactTitle: 'Real Impact. Real Answers.',
    blurb: 'Studies, trials, and research into treatments and cures.',
    tagline: 'Funding the next answer.',
    intro: 'Trials, equipment, and the research that outlives a single diagnosis. Your support funds the work in progress.',
    categories: ['Medical'],
    narrower: true,
    ctaTitle: 'Fund the question nobody else will',
    ctaBlurb: 'Your donation keeps a line of work alive between grants, and pays for the equipment a budget line never quite reaches.',
    helps: [
      { title: 'Bridge the funding gap', icon: 'flask', body: 'Salaries between grants, so years of work do not stop while a decision is pending.' },
      { title: 'Replace failing equipment', icon: 'meds', body: 'Freezers, analysers and consumables that a single failure can take a decade of samples with.' },
      { title: 'Open trials to more people', icon: 'travel', body: 'Travel and accommodation, so taking part is not limited to those who live nearby.' },
      { title: 'Study the rare and unfunded', icon: 'health', body: 'Early work on conditions too uncommon to attract a large grant.' },
      { title: 'Publish what was learned', icon: 'book', body: 'Open access and data sharing that let other labs skip a dead end.' },
    ],
  },
  {
    slug: 'environment',
    label: 'Environment',
    impactTitle: 'Real Impact. Real Ground.',
    blurb: 'Conservation, clean-up, and climate resilience projects.',
    tagline: 'One planet. No spare.',
    intro: 'Conservation, clean-up, and climate work run by people on the ground. Your support funds the labour, not the letterhead.',
    categories: ['Environment'],
    ctaTitle: 'Put it back, hectare by hectare',
    ctaBlurb: 'Your donation pays for the planting, the clean-up and the years of maintenance that decide whether any of it survives.',
    helps: [
      { title: 'Plant and protect', icon: 'leaf', body: 'Trees, hedgerows and the fencing and watering that decide whether they survive year two.' },
      { title: 'Clean the water', icon: 'water', body: 'River and coastal clear-up, plus the monitoring that shows whether it worked.' },
      { title: 'Cut what a building burns', icon: 'tools', body: 'Insulation and solar on halls and centres, with the savings staying in the community.' },
      { title: 'Measure it honestly', icon: 'flask', body: 'Surveys and baseline data, because restoration without measurement is just gardening.' },
      { title: 'Get people out there', icon: 'community', body: 'Volunteer days, tools and training — most of this work is done by hand.' },
    ],
  },
  {
    slug: 'veterans-military',
    label: 'Veterans & Military',
    impactTitle: 'Real Impact. Real Service returned.',
    blurb: 'Support for service members, veterans, and their families.',
    tagline: 'Owed, not given.',
    intro: 'Housing, treatment, and transition support for people who served. Your support covers what was promised and missed.',
    categories: ['Community', 'Family'],
    narrower: true,
    ctaTitle: 'Close the gap between promised and delivered',
    ctaBlurb: 'Your donation covers housing, treatment and the practical help that a discharge date does not come with.',
    helps: [
      { title: 'Keys, not a waiting list', icon: 'home', body: 'Deposits, rent guarantees and housing casework for veterans sleeping rough.' },
      { title: 'Treatment that fits', icon: 'mind', body: 'Trauma and addiction support from people who understand what service does.' },
      { title: 'Translate the service record', icon: 'briefcase', body: 'Turning military experience into civilian qualifications and job offers.' },
      { title: 'Adapt the home', icon: 'tools', body: 'Modifications that let a wounded veteran live independently rather than in care.' },
      { title: 'Support the family too', icon: 'community', body: 'Spouses and children carry the discharge as well, and are rarely funded for it.' },
    ],
  },
  {
    slug: 'human-rights',
    label: 'Human Rights',
    impactTitle: 'Real Impact. Real Dignity.',
    blurb: 'Advocacy, legal aid, and organisations defending civil rights.',
    tagline: 'Dignity is not negotiable.',
    intro: 'Legal aid, advocacy, and protection for people at risk. Your support funds the case and the person behind it.',
    categories: ['Nonprofit'],
    narrower: true,
    ctaTitle: 'Put someone in the room with them',
    ctaBlurb: 'Your donation pays for representation, evidence and safety — the difference between a right existing and a right being usable.',
    helps: [
      { title: 'Fund representation', icon: 'scales', body: 'Lawyers for people facing decisions they have no means to contest alone.' },
      { title: 'Get people to safety', icon: 'shield', body: 'Emergency relocation and protection for those at immediate risk of harm.' },
      { title: 'Document what happened', icon: 'book', body: 'Evidence-gathering that makes an inquiry harder to dismiss later.' },
      { title: 'Explain the rights', icon: 'learn', body: 'Plain-language guides in the languages the people affected actually read.' },
      { title: 'Change the rule, not just the case', icon: 'community', body: 'Advocacy that turns one household’s appeal into guidance for everyone behind them.' },
    ],
  },
  {
    slug: 'seniors-elderly',
    label: 'Seniors & Elderly',
    impactTitle: 'Real Impact. Real Company.',
    blurb: 'Care, companionship, and dignity for older people.',
    tagline: 'Nobody ages out of mattering.',
    intro: 'Care costs, isolation, and the bills that outlast a pension. Your support reaches older people directly.',
    categories: ['Family', 'Medical'],
    narrower: true,
    ctaTitle: 'Nobody should see out the week alone',
    ctaBlurb: 'Your donation pays for the call, the warm room and the small repair that let someone stay in their own home.',
    helps: [
      { title: 'Make the weekly call', icon: 'phone', body: 'Befriending schemes that are, for many people, the only conversation of the week.' },
      { title: 'Heat the room', icon: 'home', body: 'Energy costs for households choosing between the meter and the shopping.' },
      { title: 'Do the small repairs', icon: 'tools', body: 'Rails, bulbs and door locks — the jobs that decide whether staying home is safe.' },
      { title: 'Get to the shops', icon: 'travel', body: 'Minibuses and lifts that end isolation where the bus route was withdrawn.' },
      { title: 'Keep the lunch club going', icon: 'food', body: 'A hot meal and company, run by volunteers on a budget that barely covers the room.' },
    ],
  },
  {
    slug: 'women-girls',
    label: 'Women & Girls',
    impactTitle: 'Real Impact. Real Equality.',
    blurb: "Programmes advancing women's health, safety, and opportunity.",
    tagline: 'Equal footing, everywhere.',
    intro: 'Safety, health, education, and economic independence. Your support funds the programmes women and girls actually asked for.',
    categories: ['Nonprofit', 'Education'],
    narrower: true,
    ctaTitle: 'Fund the exit and what comes after it',
    ctaBlurb: 'Your donation pays for the refuge place, the childcare and the loan that turn leaving into staying gone.',
    helps: [
      { title: 'Make room at the refuge', icon: 'shield', body: 'Family spaces in services currently turning women away every week.' },
      { title: 'Finish the qualification', icon: 'learn', body: 'Childcare and fees for mothers who stopped one term short of the certificate.' },
      { title: 'Start the business', icon: 'briefcase', body: 'Microloans and mentoring for women locked out of ordinary credit.' },
      { title: 'Health without the queue', icon: 'health', body: 'Maternal, reproductive and screening services where provision is thinnest.' },
      { title: 'Legal help, quickly', icon: 'scales', body: 'Emergency orders obtained in days rather than in the months a court list takes.' },
    ],
  },
  {
    slug: 'lgbtq-support',
    label: 'LGBTQ+ Support',
    impactTitle: 'Real Impact. Real Belonging.',
    blurb: 'Community, safety, and healthcare for LGBTQ+ people.',
    tagline: 'Safe, seen, supported.',
    intro: 'Housing, healthcare, and community for LGBTQ+ people. Your support goes where acceptance is not yet a given.',
    categories: ['Nonprofit', 'Community'],
    narrower: true,
    ctaTitle: 'Somewhere to go, and someone expecting you',
    ctaBlurb: 'Your donation funds housing, affirming healthcare and the room on a Friday night that a young person has nowhere else to be.',
    helps: [
      { title: 'Housing after rejection', icon: 'home', body: 'Emergency accommodation for young people made homeless by their own families.' },
      { title: 'Care without explaining', icon: 'health', body: 'Affirming clinical services in regions that currently offer none at all.' },
      { title: 'Keep the group running', icon: 'community', body: 'Room hire, staffing and safeguarding for the meet-up that is the whole week for some.' },
      { title: 'Safety when it is needed', icon: 'shield', body: 'Crisis support and protection for people facing harassment or worse at home.' },
      { title: 'Older and out', icon: 'phone', body: 'Support for LGBTQ+ elders facing care and isolation without family around them.' },
    ],
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
 * The cause's own landing page — where a link ABOUT a cause should point.
 *
 * Use this for navigation: the mega-menu, the search results, anywhere the
 * label is the cause's name. Every cause has one of these pages and they are
 * all statically generated, so there is never a reason to send a visitor
 * somewhere else when they click the cause's name.
 */
export function causePageHref(cause: Cause): string {
  return `/causes/${cause.slug}`;
}

/**
 * Where a cause's "browse the campaigns" link should point.
 *
 * ⚠️ This used to branch on the number of categories: one category went to
 * `/campaigns?category=…` and several went to `/causes/<slug>`. Both halves of
 * that were wrong once cause pages became real pages, and each broke a
 * different thing — measured in a browser, not argued:
 *
 *   · **Single-category causes never reached their own page.** Clicking
 *     "Health & Wellness" or "Education" in the mega-menu landed on the
 *     campaigns list. Nine of the twenty causes were unreachable that way, so
 *     the pages existed and nothing linked to them.
 *
 *   · **Multi-category causes self-linked.** On the eleven of them, the hero's
 *     "Donate now" AND the closing band's went to `/causes/<slug>` — the page
 *     the visitor was already on. The primary call to action did nothing. The
 *     helps grid had already been patched around this by hardcoding the right
 *     href; the two buttons had not.
 *
 * `?cause=` fixes both without a branch: `/campaigns` resolves the slug to the
 * cause's categories and queries with `.in(...)`, so nothing is dropped for a
 * multi-category cause and nothing self-links for any cause.
 */
export function causeBrowseHref(cause: Cause): string {
  return `/campaigns?cause=${encodeURIComponent(cause.slug)}`;
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
