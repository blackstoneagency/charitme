import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// `peer_fundraisers` shipped a full schema (FKs to campaigns and profiles, RLS, a
// parent-campaign index) and 240 seeded rows, and lib/feature-catalog.ts listed it
// as a backing table for a module marked 'Production Ready' — while no code in the
// app ever read it. `npm run audit:orphan-tables` found it.
//
// The catalog file already states the standard it was held to, in a comment
// explaining why 'auctions' is deliberately NOT listed: "there is no auction API,
// lib or UI — only tables. A 'Production Ready' module must not advertise a
// capability this same file says is unbuilt." This test holds peer-to-peer to that
// same rule, from the other side — the claim stays, so the reader has to.

const WEB_ROOT = join(__dirname, '..');
const PAGE = join(WEB_ROOT, 'app', 'campaigns', '[slug]', 'page.tsx');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

describe('peer-to-peer fundraising is wired, not just seeded', () => {
  const sources = [
    ...walk(join(WEB_ROOT, 'app')),
    ...walk(join(WEB_ROOT, 'lib')),
    ...walk(join(WEB_ROOT, 'components')),
  ];

  it('some application file actually reads the peer_fundraisers table', () => {
    const readers = sources.filter((f) =>
      /\.from\(\s*['"]peer_fundraisers['"]\s*\)/.test(readFileSync(f, 'utf8')),
    );
    // The exact reader may move; that there is at least one is the invariant.
    expect(readers.length).toBeGreaterThan(0);
  });

  it('the feature catalog only claims peer_fundraisers while a reader exists', () => {
    const catalog = readFileSync(join(WEB_ROOT, 'lib', 'feature-catalog.ts'), 'utf8');
    const claimed = catalog.includes("'peer_fundraisers'");
    const hasReader = sources.some((f) =>
      /\.from\(\s*['"]peer_fundraisers['"]\s*\)/.test(readFileSync(f, 'utf8')),
    );
    // Fails in both directions: dropping the reader while keeping the claim, and
    // (harmlessly but visibly) keeping a reader nothing advertises.
    expect(claimed).toBe(hasReader);
  });

  const page = readFileSync(PAGE, 'utf8');
  const query = page.slice(
    page.indexOf('async function getTeamFundraisers'),
    page.indexOf('type SimilarCampaign'),
  );

  it('reads the query block it is asserting against', () => {
    // Guards the slice above from silently becoming empty if the function is
    // renamed or moved — an empty string passes every `not.toContain` below.
    expect(query.length).toBeGreaterThan(200);
    expect(query).toContain("from('peer_fundraisers')");
  });

  it('excludes paused pages, which are supporters opting out of collecting', () => {
    expect(query).toContain("'active'");
    expect(query).toContain("'completed'");
    expect(query).not.toMatch(/\bin\([^)]*'paused'/);
  });

  it('gates the supporter name and avatar on their profile visibility setting', () => {
    // Same two-gate rule the donor wall applies. A supporter who turned off
    // Profile Visibility must not be named by this section either.
    expect(query).toContain('show_public_profile');
    // Both fields, asserted separately. A single `/isPublic\s*\?/` passes while the
    // name is ungated as long as the avatar still is — verified by breaking each in
    // turn, which is how this weaker version was caught.
    expect(query).toMatch(/name:\s*isPublic\s*\?/);
    expect(query).toMatch(/avatarUrl:\s*isPublic\s*\?/);
  });

  it('checks the query error rather than treating a failed read as an empty team', () => {
    expect(query).toMatch(/const\s*\{\s*data,\s*error\s*\}/);
    expect(query).toMatch(/if\s*\(error\)/);
  });

  it('bounds the read', () => {
    expect(query).toMatch(/\.limit\(\d+\)/);
  });
});
