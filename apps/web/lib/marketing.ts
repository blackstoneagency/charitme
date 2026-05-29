export type MarketingPage = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  points: string[];
  cta: string;
};

export const MARKETING_PAGES: MarketingPage[] = [
  {
    slug: 'pricing',
    eyebrow: 'Transparent pricing',
    title: '0% mandatory platform fee. Optional donor tips.',
    description: 'CharitMe is free to start, free to run, and clear about every dollar before checkout.',
    points: ['0% mandatory platform fee', 'Optional CharitMe support tips', 'Premium AI tools for teams', 'Fast payout fees only when eligible users choose speed'],
    cta: 'Compare plans',
  },
  {
    slug: 'how-it-works',
    eyebrow: 'Simple path to help',
    title: 'Create, verify, share, receive support.',
    description: 'CharitMe keeps campaign creation simple while adding trust checks, AI optimization, and payout transparency behind the scenes.',
    points: ['Launch with AI Copilot', 'Verify identity and beneficiary', 'Share AI-generated outreach', 'Track donations, updates, and payouts'],
    cta: 'Start a campaign',
  },
  {
    slug: 'trust-safety',
    eyebrow: 'Trust and safety',
    title: 'Built-in trust signals before donors give.',
    description: 'Trust scores, risk review, reports, admin moderation, and transparent ledgers help donors give with confidence.',
    points: ['AI trust score', 'Fraud/risk review queue', 'Report campaign workflow', 'Receipt and milestone ledger'],
    cta: 'See trust tools',
  },
  {
    slug: 'fast-payouts',
    eyebrow: 'Fast verified payouts',
    title: 'Get help when it matters, with risk-aware payout speed.',
    description: 'Standard payouts are free. Same-day and instant payout options are available only to eligible verified users.',
    points: ['Stripe Connect Express', 'Verification status dashboard', 'Risk-aware payout eligibility', 'Payout freeze and release controls'],
    cta: 'View payout options',
  },
  {
    slug: 'ai-fundraising',
    eyebrow: 'AI fundraising',
    title: 'AI helps campaigns become clearer, stronger, and more trusted.',
    description: 'Generate stories, donation tiers, updates, social posts, donor FAQs, and next-best actions without losing authenticity.',
    points: ['Campaign Copilot', 'Growth Engine', 'Donor outreach generator', 'Campaign health score'],
    cta: 'Use AI Copilot',
  },
  {
    slug: 'for-individuals',
    eyebrow: 'For individuals',
    title: 'A safer way to ask for help.',
    description: 'Personal fundraising for medical, memorial, emergency, education, community, and family needs.',
    points: ['30-second campaign setup', 'Mobile-first sharing', 'Trust checklist', 'Fast verified payouts'],
    cta: 'Raise for yourself or someone else',
  },
  {
    slug: 'for-nonprofits',
    eyebrow: 'For nonprofits',
    title: 'AI-powered fundraising workflows for modern teams.',
    description: 'CharitMe supports donor CRM, recurring donations, tax receipts, campaigns, events, and analytics.',
    points: ['Nonprofit plans', 'Team access', 'Donor analytics', 'Recurring donor management'],
    cta: 'Explore nonprofit tools',
  },
  {
    slug: 'for-donors',
    eyebrow: 'For donors',
    title: 'Give with more confidence and clearer impact.',
    description: 'Donors see trust signals, transparent breakdowns, receipts, updates, and where-the-dollar-went summaries.',
    points: ['Trust score', 'Anonymous donation option', 'Receipts', 'Impact updates'],
    cta: 'Browse trusted campaigns',
  },
  {
    slug: 'faq',
    eyebrow: 'FAQ',
    title: 'Clear answers before you start.',
    description: 'Learn how CharitMe handles fees, payouts, tips, trust scores, verification, AI tools, and donor receipts.',
    points: ['Campaigns are free to start', 'Tips are optional', 'Fast payouts require verification', 'Trust scores never publicly accuse campaigns of fraud'],
    cta: 'Contact support',
  },
  {
    slug: 'contact',
    eyebrow: 'Contact',
    title: 'Talk with the CharitMe team.',
    description: 'Questions about fundraising, nonprofits, enterprise giving, safety reviews, or partnerships? We can help.',
    points: ['Organizer support', 'Nonprofit onboarding', 'Enterprise giving', 'Trust and safety review'],
    cta: 'Send a message',
  },
];

export function getMarketingPage(slug: string): MarketingPage | undefined {
  return MARKETING_PAGES.find((page) => page.slug === slug);
}
