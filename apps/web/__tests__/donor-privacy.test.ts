import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// A donor who sets Profile Visibility to Private must not be named publicly.
//
// Settings describes that control as governing "who can see your giving activity
// on the leaderboard and donor walls". /donors/[id] honoured it — but the two
// surfaces named in that sentence did not:
//
//   • lib/leaderboard.ts returned the donor's real full_name and avatar_url
//     regardless, passing showPublicProfile through as a flag. The UI used the
//     flag only to drop the hyperlink, so the name still rendered — and still
//     shipped inside the server-rendered HTML, visible in view-source even if it
//     had been hidden with CSS.
//   • the campaign donor-wall route keyed naming off `anonymous` alone.
//
// Both now anonymize at the source. These assertions read the source rather than
// executing the queries, because both functions need a live database; the point
// is to pin that the flag is consulted where identity is assembled.
// ─────────────────────────────────────────────────────────────────────────────

const APP_WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(APP_WEB_ROOT, p), 'utf8');

describe('private donors are not named publicly', () => {
  it('the leaderboard gates name and avatar on show_public_profile', () => {
    const src = read('lib/leaderboard.ts');
    // The identity fields must be conditional on the visibility flag, not raw.
    expect(src, 'leaderboard must derive an isPublic gate').toMatch(/const isPublic\s*=/);
    expect(src, 'name must be gated by isPublic').toMatch(/name:\s*isPublic\s*\?/);
    expect(src, 'avatarUrl must be gated by isPublic').toMatch(/avatarUrl:\s*isPublic\s*\?/);
    // The pre-fix shape returned full_name unconditionally.
    expect(src).not.toMatch(/name:\s*profile\?\.full_name\s*\|\|\s*'Generous Donor',/);
  });

  it('the campaign donor wall hides identity for private donors', () => {
    const src = read('app/api/campaigns/[id]/donations/route.ts');
    expect(src, 'wall must combine anonymous with the visibility flag').toMatch(/hideIdentity\s*=\s*d\.anonymous\s*\|\|\s*!isPublic/);
    expect(src, 'avatar must use the combined gate').toMatch(/avatarUrl:\s*hideIdentity\s*\?/);
    expect(src, 'donorId must use the combined gate').toMatch(/donorId:\s*hideIdentity\s*\?/);
    // The pre-fix shape keyed avatar and donorId off `anonymous` alone.
    expect(src).not.toMatch(/avatarUrl:\s*d\.anonymous\s*\?\s*null/);
  });

  it('the donor profile page still 404s for private donors', () => {
    // This half already worked; pin it so a refactor cannot quietly drop it.
    const src = read('app/donors/[id]/page.tsx');
    expect(src).toMatch(/show_public_profile === false/);
  });
});

describe('anonymous donors are redacted in every export', () => {
  // The three export endpoints must agree. Two already did; /full dumped raw
  // rows, handing the organizer donor_id and offline_donor_name for gifts the
  // donor marked anonymous — identifiable by name for offline gifts, and by a
  // stable profile id otherwise.
  it('the full JSON export strips identity from anonymous donations', () => {
    const src = read('app/api/exports/full/route.ts');
    expect(src, 'must build a redacted list rather than passing donations through')
      .toMatch(/redactedDonations/);
    expect(src, 'anonymous rows must null donor_id and offline_donor_name')
      .toMatch(/d\.anonymous\s*\?\s*\{\s*\.\.\.d,\s*donor_id:\s*null,\s*offline_donor_name:\s*null\s*\}/);
    expect(src, 'the raw pass-through must be gone').not.toMatch(/donations:\s*donations\s*\?\?\s*\[\],/);
  });

  it('the CSV exports already name anonymous donors "Anonymous"', () => {
    expect(read('app/api/exports/donations/route.ts')).toMatch(/d\.anonymous\s*\?\s*'Anonymous'/);
    const donors = read('app/api/exports/donors/route.ts');
    expect(donors).toMatch(/isAnon\s*=\s*d\.anonymous\s*\|\|\s*!d\.donor_id/);
    expect(donors, 'anonymous rows must carry no email').toMatch(/email:\s*isAnon\s*\?\s*''/);
  });
});

