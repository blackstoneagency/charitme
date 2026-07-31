import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFeatureCoverage, isFeatureBuilt, PLATFORM_MODULES, REQUIRED_COMPETITOR_FEATURES } from '../lib/feature-catalog';

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
  // Renamed from 'Mobile App'. There is no native app in this repo (no iOS,
  // Android, Expo or React Native directory) — CharitMe is a PWA. The old name
  // read as app-store parity in a competitor table; the row now says what ships.
  'Patreon:Mobile Web Experience',
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
    expect(coverage.competitors.map((competitor) => competitor.name)).toContain('CharitMe');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Competitive coverage is a claim made to the PUBLIC on /features, so it is the
// wrong place to round up.
//
// getFeatureCoverage() used to return one `count` per competitor that included
// features marked `planned` and features belonging to whole `status: 'Planned'`
// modules — and the page printed a hardcoded green "✓ Full parity" beneath it.
// So visitors were told CharitMe had full parity with Givebutter while Auctions
// (no route, no API, no UI — the catalog says so itself) counted toward it.
// ─────────────────────────────────────────────────────────────────────────────
describe('competitive coverage counts only what ships', () => {
  const coverage = getFeatureCoverage();
  const byName = new Map(coverage.competitors.map((c) => [c.name, c]));

  it('separates what is mapped from what is built', () => {
    for (const c of coverage.competitors) {
      expect(c.built, c.name).toBeLessThanOrEqual(c.total);
      expect(c.planned, c.name).toBe(c.total - c.built);
    }
  });

  it('does not count a planned feature as shipped', () => {
    // Asserted through the mechanism rather than a named competitor: Givebutter
    // was this fixture while Auctions was unbuilt, and building auctions
    // correctly moved it to 10/10. Any feature still marked `planned` must be
    // excluded from its competitor's built count.
    for (const m of PLATFORM_MODULES) {
      for (const f of m.features) {
        if (f.planned !== true || m.status === 'Planned') continue;
        const c = byName.get(f.competitor)!;
        expect(c.built, `${f.competitor}:${f.name}`).toBeLessThan(c.total);
      }
    }
    // Givebutter's Auctions is now built, so it reaches full parity.
    expect(byName.get('Givebutter')!.fullParity).toBe(true);
  });

  it('does not count features of a wholly Planned module as shipped', () => {
    const plannedModules = PLATFORM_MODULES.filter((m) => m.status === 'Planned');
    expect(plannedModules.length).toBeGreaterThan(0);
    for (const m of plannedModules) {
      for (const f of m.features) {
        expect(isFeatureBuilt(m, f), `${m.slug}:${f.name}`).toBe(false);
      }
    }
  });

  it('claims full parity only when built equals total', () => {
    for (const c of coverage.competitors) {
      expect(c.fullParity, c.name).toBe(c.built === c.total);
    }
  });

  it('reports a shipped count strictly below the mapped count', () => {
    // If these were ever equal the distinction would be decorative.
    expect(coverage.builtFeatureCount).toBeLessThan(coverage.featureCount);
    expect(coverage.builtFeatureCount).toBeGreaterThan(0);
  });
});

describe('the public features page does not hardcode parity', () => {
  const src = readFileSync(join(__dirname, '../app/features/page.tsx'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

  it('gates the Full parity badge on the computed flag', () => {
    expect(code).toContain('competitor.fullParity ?');
  });

  it('shows shipped-of-mapped rather than a bare total', () => {
    expect(code).toContain('competitor.built');
    expect(code).toMatch(/required features shipped/);
    expect(code).not.toMatch(/\{competitor\.count\}/);
  });

  it('headlines the shipped count, not the mapped one', () => {
    expect(code).toContain('coverage.builtFeatureCount');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Peer-to-peer SHIPPED on 2026-07-29, and this block used to assert the opposite.
//
// It was written when `peer_fundraisers` held 240 production rows with ZERO
// `.from()` call sites, and it correctly forced the three competitor entries to
// stay `planned`. Both halves now exist: the read path (the Fundraising team
// section on the campaign page) and the write path
// (POST /api/campaigns/[id]/peer-fundraisers).
//
// So the guard is inverted rather than deleted. The catalog had gone stale in the
// UNDER-claiming direction — every other check in this file catches a feature
// claiming more than ships, and nothing caught one claiming less, which is exactly
// why three entries sat wrong after the feature landed.
//
// Team fundraising remains a different feature backed by `team_members`; the two
// must still not be conflated.
// ─────────────────────────────────────────────────────────────────────────────
describe('peer-to-peer ships, so it is counted and not marked planned', () => {
  const WEB = join(__dirname, '..');
  const p2p = PLATFORM_MODULES.flatMap((m) =>
    m.features.filter((f) => /peer/i.test(f.name)).map((f) => ({ module: m, feature: f })),
  );

  it('finds the peer-to-peer entries', () => {
    // Non-vacuity: if the names change, this must fail rather than pass empty.
    expect(p2p.length).toBe(3);
    expect(p2p.map((x) => x.feature.competitor).sort()).toEqual(['Classy', 'Donorbox', 'Mightycause']);
  });

  it('none of them is marked planned', () => {
    for (const { feature } of p2p) {
      expect(feature.planned, `${feature.competitor}:${feature.name}`).not.toBe(true);
    }
  });

  it('the code backing the claim actually exists — both halves', () => {
    // The claim is only honest while these do. If either is deleted, this fails and
    // the `planned` flags must go back rather than the parity number staying wrong.
    const reader = readFileSync(join(WEB, 'app', 'campaigns', '[slug]', '(detail)', 'page.tsx'), 'utf8');
    expect(reader).toMatch(/\.from\(\s*'peer_fundraisers'\s*\)/);
    expect(existsSync(join(WEB, 'app', 'campaigns', '[slug]', 'TeamFundraisers.tsx'))).toBe(true);
    expect(
      existsSync(join(WEB, 'app', 'api', 'campaigns', '[id]', 'peer-fundraisers', 'route.ts')),
    ).toBe(true);
  });
});
