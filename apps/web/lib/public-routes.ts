import { CAUSES } from './causes';

export type SitemapFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

export type PublicRoute = {
  path: string;
  title: string;
  description: string;
  priority: number;
  changeFrequency: SitemapFrequency;
};

export const CHARITME_ORIGIN = 'https://www.charitme.com';

/**
 * The site-wide social preview, from `app/opengraph-image.tsx`.
 *
 * ⚠️ Needed EXPLICITLY by any page that declares `openGraph`, because doing so
 * suppresses the file-convention image Next would otherwise attach. Nine pages
 * shipped without one and rendered as blank cards when shared.
 */
export const DEFAULT_OG_IMAGE = `${CHARITME_ORIGIN}/opengraph-image`;

export const INDEXABLE_PUBLIC_ROUTES: PublicRoute[] = [
  {
    path: '/webinars',
    title: 'Webinars & Online Events',
    description: 'Live online sessions on fundraising strategy, storytelling, and running a campaign.',
    priority: 0.65,
    changeFrequency: 'weekly',
  },
  {
    path: '/community',
    title: 'Community',
    description: 'Organiser updates from live campaigns and the gifts arriving as they happen.',
    priority: 0.7,
    changeFrequency: 'daily',
  },
  {
    path: '/newsletter',
    title: 'Newsletter',
    description: 'One email a month — what got funded, what changed on CharitMe, and what we got wrong.',
    priority: 0.5,
    changeFrequency: 'monthly',
  },
  {
    path: '/press',
    title: 'Press',
    description: 'Press and media enquiries — who to contact and the facts you can quote.',
    priority: 0.6,
    changeFrequency: 'monthly',
  },
  {
    path: '/brand-assets',
    title: 'Brand Assets',
    description: 'Official CharitMe logo files, colour values, and usage guidelines.',
    priority: 0.55,
    changeFrequency: 'monthly',
  },
  {
    path: '/support',
    title: 'Support',
    description: 'Get help with CharitMe — help centre, email, or a message to a person.',
    priority: 0.7,
    changeFrequency: 'monthly',
  },
  {
    path: '/resources',
    title: 'Resources',
    description: 'Guides, research, and reference for fundraisers and donors.',
    priority: 0.75,
    changeFrequency: 'weekly',
  },
  {
    path: '/teams/create',
    title: 'Create a Team',
    description: 'Start a fundraising team on any CharitMe campaign — name it, set a goal, and share one link.',
    priority: 0.7,
    changeFrequency: 'monthly',
  },
  {
    path: '/glossary',
    title: 'Glossary',
    description: 'Key fundraising terms explained — fees, payouts, verification, trust scores, and tax receipts.',
    priority: 0.6,
    changeFrequency: 'monthly',
  },
  {
    path: '/mobile-app',
    title: 'CharitMe on Mobile',
    description: 'Install CharitMe from your browser in two taps and use it like any other app.',
    priority: 0.6,
    changeFrequency: 'monthly',
  },
  {
    path: '/internships',
    title: 'Internships',
    description: 'Internships at CharitMe — what we look for and how to get in touch.',
    priority: 0.55,
    changeFrequency: 'monthly',
  },
  {
    path: '/feedback',
    title: 'Feedback',
    description: 'Tell us what is working and what is not — bug reports, ideas, and confusing wording.',
    priority: 0.6,
    changeFrequency: 'monthly',
  },
  {
    path: '/impact-map',
    title: 'Impact Map',
    description: 'Where CharitMe campaigns are running and what they fund, counted from live data.',
    priority: 0.7,
    changeFrequency: 'daily',
  },
  {
    path: '/search',
    title: 'Search CharitMe',
    description: 'Search campaigns, causes, and resources across CharitMe with filters for cause, location, and progress.',
    priority: 0.7,
    changeFrequency: 'weekly',
  },
  {
    path: '/teams',
    title: 'Teams',
    description: 'Fundraise together — start or join a team and track a shared goal.',
    priority: 0.75,
    changeFrequency: 'daily',
  },
  {
    path: '/donor-wall',
    title: 'Donor Wall',
    description: 'Thank you to the supporters funding campaigns on CharitMe.',
    priority: 0.7,
    changeFrequency: 'daily',
  },
  {
    path: '/supporter-space',
    title: 'Supporter Space',
    description: 'Where should you give? Answered from live campaign data — what is closing soonest, verified, and furthest from its goal.',
    priority: 0.8,
    changeFrequency: 'daily',
  },
  {
    path: '/causes',
    title: 'Browse Causes',
    description: 'Explore every cause on CharitMe — medical, education, animals, environment, disaster relief, and more.',
    priority: 0.85,
    changeFrequency: 'daily',
  },
  // Every cause landing page, DERIVED from the cause list rather than written
  // out here.
  //
  // Only `/causes/mental-health` used to be listed, back when all twenty pages
  // rendered the same fallback copy and one instantiation was genuinely
  // representative. They now carry per-cause helps grids and closing copy, so
  // each is a distinct indexable page — and nineteen hand-copied entries would
  // be a second list of causes to keep correct. This repo has already paid for
  // that mistake three times over with the category list.
  //
  // `title` and `description` are the exact strings `generateMetadata` emits in
  // `app/causes/[slug]/page.tsx`; deriving both from the same source is what
  // stops the sitemap and the page disagreeing about what a page is called.
  ...CAUSES.map((cause): PublicRoute => ({
    path: `/causes/${cause.slug}`,
    title: `${cause.label} Fundraisers`,
    description: cause.blurb,
    priority: 0.7,
    changeFrequency: 'daily',
  })),
  {
    path: '/donate',
    title: 'Donate',
    description: 'Give to a cause you care about. Browse verified campaigns and see exactly where your money goes.',
    priority: 0.85,
    changeFrequency: 'daily',
  },
  {
    path: '/get-involved',
    title: 'Get Involved',
    description: 'Every way to take part in CharitMe — donate, volunteer, fundraise, or bring your organisation on board.',
    priority: 0.8,
    changeFrequency: 'weekly',
  },
  {
    path: '/fundraising-guide',
    title: 'Fundraising Guide',
    description: 'A step-by-step guide to running a successful fundraiser on CharitMe.',
    priority: 0.8,
    changeFrequency: 'monthly',
  },
  {
    path: '/impact-education',
    title: 'Impact Education',
    description: 'How charitable giving actually works and how impact is measured honestly.',
    priority: 0.75,
    changeFrequency: 'monthly',
  },
  {
    path: '/reports',
    title: 'Reports & Research',
    description: 'Platform figures and transparency reporting for CharitMe.',
    priority: 0.75,
    changeFrequency: 'weekly',
  },
  {
    path: '/verification',
    title: 'Verification Process',
    description: 'How CharitMe verifies fundraisers and nonprofit organisations.',
    priority: 0.75,
    changeFrequency: 'monthly',
  },
  {
    path: '/partner',
    title: 'Partner With Us',
    description: 'Bring CharitMe to your community, company, or network.',
    priority: 0.75,
    changeFrequency: 'monthly',
  },
  {
    path: '/corporate-partnerships',
    title: 'Corporate Partnerships',
    description: 'Workplace giving, donation matching, and campaign sponsorship for companies.',
    priority: 0.75,
    changeFrequency: 'monthly',
  },
  {
    path: '/gallery',
    title: 'Gallery',
    description: 'A visual look at the campaigns running on CharitMe right now.',
    priority: 0.7,
    changeFrequency: 'daily',
  },
  {
    path: '/careers',
    title: 'Careers',
    description: 'Work at CharitMe — how we operate and what we look for.',
    priority: 0.6,
    changeFrequency: 'monthly',
  },
  {
    path: '/',
    title: 'CharitMe | AI Fundraising Platform',
    description: 'Launch trusted fundraising campaigns, accept donations, and grow with AI fundraising tools.',
    priority: 1,
    changeFrequency: 'daily',
  },
  {
    path: '/needs',
    title: 'Current Needs',
    description:
      'What communities still need funding for right now — measured from live campaign shortfalls, ordered by urgency.',
    priority: 0.68,
    changeFrequency: 'daily',
  },
  {
    path: '/campaigns',
    title: 'Browse Fundraising Campaigns',
    description: 'Discover active CharitMe campaigns and support verified people, nonprofits, and causes.',
    priority: 0.9,
    changeFrequency: 'hourly',
  },
  {
    path: '/pricing',
    title: 'CharitMe Pricing',
    description: 'Review simple fundraising pricing, payment processing details, and AI growth options.',
    priority: 0.85,
    changeFrequency: 'weekly',
  },
  {
    path: '/features',
    title: 'Fundraising Platform Features',
    description: 'Explore CharitMe tools for campaigns, donations, donor growth, AI coaching, and payouts.',
    priority: 0.85,
    changeFrequency: 'weekly',
  },
  {
    path: '/how-it-works',
    title: 'How CharitMe Works',
    description: 'Learn how to start a fundraiser, share it, collect donations, and receive payouts.',
    priority: 0.82,
    changeFrequency: 'weekly',
  },
  {
    path: '/for-nonprofits',
    title: 'Fundraising For Nonprofits',
    description: 'AI-powered donation pages, donor insights, events, grants, and reporting for nonprofits.',
    priority: 0.82,
    changeFrequency: 'weekly',
  },
  {
    // Crisis relief hub. Indexed deliberately: the point of the route is to be
    // findable and shareable while an emergency is unfolding, which a
    // `?category=` query string cannot do.
    path: '/crisis',
    title: 'Crisis Relief Fundraisers',
    description: 'Active emergency and disaster-relief fundraisers, newest first, with 0% platform fee.',
    priority: 0.80,
    changeFrequency: 'daily',
  },
  {
    // Proximity discovery. The page renders its own copy server-side and the
    // results load client-side after the visitor opts in to sharing location,
    // so there is a real, indexable page here even though the listing is not.
    path: '/nearby',
    title: 'Fundraisers Near You',
    description: 'Find active fundraisers close to you and support causes in your own community.',
    priority: 0.80,
    changeFrequency: 'daily',
  },
  {
    // Public API docs. Indexed on purpose: an open API that search engines
    // cannot find is not meaningfully open, and this is the page that
    // differentiates us from a competitor whose API is enterprise-gated.
    path: '/developers',
    title: 'CharitMe API — Developer Documentation',
    description: 'Free, documented REST API over your campaigns and donations. No enterprise tier required.',
    priority: 0.75,
    changeFrequency: 'monthly',
  },
  {
    // "Give once, fund many". Indexed: this is the differentiated donor entry
    // point, and the phrase people search for is a giving idea, not a campaign.
    path: '/give',
    title: 'Give Once, Fund Many',
    description: 'Support several fundraisers with one donation, split to the cent. 0% platform fee.',
    priority: 0.85,
    changeFrequency: 'daily',
  },
  {
    // Public status. Indexed on purpose: during an incident people search for
    // "charitme status", and a status page nobody can find is not a status page.
    path: '/status',
    title: 'System Status',
    description: 'Live operational status of CharitMe campaigns, donations, accounts and email.',
    priority: 0.5,
    changeFrequency: 'always',
  },
  {
    path: '/for-donors',
    title: 'Giving For Donors',
    description: 'Find trusted campaigns, give quickly, and follow the impact of your donations.',
    priority: 0.78,
    changeFrequency: 'weekly',
  },
  {
    path: '/for-individuals',
    title: 'Personal Fundraising',
    description: 'Raise money for medical bills, emergencies, education, memorials, and community needs.',
    priority: 0.78,
    changeFrequency: 'weekly',
  },
  {
    path: '/ai-fundraising',
    title: 'AI Fundraising',
    description: 'Use AI to write campaign stories, find growth opportunities, and improve donor outreach.',
    priority: 0.82,
    changeFrequency: 'weekly',
  },
  {
    path: '/ai-campaign',
    title: 'AI Campaign Builder',
    description: 'Create high-converting fundraising campaigns with AI-guided copy, media, and launch tools.',
    priority: 0.78,
    changeFrequency: 'weekly',
  },
  {
    path: '/events',
    title: 'Fundraising Events',
    description: 'Create, promote, and discover fundraising events connected to CharitMe campaigns.',
    priority: 0.76,
    changeFrequency: 'daily',
  },
  {
    path: '/grants',
    title: 'Fundraising Grants',
    description: 'Find grant opportunities and manage applications for nonprofit and community fundraising.',
    priority: 0.76,
    changeFrequency: 'daily',
  },
  {
    path: '/matching',
    title: 'Donation Matching',
    description: 'Connect campaigns with corporate matching gifts and sponsor-funded donation matches.',
    priority: 0.76,
    changeFrequency: 'daily',
  },
  {
    path: '/volunteer',
    title: 'Volunteer Opportunities',
    description: 'Discover volunteer opportunities connected to causes and nonprofit fundraising campaigns.',
    priority: 0.72,
    changeFrequency: 'daily',
  },
  {
    path: '/sponsor',
    title: 'Campaign Sponsorships',
    description: 'Find sponsorship opportunities and fund campaigns with clear benefits and impact.',
    priority: 0.72,
    changeFrequency: 'daily',
  },
  {
    path: '/impact',
    title: 'Impact Reporting',
    description: 'See how campaigns use donations through transparent plans, updates, and outcomes.',
    priority: 0.7,
    changeFrequency: 'weekly',
  },
  {
    path: '/leaderboard',
    title: 'Fundraising Leaderboard',
    description: 'Track leading CharitMe campaigns and donors by fundraising momentum and impact.',
    priority: 0.75,
    changeFrequency: 'hourly',
  },
  {
    path: '/blog',
    title: 'Fundraising Blog',
    description: 'Read fundraising strategy, donor growth guidance, nonprofit tips, and CharitMe updates.',
    priority: 0.7,
    changeFrequency: 'weekly',
  },
  {
    path: '/changelog',
    title: 'Product Changelog',
    description: 'New features, improvements and fixes shipped to CharitMe, by date.',
    priority: 0.5,
    changeFrequency: 'weekly',
  },
  {
    path: '/success-stories',
    title: 'Fundraising Success Stories',
    description: 'Learn from successful campaigns and real fundraising playbooks on CharitMe.',
    priority: 0.68,
    changeFrequency: 'weekly',
  },
  {
    path: '/fast-payouts',
    title: 'Fast Fundraising Payouts',
    description: 'Understand CharitMe payout timing, payment processing, and organizer fund access.',
    priority: 0.62,
    changeFrequency: 'weekly',
  },
  {
    path: '/roles',
    title: 'Account Roles Explained',
    description: 'What Donor, Organizer, Beneficiary, Nonprofit and staff roles mean on CharitMe, in plain language.',
    priority: 0.5,
    changeFrequency: 'monthly',
  },
  {
    path: '/fees',
    title: 'Fundraising Fees',
    description: 'Compare CharitMe platform fees, processing fees, and donor-supported fundraising costs.',
    priority: 0.6,
    changeFrequency: 'monthly',
  },
  {
    path: '/transparency',
    title: 'Fundraising Transparency',
    description: 'Review CharitMe trust signals, campaign transparency, donations, and accountability tools.',
    priority: 0.58,
    changeFrequency: 'monthly',
  },
  {
    path: '/trust-safety',
    title: 'Trust And Safety',
    description: 'Learn how CharitMe protects donors, organizers, campaigns, and platform integrity.',
    priority: 0.55,
    changeFrequency: 'monthly',
  },
  {
    path: '/help',
    title: 'CharitMe Help Center',
    description: 'Get answers about fundraising, donations, payouts, campaign setup, and account support.',
    priority: 0.65,
    changeFrequency: 'weekly',
  },
  {
    path: '/faq',
    title: 'CharitMe FAQ',
    description: 'Find quick answers to common CharitMe fundraising, donation, and payout questions.',
    priority: 0.62,
    changeFrequency: 'weekly',
  },
  {
    path: '/contact',
    title: 'Contact CharitMe',
    description: 'Contact CharitMe for fundraising support, partnerships, press, and platform questions.',
    priority: 0.58,
    changeFrequency: 'monthly',
  },
  {
    // High priority deliberately: this is the top of the conversion funnel and,
    // until now, it had no URL at all — it existed only as /login?mode=signup.
    path: '/signup',
    title: 'Create Your CharitMe Account',
    description:
      'Create a free CharitMe account to donate to causes you care about, start a fundraiser, and track your impact in one place.',
    priority: 0.72,
    changeFrequency: 'monthly',
  },
  {
    path: '/about-us',
    title: 'About CharitMe',
    description: 'Learn about CharitMe and the mission to make fundraising faster, trusted, and more accessible.',
    priority: 0.62,
    changeFrequency: 'monthly',
  },
  {
    path: '/supported-countries',
    title: 'Supported Countries',
    description: 'See where CharitMe fundraising, donations, and payouts are supported.',
    priority: 0.52,
    changeFrequency: 'monthly',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy',
    description: 'Read the CharitMe privacy policy for donors, organizers, nonprofits, and visitors.',
    priority: 0.42,
    changeFrequency: 'yearly',
  },
  {
    path: '/terms',
    title: 'Terms Of Service',
    description: 'Read the CharitMe terms that govern fundraising, donations, campaigns, and platform use.',
    priority: 0.42,
    changeFrequency: 'yearly',
  },
  {
    path: '/security',
    title: 'Security',
    description: 'Review CharitMe security practices for fundraising accounts, donations, and platform data.',
    priority: 0.42,
    changeFrequency: 'yearly',
  },
  {
    path: '/refunds',
    title: 'Refund Policy',
    description: 'Understand CharitMe donation refund policy, eligibility, and support process.',
    priority: 0.4,
    changeFrequency: 'yearly',
  },
  {
    path: '/giving-days',
    title: 'Giving Days',
    description: 'Time-boxed fundraising events on CharitMe — what is live now, what is coming, and how much each has raised.',
    priority: 0.55,
    changeFrequency: 'daily',
  },
  {
    path: '/ambassadors',
    title: 'Ambassador Programme',
    description: 'Share campaigns with your own link and get credited for every donation you inspire — five recognition tiers, nothing to apply for.',
    priority: 0.5,
    changeFrequency: 'monthly',
  },
  {
    path: '/community-guidelines',
    title: 'Community Guidelines',
    description: 'How to fundraise, give and comment on CharitMe — how to report a problem, and what we do about it.',
    priority: 0.4,
    changeFrequency: 'yearly',
  },
  {
    path: '/prohibited-use',
    title: 'Prohibited Use Policy',
    description: 'Review prohibited fundraising categories and platform integrity rules for CharitMe.',
    priority: 0.38,
    changeFrequency: 'yearly',
  },
  {
    path: '/legal',
    title: 'Legal',
    description: 'Every CharitMe policy in one place — terms, privacy, fees, refunds, security, and acceptable use.',
    priority: 0.38,
    changeFrequency: 'yearly',
  },
  {
    path: '/cookies',
    title: 'Cookie Policy',
    description: 'The cookies CharitMe sets, what each one does, and how to change your privacy choices.',
    priority: 0.36,
    changeFrequency: 'yearly',
  },
  {
    path: '/accessibility',
    title: 'Accessibility Statement',
    description: 'CharitMe targets WCAG 2.2 Level AA — what is verified, what is still open, and how to report a barrier.',
    priority: 0.36,
    changeFrequency: 'yearly',
  },
];

export function publicUrl(path: string): string {
  return path === '/' ? CHARITME_ORIGIN : `${CHARITME_ORIGIN}${path}`;
}