describe('unpublished campaigns are owner-only', () => {
  it('the detail page gates drafts on ownership, like private campaigns', () => {
    // POST /api/campaigns documents status 'draft' as "saves without
    // publishing". Nothing gated on it, so a draft rendered in full at its
    // public URL to anyone holding or guessing the slug (slugs derive from the
    // title). Listings and the sitemap already excluded drafts via
    // applyLiveFilters, making the detail page the one reachable surface.
    const src = read('app/campaigns/[slug]/page.tsx');
    expect(src, 'drafts must be gated').toMatch(/campaign\.status === 'draft'/);
    // Gated on ownership, not blanket-404'd — the owner must still preview.
    const draftBlock = src.slice(src.indexOf("campaign.status === 'draft'"));
    expect(draftBlock.slice(0, 200), 'owner must still see their own draft')
      .toMatch(/user\.id !== campaign\.user_id/);
  });

  it('does not block completed or archived campaigns', () => {
    // People link to finished fundraisers; only 'draft' is unpublished.
    const src = read('app/campaigns/[slug]/page.tsx');
    expect(src).not.toMatch(/campaign\.status !== 'active'[\s\S]{0,60}notFound/);
    expect(src).not.toMatch(/campaign\.status === 'completed'[\s\S]{0,60}notFound/);
  });
});

describe('the campaign page applies the same gates as the API', () => {
  // There are TWO copies of the donor-wall mapping: this page builds the initial
  // server-rendered wall, and /api/campaigns/[id]/donations serves pagination.
  // Fixing only the API left a private donor's name in the page HTML on first
  // load — the leak survived the first fix because the copies disagreed.
  const page = read('app/campaigns/[slug]/page.tsx');

  it('toWallDonation gates on show_public_profile, not just anonymous', () => {
    expect(page, 'must derive an isPublic gate').toMatch(/const isPublic\s*=\s*profile\.show_public_profile/);
    expect(page, 'must combine both gates').toMatch(/hideIdentity\s*=\s*d\.anonymous\s*\|\|\s*!isPublic/);
    expect(page, 'the anonymous-only avatar rule must be gone')
      .not.toMatch(/avatarUrl:\s*d\.anonymous\s*\?\s*null\s*:\s*\(profile\.avatar_url/);
  });

  it('the donor message wall selects and applies the visibility flag', () => {
    expect(page, 'the query must fetch show_public_profile for messages')
      .toMatch(/profiles:donor_id\(full_name, avatar_url, show_public_profile\)/);
    expect(page, 'message names must consult the flag')
      .toMatch(/msgProfile\.show_public_profile/);
  });
});

describe('organizer notifications respect anonymity', () => {
  // The organizer alert (email + in-app notification) fell back to "An anonymous
  // donor" only when the profile had NO full_name. A donor who ticked "donate
  // anonymously" but had a name on file was announced by name — to the one
  // person anonymity exists to hide them from.
  const hook = read('app/api/stripe/webhook/route.ts');

  it('passes the per-gift anonymous flag into the notification', () => {
    expect(hook, 'the function must accept the flag').toMatch(/isAnonymous:\s*boolean/);
    expect(hook, 'the call site must forward meta.anonymous')
      .toMatch(/sendOrganizerDonationNotification\([^)]*meta\.anonymous === '1'\)/);
  });

  it('forces the anonymous label on either gate', () => {
    expect(hook).toMatch(/\(isAnonymous \|\| !donorIsPublic\)/);
    // The old name-presence-only fallback must be gone.
    expect(hook).not.toMatch(/const donorDisplayName = donor\?\.full_name \|\| 'An anonymous donor';/);
  });

  it('reads the account-wide visibility flag too', () => {
    expect(hook).toMatch(/select\('full_name, show_public_profile'\)/);
  });
});
