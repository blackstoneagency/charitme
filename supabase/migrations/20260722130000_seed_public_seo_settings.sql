-- Seed the canonical SEO control plane for every public marketing route.
-- Only missing routes are inserted so administrator overrides remain intact.
with routes(route, title, meta_description) as (
  values
    ('/', 'CharitMe | AI Fundraising Platform', 'Launch trusted fundraising campaigns, accept donations, and grow with AI fundraising tools.'),
    ('/campaigns', 'Browse Fundraising Campaigns', 'Discover active CharitMe campaigns and support verified people, nonprofits, and causes.'),
    ('/pricing', 'CharitMe Pricing', 'Review simple fundraising pricing, payment processing details, and AI growth options.'),
    ('/features', 'Fundraising Platform Features', 'Explore CharitMe tools for campaigns, donations, donor growth, AI coaching, and payouts.'),
    ('/how-it-works', 'How CharitMe Works', 'Learn how to start a fundraiser, share it, collect donations, and receive payouts.'),
    ('/for-nonprofits', 'Fundraising For Nonprofits', 'AI-powered donation pages, donor insights, events, grants, and reporting for nonprofits.'),
    ('/for-donors', 'Giving For Donors', 'Find trusted campaigns, give quickly, and follow the impact of your donations.'),
    ('/for-individuals', 'Personal Fundraising', 'Raise money for medical bills, emergencies, education, memorials, and community needs.'),
    ('/ai-fundraising', 'AI Fundraising', 'Use AI to write campaign stories, find growth opportunities, and improve donor outreach.'),
    ('/ai-campaign', 'AI Campaign Builder', 'Create high-converting fundraising campaigns with AI-guided copy, media, and launch tools.'),
    ('/events', 'Fundraising Events', 'Create, promote, and discover fundraising events connected to CharitMe campaigns.'),
    ('/grants', 'Fundraising Grants', 'Find grant opportunities and manage applications for nonprofit and community fundraising.'),
    ('/matching', 'Donation Matching', 'Connect campaigns with corporate matching gifts and sponsor-funded donation matches.'),
    ('/volunteer', 'Volunteer Opportunities', 'Discover volunteer opportunities connected to causes and nonprofit fundraising campaigns.'),
    ('/sponsor', 'Campaign Sponsorships', 'Find sponsorship opportunities and fund campaigns with clear benefits and impact.'),
    ('/impact', 'Impact Reporting', 'See how campaigns use donations through transparent plans, updates, and outcomes.'),
    ('/leaderboard', 'Fundraising Leaderboard', 'Track leading CharitMe campaigns and donors by fundraising momentum and impact.'),
    ('/blog', 'Fundraising Blog', 'Read fundraising strategy, donor growth guidance, nonprofit tips, and CharitMe updates.'),
    ('/success-stories', 'Fundraising Success Stories', 'Learn from successful campaigns and real fundraising playbooks on CharitMe.'),
    ('/fast-payouts', 'Fast Fundraising Payouts', 'Understand CharitMe payout timing, payment processing, and organizer fund access.'),
    ('/fees', 'Fundraising Fees', 'Compare CharitMe platform fees, processing fees, and donor-supported fundraising costs.'),
    ('/transparency', 'Fundraising Transparency', 'Review CharitMe trust signals, campaign transparency, donations, and accountability tools.'),
    ('/trust-safety', 'Trust And Safety', 'Learn how CharitMe protects donors, organizers, campaigns, and platform integrity.'),
    ('/help', 'CharitMe Help Center', 'Get answers about fundraising, donations, payouts, campaign setup, and account support.'),
    ('/faq', 'CharitMe FAQ', 'Find quick answers to common CharitMe fundraising, donation, and payout questions.'),
    ('/contact', 'Contact CharitMe', 'Contact CharitMe for fundraising support, partnerships, press, and platform questions.'),
    ('/about-us', 'About CharitMe', 'Learn about CharitMe and the mission to make fundraising faster, trusted, and more accessible.'),
    ('/supported-countries', 'Supported Countries', 'See where CharitMe fundraising, donations, and payouts are supported.'),
    ('/privacy', 'Privacy Policy', 'Read the CharitMe privacy policy for donors, organizers, nonprofits, and visitors.'),
    ('/terms', 'Terms Of Service', 'Read the CharitMe terms that govern fundraising, donations, campaigns, and platform use.'),
    ('/security', 'Security', 'Review CharitMe security practices for fundraising accounts, donations, and platform data.'),
    ('/refunds', 'Refund Policy', 'Understand CharitMe donation refund policy, eligibility, and support process.'),
    ('/prohibited-use', 'Prohibited Use Policy', 'Review prohibited fundraising categories and platform integrity rules for CharitMe.')
), missing as (
  select r.route, r.title, r.meta_description
  from routes r
  where not exists (select 1 from seo_settings s where s.route = r.route)
)
insert into seo_settings (
  route, title, meta_description, og_title, og_description, og_image_url,
  canonical_url, noindex
)
select
  route,
  title,
  meta_description,
  title,
  meta_description,
  'https://www.charitme.com/opengraph-image',
  case when route = '/' then 'https://www.charitme.com' else 'https://www.charitme.com' || route end,
  false
from missing;
