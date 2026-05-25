export type PricingTier = {
  name: string;
  price: string;
  audience: string;
  features: string[];
  highlighted?: boolean;
};

export const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    audience: 'Individuals and urgent personal fundraisers',
    features: ['Create campaigns', 'Accept donations', 'Basic AI campaign generation', 'Standard payout', 'Basic sharing tools'],
  },
  {
    name: 'Growth AI',
    price: '$19/mo',
    audience: 'Organizers who want more reach',
    highlighted: true,
    features: ['AI campaign optimization', 'AI donor outreach', 'AI social media studio', 'AI update writer', 'Campaign health score', 'Donor segmentation'],
  },
  {
    name: 'Pro AI',
    price: '$49/mo',
    audience: 'High-stakes campaigns and teams',
    features: ['AI video scripts', 'Advanced donor analytics', 'A/B copy testing', 'Advanced transparency ledger', 'Priority review'],
  },
  {
    name: 'Nonprofit Starter',
    price: '$29/mo',
    audience: 'Small nonprofits',
    features: ['Donor CRM', 'Recurring donations', 'Tax receipt emails', 'Team access', 'Campaign templates'],
  },
  {
    name: 'Nonprofit Growth',
    price: '$99/mo',
    audience: 'Growing nonprofit teams',
    features: ['Advanced analytics', 'AI outreach automation', 'Event pages', 'Recurring donor management', 'Team reporting'],
  },
  {
    name: 'Enterprise',
    price: '$499+/mo',
    audience: 'Corporate giving and disaster response',
    features: ['Corporate giving', 'Employee matching', 'Disaster dashboards', 'API access', 'Dedicated support'],
  },
];

export const PAYOUT_OPTIONS = [
  { name: 'Standard payout', fee: 'Free', availability: 'All verified campaigns' },
  { name: 'Same-day payout', fee: '1%', availability: 'Eligible verified users' },
  { name: 'Instant payout', fee: '1.5%', availability: 'Low-risk verified users' },
] as const;
