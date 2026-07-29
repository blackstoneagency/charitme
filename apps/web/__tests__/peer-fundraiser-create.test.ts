import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Peer-to-peer shipped read-first: the Fundraising team section rendered 240
// seeded rows, but nothing could CREATE one, so the feature could only ever
// display data that arrived by other means. This covers the write half.

const WEB = join(__dirname, '..');
const ROUTE = readFileSync(
  join(WEB, 'app', 'api', 'campaigns', '[id]', 'peer-fundraisers', 'route.ts'),
  'utf8',
);
const SECTION = readFileSync(join(WEB, 'app', 'campaigns', '[slug]', 'TeamFundraisers.tsx'), 'utf8');
const BUTTON = readFileSync(join(WEB, 'app', 'campaigns', '[slug]', 'JoinTeamButton.tsx'), 'utf8');

describe('joining a fundraising team', () => {
  it('reads a plausible route (guards every assertion below from vacuity)', () => {
    expect(ROUTE.length).toBeGreaterThan(500);
    expect(ROUTE).toMatch(/export async function POST/);
  });

  it('rejects unauthenticated callers before touching the database', () => {
    const authGate = ROUTE.indexOf('status: 401');
    expect(authGate).toBeGreaterThan(-1);
    expect(authGate).toBeLessThan(ROUTE.indexOf("from('peer_fundraisers')"));
  });

  it('only accepts active, public, undeleted campaigns', () => {
    expect(ROUTE).toMatch(/\.eq\(\s*'status'\s*,\s*'active'\s*\)/);
    expect(ROUTE).toMatch(/\.eq\(\s*'visibility'\s*,\s*'public'\s*\)/);
    expect(ROUTE).toMatch(/\.is\(\s*'deleted_at'\s*,\s*null\s*\)/);
  });

  it('refuses to give the organizer a peer page on their own campaign', () => {
    // It would split their total across two goals and double-count them in the
    // team list. The UI hides the control; the API must not rely on that.
    expect(ROUTE).toMatch(/campaign\.user_id === user\.id/);
    expect(ROUTE).toMatch(/status: 409/);
  });

  it('is idempotent per (campaign, user) rather than creating duplicates', () => {
    expect(ROUTE).toMatch(/\.eq\(\s*'parent_campaign_id'/);
    expect(ROUTE).toMatch(/\.eq\(\s*'fundraiser_id'\s*,\s*user\.id\s*\)/);
    expect(ROUTE).toMatch(/resumed: true/);
  });

  it('checks the existing-row query error instead of creating a duplicate', () => {
    // supabase-js resolves rather than throws: an unchecked error reads as "no
    // existing page" and inserts a second one, which the unique slug then rejects.
    expect(ROUTE).toMatch(/if\s*\(\s*existingError\s*\)/);
  });

  it('retries on slug collision rather than surfacing a 500', () => {
    // peer_fundraisers.slug is UNIQUE platform-wide, so a name-derived slug
    // collides between two supporters who share a display name.
    // Assert the CONDITIONAL, not the number: '23505' also appears in the comment
    // explaining it, so /23505/ alone still passed with the check deleted —
    // verified by replacing the branch with a bare `break`.
    expect(ROUTE).toMatch(/if\s*\(\s*error\.code\s*!==\s*'23505'\s*\)\s*break;/);
    expect(ROUTE).toMatch(/attempt < 5/);
  });

  it('offers the invitation even when the team is empty', () => {
    // Returning null on an empty team made the feature unreachable until someone
    // had already joined by other means.
    expect(SECTION).toMatch(/fundraisers\.length === 0 && !action/);
    expect(SECTION).toContain('Be the first to raise money alongside');
  });

  it('sends signed-out supporters to sign-in rather than a failing button', () => {
    expect(BUTTON).toMatch(/\/login\?next=/);
    expect(BUTTON).toMatch(/isSignedIn/);
  });
});
