import { describe, expect, it } from 'vitest';
import { getFeatureCoverage, PLATFORM_MODULES, REQUIRED_COMPETITOR_FEATURES } from '../lib/feature-catalog';

const requiredFeatures = [
  'GoFundMe:Campaign Creation Wizard',
  'GoFundMe:Donation Checkout',
  'GoFundMe:Social Sharing',
  'GoFundMe:Progress Bar',
  'GoFundMe:Campaign Updates',
  'GoFundMe:Beneficiary Setup',
  'GoFundMe:Mobile Experience',
  'GoFundMe:Donor Comments',
  'GoFundMe:Trust & Safety',
  'GoFundMe:Organizer Dashboard',
  'Kickstarter:Reward Tiers',
  'Kickstarter:Project Storytelling',
  'Kickstarter:Funding Goals',
  'Kickstarter:Project Discovery',
  'Kickstarter:Video Support',
  'Kickstarter:Creator Profiles',
  'Kickstarter:Campaign Deadlines',
  'Kickstarter:Community Updates',
  'Kickstarter:Backer Community',
  'Kickstarter:Category Browsing',
  'Indiegogo:Flexible Funding',
  'Indiegogo:Fixed Funding',
  'Indiegogo:Product Launch Support',
  'Indiegogo:InDemand Campaigns',
  'Indiegogo:Perk System',
  'Indiegogo:Campaign Analytics',
  'Indiegogo:Global Payments',
  'Patreon:Recurring Memberships',
  'Patreon:Membership Tiers',
  'Patreon:Exclusive Content',
  'Patreon:Community Posts',
  'Patreon:Direct Messaging',
  'Patreon:Analytics Dashboard',
  'Patreon:Mobile App',
  'Patreon:Discord Integration',
  'Patreon:Membership Billing',
  'Patreon:Creator Pages',
  'Givebutter:Donation Forms',
  'Givebutter:Recurring Donations',
  'Givebutter:Fundraising Events',
  'Givebutter:Auctions',
  'Givebutter:CRM Tools',
  'Givebutter:Team Fundraising',
  'Givebutter:Livestream Fundraising',
  'Givebutter:Text-to-Donate',
  'Givebutter:Email Marketing',
  'Givebutter:Donor Analytics',
  'Donorbox:Donation Forms',
  'Donorbox:Recurring Donations',
  'Donorbox:Donor Management',
  'Donorbox:Tax Receipts',
  'Donorbox:Peer-to-Peer Fundraising',
  'Donorbox:Event Ticketing',
  'Donorbox:Membership Management',
  'Donorbox:Goal Meter',
  'Donorbox:Payment Integrations',
  'Donorbox:Multi-Currency Support',
  'Classy:Enterprise Fundraising',
  'Classy:Donor CRM',
  'Classy:Peer-to-Peer Campaigns',
  'Classy:Event Fundraising',
  'Classy:Recurring Giving',
  'Classy:Analytics & Reporting',
  'Classy:Campaign Templates',
  'Classy:Team Management',
  'Classy:API Integrations',
  'Classy:Donation Checkout',
  'Mightycause:Fundraising Pages',
  'Mightycause:Giving Days',
  'Mightycause:Donation Processing',
  'Mightycause:Peer Fundraising',
  'Mightycause:Recurring Donations',
  'Mightycause:Event Registration',
  'Mightycause:Donor CRM',
  'Mightycause:Team Campaigns',
  'Mightycause:Reporting Tools',
  'Mightycause:Nonprofit Profiles',
  'Ko-fi:One-Time Tips',
  'Ko-fi:Memberships',
  'Ko-fi:Digital Downloads',
  'Ko-fi:Commissions',
  'Ko-fi:Goal Tracking',
  'Ko-fi:Shop Functionality',
  'Ko-fi:Donation Buttons',
  'Ko-fi:Creator Feed',
  'Ko-fi:Custom Branding',
  'Ko-fi:Mobile-Friendly UX',
  'Buy Me a Coffee:One-Time Support',
  'Buy Me a Coffee:Memberships',
  'Buy Me a Coffee:Creator Pages',
  'Buy Me a Coffee:Digital Product Sales',
  'Buy Me a Coffee:Supporter Messages',
  'Buy Me a Coffee:Embedded Buttons',
  'Buy Me a Coffee:Simple Checkout',
  'Buy Me a Coffee:Email Collection',
  'Buy Me a Coffee:Mobile Optimization',
  'Buy Me a Coffee:Creator Analytics',
];

describe('feature catalog', () => {
  it('covers every requested competitor feature', () => {
    for (const feature of requiredFeatures) {
      expect(REQUIRED_COMPETITOR_FEATURES).toContain(feature);
    }
  });

  it('maps every product module to concrete database tables', () => {
    expect(PLATFORM_MODULES.length).toBeGreaterThanOrEqual(6);
    for (const platformModule of PLATFORM_MODULES) {
      expect(platformModule.databaseTables.length).toBeGreaterThan(0);
      expect(platformModule.features.length).toBeGreaterThan(0);
    }
  });

  it('reports aggregate coverage', () => {
    const coverage = getFeatureCoverage();
    expect(coverage.featureCount).toBe(REQUIRED_COMPETITOR_FEATURES.length);
    expect(coverage.competitors.map((competitor) => competitor.name)).toContain('KindFund');
  });
});
