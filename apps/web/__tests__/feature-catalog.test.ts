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
// Peer-to-peer was claimed for three competitors while unbuilt.
//
// `peer_fundraisers` is a purpose-built table — parent_campaign_id, slug, goal,
// raised — holding 240 rows in production with ZERO `.from()` call sites, and
// there is no alternate implementation (nothing in app code references a parent
// campaign). Team fundraising is a different feature and IS wired
// (`team_members`), so the two must not be conflated.
//
// The module-level honesty check could not catch this: it flags a module only
// when NONE of its tables are wired, and nonprofit-suite has most of them. That
// is what `scripts/audit-orphan-tables.mjs` exists to find — it crosses live row
// counts against real call sites.
// ─────────────────────────────────────────────────────────────────────────────
describe('peer-to-peer is not counted as shipped', () => {
  const p2p = PLATFORM_MODULES.flatMap((m) =>
    m.features.filter((f) => /peer/i.test(f.name)).map((f) => ({ module: m, feature: f })),
  );

  it('finds the peer-to-peer entries', () => {
    // Non-vacuity: if the names change, this test must fail rather than pass empty.
    expect(p2p.length).toBe(3);
    expect(p2p.map((x) => x.feature.competitor).sort()).toEqual(['Classy', 'Donorbox', 'Mightycause']);
  });

  it('marks every one of them planned', () => {
    for (const { feature } of p2p) {
      expect(feature.planned, `${feature.competitor}:${feature.name}`).toBe(true);
    }
  });

  it('keeps them out of the built count', () => {
    const byName = new Map(getFeatureCoverage().competitors.map((c) => [c.name, c]));
    for (const competitor of ['Donorbox', 'Classy', 'Mightycause']) {
      expect(byName.get(competitor)!.fullParity, competitor).toBe(false);
    }
  });

  it('does not confuse peer fundraising with team fundraising', () => {
    // Team fundraising is genuinely built on `team_members`; only P2P is unbuilt.
    const team = PLATFORM_MODULES.flatMap((m) => m.features).filter((f) => /team/i.test(f.name));
    expect(team.length).toBeGreaterThan(0);
    for (const f of team) expect(f.planned, f.name).not.toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GoFundMe parity: verify "built" against the code, not just the flag.
//
// The catalog's `planned` flag is maintained by hand — its own doc says to
// clear it "only when a real route, API and UI read those tables". The tests
// above check the ARITHMETIC of built-vs-mapped; none check that a feature
// marked built actually exists. So deleting ShareButtons.tsx would leave
// /features advertising Social Sharing as shipped, with every count still
// green.
//
// Audited 2026-07-28: all ten GoFundMe parity entries are genuinely built.
// (Two earlier "missing" readings were my own wrong guesses at names — donor
// comments live in `donor_messages`, not `campaign_comments`. Guessing an
// identifier and reporting absence is how a working feature gets declared
// broken, so the evidence below is by real path.)
// ─────────────────────────────────────────────────────────────────────────────
describe('every GoFundMe parity feature has code behind it', () => {
  const WEB = join(__dirname, '..');
  const exists = (p: string) => existsSync(join(WEB, p));

  // Feature name in the catalog → a file that would not exist if it were unbuilt.
  const EVIDENCE: Record<string, string[]> = {
    'Campaign Creation Wizard': ['app/create/page.tsx', 'lib/wizard-steps.ts'],
    'Donation Checkout':        ['app/api/donations/route.ts', 'lib/stripe.ts'],
    'Social Sharing':           ['app/campaigns/[slug]/ShareButtons.tsx'],
    'Progress Bar':             ['components/ui.tsx'],
    'Campaign Updates':         ['app/dashboard/updates/page.tsx'],
    'Beneficiary Setup':        ['app/beneficiary/accept/page.tsx'],
    'Mobile Experience':        ['scripts/audit-responsive.mjs'],
    'Donor Comments':           ['app/campaigns/[slug]/CommentForm.tsx', 'app/campaigns/[slug]/CommentsList.tsx'],
    'Trust & Safety':           ['app/trust-safety/page.tsx', 'lib/trust-signals.ts'],
    'Organizer Dashboard':      ['app/dashboard/page.tsx'],
  };

  // REQUIRED_COMPETITOR_FEATURES is a list of "Competitor:Name" STRINGS; the
  // objects live on the modules, so the entries come from there.
  const gofundme = PLATFORM_MODULES.flatMap((m) =>
    m.features.filter((f) => f.competitor === 'GoFundMe').map((f) => ({ ...f, module: m })),
  );

  it('is reading real entries, not an empty list', () => {
    // Guards the assertions below against silently passing on nothing — the
    // first version of this block filtered the string array and matched zero.
    expect(gofundme.length).toBe(10);
  });

  it('tracks exactly the ten GoFundMe features the evidence map covers', () => {
    expect(gofundme.map((f) => f.name).sort()).toEqual(Object.keys(EVIDENCE).sort());
  });

  it('has real code for every GoFundMe feature not marked planned', () => {
    for (const feature of gofundme) {
      if (feature.planned) continue;
      for (const path of EVIDENCE[feature.name]) {
        expect(exists(path), `"${feature.name}" is claimed built but ${path} is missing`).toBe(true);
      }
    }
  });

  it('claims no GoFundMe feature as planned-but-unbuilt right now', () => {
    // Pins the audited state. If a future entry is added as planned, this fails
    // and forces the parity claim on /features to be re-stated honestly.
    expect(gofundme.filter((f) => f.planned).map((f) => f.name)).toEqual([]);
  });

  it('backs donor comments with the table the code actually reads', () => {
    // donor_messages, NOT campaign_comments — the name that made this look absent.
    const form = readFileSync(join(WEB, 'app/campaigns/[slug]/CommentForm.tsx'), 'utf8');
    const list = readFileSync(join(WEB, 'app/campaigns/[slug]/CommentsList.tsx'), 'utf8');
    expect(form + list).toMatch(/donor_messages|\/api\/campaigns\//);
  });
});
