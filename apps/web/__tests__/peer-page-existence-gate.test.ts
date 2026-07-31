import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Supporter-page existence gate (soft-404 fix).
//
// `notFound()` inside a page cannot change the HTTP status once a parent
// `loading.tsx` has opened a Suspense boundary — Next has already committed 200
// and streamed the skeleton. The page then renders 404 UI under a 200, which
// crawlers index as a real page.
//
// MEASURED, not theorised. With `[slug]/loading.tsx` in its original position:
//     wrong campaign → 200 · unknown peer → 200 · unknown campaign → 404
// The last one was already correct because `[slug]/layout.tsx` runs OUTSIDE the
// boundary. Removing that loading.tsx turned all three into 404s, which
// identified it as the cause. The fix moves the skeleton into a `(detail)` route
// group so it wraps only the campaign detail page, not sibling routes. Route
// groups do not affect URLs, so `/campaigns/x/team/y` is unchanged.
//
// This test guards the STRUCTURE, because the failure is invisible in review:
// putting loading.tsx back one directory up compiles, renders, and quietly
// reintroduces soft-404s on every supporter page.
// ─────────────────────────────────────────────────────────────────────────────

const CAMPAIGN_SLUG_DIR = join(__dirname, '..', 'app', 'campaigns', '[slug]');
const TEAM_DIR = join(CAMPAIGN_SLUG_DIR, 'team', '[peerSlug]');

describe('supporter page returns real 404s', () => {
  it('keeps the campaign skeleton scoped to the (detail) route group', () => {
    expect(
      existsSync(join(CAMPAIGN_SLUG_DIR, '(detail)', 'loading.tsx')),
      'the campaign skeleton must live in (detail)/ so sibling routes do not inherit its Suspense boundary',
    ).toBe(true);

    expect(
      existsSync(join(CAMPAIGN_SLUG_DIR, 'loading.tsx')),
      'a loading.tsx directly under [slug]/ wraps team/[peerSlug] too and silently ' +
        'reintroduces soft-404s (measured: wrong campaign answered 200)',
    ).toBe(false);
  });

  it('gates the supporter page from a layout, not only the page body', () => {
    const layout = join(TEAM_DIR, 'layout.tsx');
    expect(existsSync(layout), 'team/[peerSlug]/layout.tsx is the existence gate').toBe(true);
    const src = readFileSync(layout, 'utf8');
    expect(src).toContain('assertPeerPageExists');
  });

  it('scopes the peer lookup to the campaign in the URL', () => {
    // peer_fundraisers.slug is UNIQUE platform-wide, so without this filter the
    // same supporter page renders under every campaign slug, each with a donate
    // button pointing at a campaign they never signed up to raise for.
    const src = readFileSync(join(TEAM_DIR, 'get-peer.ts'), 'utf8');
    expect(src).toMatch(/\.eq\(\s*['"]parent_campaign_id['"]/);
    expect(src).toContain('notFound');
  });
});
