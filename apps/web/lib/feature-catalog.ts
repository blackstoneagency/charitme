export type PlatformFeature = {
  name: string;
  description: string;
  competitor: string;
  /**
   * Set when the feature is TRACKED FOR PARITY but not yet built.
   *
   * REQUIRED_COMPETITOR_FEATURES is a competitive checklist — what rivals offer
   * and CharitMe intends to match — and `feature-catalog.test.ts` asserts every
   * entry stays listed. But the /features page renders each module under a
   * "Live" / "Production Ready" badge, so an unbuilt entry read to visitors as
   * shipped. Auctions was the original case: `auction_items` and `auction_bids`
   * existed in the schema with no route, API, component or bidding UI anywhere
   * in the app. It has since been built (lib/auctions-core.ts, lib/auctions.ts,
   * /api/auctions/[id]/bids, and the lots section on the event page), so the
   * flag is off.
   *
   * Marking an entry here keeps the parity checklist complete without
   * advertising something that does not exist. Set it whenever the schema lands
   * before the code does, and clear it only when a real route, API and UI read
   * those tables.
   */
  planned?: boolean;
};

export type PlatformModule = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  audience: string;
  /**
   * 'Planned' means the module is designed and its schema exists, but no
   * application code reads those tables yet.
   *
   * Added because the union previously had no way to say "not built": every
   * module had to claim Live or Production Ready. Two modules were therefore
   * advertised as Production Ready on /features with **100% of their declared
   * databaseTables unwired** — memberships (5/5) and creator-commerce (6/6) —
   * each with an action CTA ("Create membership tiers", "Build a creator page")
   * that lands the visitor on /create/choose-path, the ordinary campaign wizard,
   * where none of that functionality exists.
   */
  status: 'Live' | 'Production Ready' | 'Planned';
  primaryCta: string;
  features: PlatformFeature[];
  operatingModel: string[];
  databaseTables: string[];
};

