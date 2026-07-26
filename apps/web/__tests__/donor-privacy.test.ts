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
