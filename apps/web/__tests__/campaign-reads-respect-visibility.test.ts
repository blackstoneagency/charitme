import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// A public read of `campaigns` must respect what the owner made private.
//
// Four instances of this were found by hand on 2026-08-04, all on the campaign
// path, none visible to any of the six runtime audits — they check how a page
// LOOKS, never what it is permitted to SHOW:
//
//   · get-campaign.ts      a private campaign fully readable at its public URL
//   · trust-signals.ts     private + deleted counted into a public trust number
//   · api/…/qr-poster      a shareable poster generated for a private campaign
//   · embed generateMetadata  a private campaign's name in a 404 <title>
//
// ⚠️ This cannot be a blanket rule, which is why it is an allowlist rather than
// a ban. Owner-scoped reads MUST return private campaigns — hiding someone's own
// draft from their dashboard is the bug, not the fix. A sweep that ignored that
// distinction would have "fixed" six correct files.
//
// ⚠️ Nor can it match one spelling. The embed page checks visibility manually and
// correctly; an earlier sweep that looked only for `applyVisibilityFilters`
// reported it as unprotected. Any of the accepted forms below counts.
// ─────────────────────────────────────────────────────────────────────────────

const WEB = join(__dirname, '..');

/** Reads that legitimately see private campaigns, and why. */
const OWNER_SCOPED: Readonly<Record<string, string>> = {
  'app/donor/page.tsx': 'the signed-in donor’s own activity',
  'app/profile/page.tsx': 'the signed-in user’s own profile',
  'app/welcome/page.tsx': 'onboarding for the signed-in owner',
  'lib/tax-server.ts': 'the requesting user’s own tax documents',
  'lib/beneficiary-data.ts': 'campaigns naming the signed-in user as beneficiary',
  'lib/donation-form-access.ts': 'ownership check — must see the private row to authorise',
  'lib/nonprofit-data.ts': 'only imported by the auth-gated /dashboard/nonprofit',
  'lib/giving-days-server.ts': 'scoped by user_id to the owner',
  'lib/sponsorships.ts': 'ids the viewer already holds from their sponsorship rows',
  'lib/referrals.ts': 'ids the viewer already holds from their referral rows',
  'lib/marketing-engine.ts': 'internal marketing engine, not a public surface',
  'lib/marketing-command-center.ts': 'internal admin surface',
  'lib/demo-data-admin.ts': 'super-admin demo review intentionally includes private and archived campaigns',
  'lib/marketing-opportunities.ts': 'internal admin surface',
  'lib/ai-context.ts': 'internal AI context builder, admin-gated',
  'lib/contact-page.ts': 'internal contact routing',
  'app/status/page.tsx': 'health probe: select(id).limit(1), exposes no fields',
  'lib/query-timeout.ts': 'matched on a comment, not a read',
  'lib/trust-scores.ts': 'internal scoring input',
  'lib/marketing-goals.ts': 'internal marketing metrics, admin-gated',
  'app/api/status/route.ts': 'health probe, exposes no campaign fields',
  'app/api/stripe/webhook/route.ts': 'signature-verified by stripe.webhooks.constructEvent',
  // Steps 9–12 name the campaign the reader has DEMONSTRABLY just paid for: the
  // id comes from metadata our own server wrote into a Stripe checkout session,
  // and reaching it requires presenting that session's `cs_...` id for a
  // payment Stripe reports as paid. A private campaign is still donatable by
  // direct link, so filtering it out here would blank the title on the receipt
  // for a donation that really happened. The read selects id/title/slug only.
  'lib/donation-outcome-server.ts': 'the donor’s own completed payment, keyed by a Stripe session id',
  // AI helpers: generate suggestions for a campaign id supplied by the caller.
  // Rate-limited and non-enumerating, and they return advice rather than the
  // campaign's content. Flagged here as a deliberate, reviewed decision rather
  // than an oversight — revisit if any starts echoing campaign fields back.
  'app/api/ai/donation-impact/route.ts': 'AI advice, returns no campaign content',
  'app/api/ai/donor-conversion/route.ts': 'AI advice, returns no campaign content',
  'app/api/ai/goal-recommend/route.ts': 'AI advice, returns no campaign content',
  'app/api/campaigns/goal-guidance/route.ts': 'AI advice, returns no campaign content',
};

/** Any of these means the read considered visibility. Spelling-agnostic. */
const RESPECTS = [
  'applyVisibilityFilters', 'applyLiveFilters',
  "neq('visibility'", 'neq("visibility"',
  "eq('visibility'", 'eq("visibility"',
  "visibility === 'private'", 'visibility === "private"',
];

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules' || e === '.next' || e === '__tests__') continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (/\.tsx?$/.test(e)) out.push(p);
    }
  };
  for (const d of ['app', 'lib']) walk(join(WEB, d));
  return out;
}

describe('public campaign reads respect visibility', () => {
  const offenders: string[] = [];
  for (const f of sourceFiles()) {
    const src = readFileSync(f, 'utf8');
    if (!/from\(\s*['"]campaigns['"]\s*\)/.test(src)) continue;
    const rel = f.slice(WEB.length + 1).replaceAll('\\', '/');
    // Admin and dashboard surfaces are authorised elsewhere by design.
    if (rel.startsWith('app/admin/') || rel.startsWith('app/dashboard/') || rel.startsWith('app/api/admin/')) continue;
    if (rel in OWNER_SCOPED) continue;
    // ⚠️ Authenticated reads are out of scope, and that is the threat model, not
    // a convenience. All four real findings were reachable with NO credential.
    // A route behind `requireUser` reads on behalf of a signed-in person and is
    // authorised by its own ownership checks — demanding a visibility filter
    // there would hide a user's own draft from their dashboard. An earlier
    // version of this guard omitted that and flagged ~40 correct routes.
    if (/requireUser|getUser\(|requireApiKey|verifyAdmin|verifySuperAdmin|guardSuperAdmin|requireAdmin/.test(src)) continue;
    if (RESPECTS.some((p) => src.includes(p))) continue;
    offenders.push(rel);
  }

  it('finds campaign reads to check', () => {
    // Without this the assertion below could pass by matching nothing at all.
    expect(sourceFiles().length).toBeGreaterThan(200);
  });

  it('has no public campaign read that ignores visibility', () => {
    expect(
      offenders,
      'reads `campaigns` on a public surface without considering `visibility` — ' +
        'a campaign the owner set to private would be exposed. Apply a filter, or ' +
        'add the file to OWNER_SCOPED with the reason it legitimately sees private rows',
    ).toEqual([]);
  });
});