export const PLATFORM_MODULES: PlatformModule[] = [
  {
    slug: 'fundraising-core',
    title: 'Campaign Fundraising Core',
    eyebrow: 'GoFundMe parity',
    summary: 'Mobile-first fundraiser creation, public campaign pages, updates, donor comments, beneficiary routing, sharing, reports, and checkout.',
    audience: 'Individuals, families, communities, and emergency organizers',
    status: 'Production Ready',
    primaryCta: 'Start a fundraiser',
    databaseTables: ['campaigns', 'campaign_media', 'campaign_updates', 'donations', 'donor_messages', 'campaign_reports'],
    operatingModel: [
      'Eight-step creation wizard collects category, goal, beneficiary, story, media, verification, AI review, and publish settings.',
      'Campaign pages combine rich storytelling, progress, donor confidence signals, updates, impact proof, and reporting.',
      'Donation flow supports transparent tips, fee coverage, anonymous giving, comments, and Stripe Checkout wallets.',
    ],
    features: [
      { competitor: 'GoFundMe', name: 'Campaign Creation Wizard', description: 'Step-by-step fundraiser setup with AI guidance.' },
      { competitor: 'GoFundMe', name: 'Donation Checkout', description: 'Fast donation flow with cards, wallets, transparent tips, and optional fee coverage.' },
      { competitor: 'GoFundMe', name: 'Social Sharing', description: 'One-click campaign and post-donation sharing prompts.' },
      { competitor: 'GoFundMe', name: 'Progress Bar', description: 'Goal tracking with amount raised, donor count, and completion percentage.' },
      { competitor: 'GoFundMe', name: 'Campaign Updates', description: 'Organizer updates keep supporters informed after launch.' },
      { competitor: 'GoFundMe', name: 'Beneficiary Setup', description: 'Separate beneficiary profile and payout recipient support.' },
      { competitor: 'GoFundMe', name: 'Mobile Experience', description: 'Responsive campaign and checkout flows designed for small screens first.' },
      { competitor: 'GoFundMe', name: 'Donor Comments', description: 'Supporters can leave public encouragement or private notes.' },
      { competitor: 'GoFundMe', name: 'Trust & Safety', description: 'Campaign reporting, risk review, and trust status are built into every campaign.' },
      { competitor: 'GoFundMe', name: 'Organizer Dashboard', description: 'Tracks donations, shares, AI recommendations, trust tasks, and payouts.' },
    ],
  },
  {
    slug: 'projects-perks',
    title: 'Projects, Perks, and Launch Campaigns',
    eyebrow: 'Kickstarter and Indiegogo parity',
    summary: 'Reward tiers, fixed or flexible funding, campaign deadlines, project discovery, creator credibility, video storytelling, and InDemand continuation.',
    audience: 'Creators, makers, startup launches, product campaigns, and community projects',
    status: 'Production Ready',
    primaryCta: 'Launch a project',
    databaseTables: ['reward_tiers', 'campaign_launch_settings', 'creator_profiles', 'campaign_media', 'campaign_updates'],
    operatingModel: [
      'Funding mode supports flexible, fixed, and InDemand continuation without changing the donation ledger.',
      'Reward tiers store perks, quantities, delivery estimates, and fulfillment notes.',
      'Discovery pages can sort campaigns by trending, new, popular, category, deadline, and launch mode.',
    ],
    features: [
      { competitor: 'Kickstarter', name: 'Reward Tiers', description: 'Backers can select perks tied to contribution levels.' },
      { competitor: 'Kickstarter', name: 'Project Storytelling', description: 'Rich multimedia campaign pages with video and long-form story sections.' },
      { competitor: 'Kickstarter', name: 'Funding Goals', description: 'Goal-based funding with deadlines and progress tracking.' },
      { competitor: 'Kickstarter', name: 'Project Discovery', description: 'Browse trending, new, popular, and category-specific projects.' },
      { competitor: 'Kickstarter', name: 'Video Support', description: 'Campaign media accepts embedded pitch videos and uploaded video assets.' },
      { competitor: 'Kickstarter', name: 'Creator Profiles', description: 'Public creator pages show credibility, history, links, and trust passport signals.' },
      { competitor: 'Kickstarter', name: 'Campaign Deadlines', description: 'Time-limited fundraising windows are supported on campaigns.' },
      { competitor: 'Kickstarter', name: 'Community Updates', description: 'Ongoing posts keep backers engaged.' },
      { competitor: 'Kickstarter', name: 'Backer Community', description: 'Donation comments and community posts create public engagement.' },
      { competitor: 'Kickstarter', name: 'Category Browsing', description: 'Campaign categories power organized discovery and search.' },
      { competitor: 'Indiegogo', name: 'Flexible Funding', description: 'Organizers can keep funds even if the goal is not reached.' },
      { competitor: 'Indiegogo', name: 'Fixed Funding', description: 'All-or-nothing projects can be marked as fixed funding.' },
      { competitor: 'Indiegogo', name: 'Product Launch Support', description: 'Launch settings support startup and product-focused campaigns.' },
      { competitor: 'Indiegogo', name: 'InDemand Campaigns', description: 'Campaigns can continue fundraising after the initial launch window.' },
      { competitor: 'Indiegogo', name: 'Perk System', description: 'Reward tiers double as perk-based contribution options.' },
      { competitor: 'Indiegogo', name: 'Campaign Analytics', description: 'Performance snapshots track views, conversion, donors, and revenue.' },
      { competitor: 'Indiegogo', name: 'Global Payments', description: 'Campaign settings store currency and market support for international giving.' },
    ],
  },
  {
    slug: 'memberships',
    title: 'Memberships and Community',
    eyebrow: 'Patreon parity',
    summary: 'Recurring memberships, membership tiers, subscriber-only content, creator pages, community posts, messages, and billing.',
    audience: 'Creators, nonprofits, community leaders, and recurring supporter programs',
    status: 'Planned',
    primaryCta: 'Create membership tiers',
    databaseTables: ['creator_profiles', 'membership_tiers', 'member_subscriptions', 'exclusive_posts', 'direct_messages'],
    operatingModel: [
      'Membership tiers define pricing, perks, cadence, and access rules.',
      'Stripe subscription IDs map recurring billing to member subscriptions.',
      'Exclusive posts and direct messages separate public fundraising from member-only relationship building.',
    ],
    features: [
      { competitor: 'Patreon', name: 'Recurring Memberships', description: 'Monthly supporter subscriptions tied to creators or nonprofits.' },
      { competitor: 'Patreon', name: 'Membership Tiers', description: 'Different supporter levels, prices, benefits, and limits.' },
      { competitor: 'Patreon', name: 'Exclusive Content', description: 'Subscriber-only posts and downloads.' },
      { competitor: 'Patreon', name: 'Community Posts', description: 'Creator communication feed for public or member-only updates.' },
      { competitor: 'Patreon', name: 'Direct Messaging', description: 'Creator-to-member messaging for supporter relationships.' },
      { competitor: 'Patreon', name: 'Analytics Dashboard', description: 'Subscriber and recurring revenue analytics.' },
      { competitor: 'Patreon', name: 'Mobile App', description: 'All membership surfaces are responsive and mobile friendly.' },
      { competitor: 'Patreon', name: 'Discord Integration', description: 'Integration records support Discord community access workflows.' },
      { competitor: 'Patreon', name: 'Membership Billing', description: 'Automated recurring billing through Stripe subscriptions.' },
      { competitor: 'Patreon', name: 'Creator Pages', description: 'Personalized public creator hubs.' },
    ],
  },
  {
    slug: 'nonprofit-suite',
    title: 'Nonprofit Growth Suite',
    eyebrow: 'Givebutter, Donorbox, Classy, and Mightycause parity',
    // 'auctions' deliberately NOT listed: the catalog marks Auctions planned:true
    // and there is no auction API, lib or UI — only tables. A 'Production Ready'
    // module must not advertise a capability this same file says is unbuilt.
    summary: 'Donation forms, recurring giving, CRM, tax receipts, peer-to-peer, team fundraising, events, reporting, templates, and nonprofit profiles.',
    audience: 'Nonprofits, schools, churches, community groups, and enterprise fundraising teams',
    status: 'Production Ready',
    primaryCta: 'Open nonprofit suite',
    databaseTables: ['nonprofit_profiles', 'donation_forms', 'recurring_donations', 'donor_crm_contacts', 'tax_receipts', 'team_members', 'peer_fundraisers'],
    operatingModel: [
      'Nonprofit profiles own campaigns, forms, contacts, segments, recurring donors, and receipts.',
      'Team and peer fundraising tables support multi-user nonprofit workflows and supporter-led fundraising.',
      'Analytics snapshots provide board-ready reporting without exposing private donor data publicly.',
    ],
    features: [
      { competitor: 'Givebutter', name: 'Donation Forms', description: 'Custom nonprofit donation pages and embeddable forms.' },
      { competitor: 'Givebutter', name: 'Recurring Donations', description: 'Monthly giving support for sustained programs.' },
      { competitor: 'Givebutter', name: 'Fundraising Events', description: 'Virtual and in-person fundraising event tools.' },
      { competitor: 'Givebutter', name: 'Auctions', description: 'Charity auction lots with live bidding on event pages.' },
      { competitor: 'Givebutter', name: 'CRM Tools', description: 'Donor contact records, tags, segments, and communication history.' },
      { competitor: 'Givebutter', name: 'Team Fundraising', description: 'Multiple organizers and supporter teams per campaign.' },
      { competitor: 'Givebutter', name: 'Livestream Fundraising', description: 'Live donation experiences connected to events and campaigns.' },
      { competitor: 'Givebutter', name: 'Text-to-Donate', description: 'SMS campaign keywords and outbound message support.' },
      { competitor: 'Givebutter', name: 'Email Marketing', description: 'Segmented donor campaigns and appeal history.' },
      { competitor: 'Givebutter', name: 'Donor Analytics', description: 'Fundraising performance and donor retention reporting.' },
      { competitor: 'Donorbox', name: 'Donation Forms', description: 'Embeddable donation widgets and hosted giving forms.' },
      { competitor: 'Donorbox', name: 'Recurring Donations', description: 'Automated monthly giving for campaigns and nonprofits.' },
      { competitor: 'Donorbox', name: 'Donor Management', description: 'CRM profiles track donor history, tags, consent, and lifetime value.' },
      { competitor: 'Donorbox', name: 'Tax Receipts', description: 'Automated donor receipts for nonprofit donations.' },
      { competitor: 'Donorbox', name: 'Peer-to-Peer Fundraising', description: 'Supporter-created pages tied to parent campaigns.', planned: true },
      { competitor: 'Donorbox', name: 'Event Ticketing', description: 'Paid nonprofit event registration and ticketing.' },
      { competitor: 'Donorbox', name: 'Membership Management', description: 'Member subscription records and access levels.' },
      { competitor: 'Donorbox', name: 'Goal Meter', description: 'Progress meters show campaign and form fundraising progress.' },
      { competitor: 'Donorbox', name: 'Payment Integrations', description: 'Stripe Checkout and Connect power secure payment processing.' },
      { competitor: 'Donorbox', name: 'Multi-Currency Support', description: 'Donation forms can store and display supported currencies.' },
      { competitor: 'Classy', name: 'Enterprise Fundraising', description: 'Large-scale nonprofit workflows, reports, and team roles.' },
      { competitor: 'Classy', name: 'Donor CRM', description: 'Advanced donor management with contacts, segments, and communication history.' },
      { competitor: 'Classy', name: 'Peer-to-Peer Campaigns', description: 'Supporter-driven campaign pages linked to parent fundraisers.', planned: true },
      { competitor: 'Classy', name: 'Event Fundraising', description: 'Event, ticketing, auction, and livestream fundraising workflows.' },
      { competitor: 'Classy', name: 'Recurring Giving', description: 'Monthly donor programs and recurring subscription records.' },
      { competitor: 'Classy', name: 'Analytics & Reporting', description: 'Enterprise snapshots for revenue, conversion, donors, and retention.' },
      { competitor: 'Classy', name: 'Campaign Templates', description: 'Reusable templates accelerate repeat fundraising programs.' },
      { competitor: 'Classy', name: 'Team Management', description: 'Multi-user nonprofit roles support collaborative workflows.' },
      { competitor: 'Classy', name: 'API Integrations', description: 'API keys and outbound webhooks support enterprise integration.' },
      { competitor: 'Classy', name: 'Donation Checkout', description: 'Enterprise-grade payment processing through Stripe Checkout.' },
      { competitor: 'Mightycause', name: 'Fundraising Pages', description: 'Nonprofit campaign pages with trust, giving, and progress.' },
      { competitor: 'Mightycause', name: 'Giving Days', description: 'Coordinated time-bound fundraising days and community events.' },
      { competitor: 'Mightycause', name: 'Donation Processing', description: 'Secure online donations with transparent platform economics.' },
      { competitor: 'Mightycause', name: 'Peer Fundraising', description: 'Supporter fundraising pages raise toward a parent campaign goal.', planned: true },
      { competitor: 'Mightycause', name: 'Recurring Donations', description: 'Monthly giving records for nonprofit and campaign programs.' },
      { competitor: 'Mightycause', name: 'Event Registration', description: 'Ticket and registration support for nonprofit events.' },
      { competitor: 'Mightycause', name: 'Donor CRM', description: 'Supporter tracking, tags, consent, and giving history.' },
      { competitor: 'Mightycause', name: 'Team Campaigns', description: 'Multi-organizer campaign support with roles.' },
      { competitor: 'Mightycause', name: 'Reporting Tools', description: 'Donation and campaign analytics for nonprofit teams.' },
      { competitor: 'Mightycause', name: 'Nonprofit Profiles', description: 'Public organization pages with credibility and giving options.' },
    ],
  },
  {
    slug: 'creator-commerce',
    title: 'Creator Commerce and Tips',
    eyebrow: 'Ko-fi and Buy Me a Coffee parity',
    summary: 'One-time support, creator pages, memberships, digital downloads, commissions, storefronts, donation buttons, supporter messages, email collection, and analytics.',
    audience: 'Creators, artists, writers, streamers, builders, and small creative businesses',
    status: 'Planned',
    primaryCta: 'Build a creator page',
    databaseTables: ['creator_profiles', 'digital_products', 'product_orders', 'commission_requests', 'creator_tips', 'embedded_buttons'],
    operatingModel: [
      'Creator profiles can receive one-time tips, memberships, product sales, and commission requests.',
      'Digital product orders keep fulfillment status separate from fundraising donations.',
      'Embedded buttons give creators portable donation and support entry points.',
    ],
    features: [
      { competitor: 'Ko-fi', name: 'One-Time Tips', description: 'Quick creator tipping and supporter messages.' },
      { competitor: 'Ko-fi', name: 'Memberships', description: 'Monthly creator support with recurring billing.' },
      { competitor: 'Ko-fi', name: 'Digital Downloads', description: 'Sell downloadable files and creative products.' },
      { competitor: 'Ko-fi', name: 'Commissions', description: 'Creator commission requests, quotes, and fulfillment status.' },
      { competitor: 'Ko-fi', name: 'Goal Tracking', description: 'Funding goals display on creator and campaign pages.' },
      { competitor: 'Ko-fi', name: 'Shop Functionality', description: 'Creator storefronts for products and downloads.' },
      { competitor: 'Ko-fi', name: 'Donation Buttons', description: 'Embeddable buttons for websites and profiles.' },
      { competitor: 'Ko-fi', name: 'Creator Feed', description: 'Posts, updates, and supporter-facing content.' },
      { competitor: 'Ko-fi', name: 'Custom Branding', description: 'Creator pages store custom colors, hero images, and links.' },
      { competitor: 'Ko-fi', name: 'Mobile-Friendly UX', description: 'Creator pages, shops, tips, and memberships stay lightweight on mobile.' },
      { competitor: 'Buy Me a Coffee', name: 'One-Time Support', description: 'Low-friction one-time support flow.' },
      { competitor: 'Buy Me a Coffee', name: 'Memberships', description: 'Recurring supporter subscriptions for creator pages.' },
      { competitor: 'Buy Me a Coffee', name: 'Creator Pages', description: 'Public support profiles with custom branding and supporter CTAs.' },
      { competitor: 'Buy Me a Coffee', name: 'Digital Product Sales', description: 'Sell files and products alongside fundraising.' },
      { competitor: 'Buy Me a Coffee', name: 'Supporter Messages', description: 'Donors and fans can leave encouragement with support.' },
      { competitor: 'Buy Me a Coffee', name: 'Embedded Buttons', description: 'Website support buttons and widgets.' },
      { competitor: 'Buy Me a Coffee', name: 'Simple Checkout', description: 'Fast one-time support and product purchase checkout.' },
      { competitor: 'Buy Me a Coffee', name: 'Email Collection', description: 'Supporter contact collection for future outreach.' },
      { competitor: 'Buy Me a Coffee', name: 'Mobile Optimization', description: 'Support pages and checkout are optimized for mobile giving.' },
      { competitor: 'Buy Me a Coffee', name: 'Creator Analytics', description: 'Supporter, revenue, product, and membership insights.' },
    ],
  },
  {
    slug: 'ai-trust-growth',
    title: 'AI Trust and Growth Engine',
    eyebrow: 'CharitMe moat',
    summary: 'AI campaign writing, trust scoring, fraud prevention, donor intelligence, transparency ledger, fast payout risk scoring, and growth recommendations.',
    audience: 'Every CharitMe organizer, donor, nonprofit, creator, and admin',
    status: 'Live',
    primaryCta: 'Use AI copilot',
    databaseTables: ['trust_scores', 'risk_flags', 'verification_documents', 'transparency_ledger_items', 'ai_generations', 'payouts'],
    operatingModel: [
      'AI copilot generates authentic campaign copy, social posts, donor FAQs, update drafts, and trust improvement tasks.',
      'Trust score combines identity, beneficiary, Stripe, evidence, completeness, duplicate text, urgency language, velocity, account age, and admin review signals.',
      'Risk controls gate fast payouts, admin review, campaign freezes, and public trust status without publicly accusing organizers.',
    ],
    features: [
      { competitor: 'CharitMe', name: 'AI Campaign Writer', description: 'Creates titles, stories, updates, FAQs, email appeals, SMS copy, and donation tiers.' },
      { competitor: 'CharitMe', name: 'AI Trust Score', description: 'Public trust status gives donors clear confidence signals.' },
      { competitor: 'CharitMe', name: 'AI Fraud Detection', description: 'Flags duplicate text, suspicious patterns, risky payout requests, and verification gaps.' },
      { competitor: 'CharitMe', name: 'AI Social Media Generation', description: 'Creates captions, long-form posts, share kits, and timing recommendations.' },
      { competitor: 'CharitMe', name: 'AI Donor Targeting', description: 'Segments donors and recommends outreach actions.' },
      { competitor: 'CharitMe', name: 'AI Campaign Health Score', description: 'Predicts success and recommends improvements.' },
      { competitor: 'CharitMe', name: 'AI Transparency Ledger', description: 'Summarizes receipts, milestones, expenses, payouts, and impact updates.' },
      { competitor: 'CharitMe', name: 'AI Payout Risk Engine', description: 'Enables safer standard, same-day, and instant payouts for verified users.' },
    ],
  },
];

