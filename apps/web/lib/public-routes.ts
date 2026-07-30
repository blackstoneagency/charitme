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

export const INDEXABLE_PUBLIC_ROUTES: PublicRoute[] = [
  {
    path: '/',
    title: 'CharitMe | AI Fundraising Platform',
    description: 'Launch trusted fundraising campaigns, accept donations, and grow with AI fundraising tools.',
    priority: 1,
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
    path: '/prohibited-use',
    title: 'Prohibited Use Policy',
    description: 'Review prohibited fundraising categories and platform integrity rules for CharitMe.',
    priority: 0.38,
    changeFrequency: 'yearly',
  },
];

export function publicUrl(path: string): string {
  return path === '/' ? CHARITME_ORIGIN : `${CHARITME_ORIGIN}${path}`;
}