export const REQUIRED_COMPETITOR_FEATURES = PLATFORM_MODULES.flatMap((module) =>
  module.features.map((feature) => `${feature.competitor}:${feature.name}`),
);

export function getPlatformModule(slug: string) {
  return PLATFORM_MODULES.find((module) => module.slug === slug);
}

/**
 * A feature is BUILT only when it is not itself `planned` and its module is not
 * wholly `Planned`. Both markers already exist precisely because the thing is not
 * built — Auctions has no route, API or UI, and the memberships and
 * creator-commerce modules have 100% of their declared tables unwired.
 */
export function isFeatureBuilt(platformModule: PlatformModule, feature: PlatformFeature): boolean {
  return platformModule.status !== 'Planned' && feature.planned !== true;
}

/**
 * Competitive coverage, counted honestly.
 *
 * This used to return a single `count` per competitor that included planned
 * features and whole planned modules, and /features rendered it under a
 * hardcoded green "✓ Full parity" badge. So the PUBLIC page claimed full parity
 * with Givebutter while counting Auctions — which the catalog itself marks as
 * not built — toward that claim, and claimed parity for competitors whose entire
 * module (memberships, creator-commerce) is unwired.
 *
 * `total` is what is mapped, `built` is what actually ships, and `fullParity` is
 * true only when they agree. A parity claim is a competitive statement made to
 * visitors, so it is exactly the wrong place to round up.
 */
export function getFeatureCoverage() {
  const totals = new Map<string, number>();
  const built = new Map<string, number>();
  for (const platformModule of PLATFORM_MODULES) {
    for (const feature of platformModule.features) {
      totals.set(feature.competitor, (totals.get(feature.competitor) ?? 0) + 1);
      if (isFeatureBuilt(platformModule, feature)) {
        built.set(feature.competitor, (built.get(feature.competitor) ?? 0) + 1);
      }
    }
  }

  const competitors = Array.from(totals.entries()).map(([name, total]) => {
    const builtCount = built.get(name) ?? 0;
    return {
      name,
      /** Retained for existing callers: the number MAPPED, not the number built. */
      count: total,
      total,
      built: builtCount,
      planned: total - builtCount,
      fullParity: builtCount === total,
    };
  });

  const builtFeatureCount = PLATFORM_MODULES.reduce(
    (sum, m) => sum + m.features.filter((f) => isFeatureBuilt(m, f)).length,
    0,
  );

  return {
    moduleCount: PLATFORM_MODULES.length,
    /** Every feature tracked for parity, built or not. */
    featureCount: REQUIRED_COMPETITOR_FEATURES.length,
    /** The subset that actually ships today. */
    builtFeatureCount,
    competitors,
  };
}
