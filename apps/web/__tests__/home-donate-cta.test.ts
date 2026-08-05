import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = readFileSync(join(__dirname, '..', 'app', 'page.tsx'), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// The homepage hero must offer a direct way to give.
//
// ⚠️ It did not. The hero's two actions were "Explore Causes" — an in-page
// anchor to #causes — and "See Our Impact". A visitor who landed ready to
// donate had no path to do so from the top of the page, on a fundraising
// platform. The nearest Donate Now was ~240 lines further down the document.
//
// This is invisible to every audit in this repo: the links resolved, contrast
// passed, axe passed, focus order passed. A missing call to action is not a
// defect any of them look for.
// ─────────────────────────────────────────────────────────────────────────────

/** The hero's action row, up to the closing div. */
function heroActions(): string {
  const at = page.indexOf('<div className="mirror-actions">');
  expect(at, 'hero action row not found').toBeGreaterThan(-1);
  return page.slice(at, page.indexOf('</div>', at));
}

describe('the homepage hero offers a way to give', () => {
  it('has a Donate Now action', () => {
    expect(heroActions()).toMatch(/>\s*Donate Now/);
  });

  it('points it at /campaigns', () => {
    // Not `#causes` and not `/donate`. A donation is always to a specific
    // campaign, so /campaigns is where a donor picks one — there is no single
    // donate endpoint to send them to.
    const donate = /<Link href="([^"]+)"[^>]*>\s*Donate Now/.exec(heroActions());
    expect(donate, 'Donate Now is not a Link').not.toBeNull();
    expect(donate![1]).toBe('/campaigns');
  });

  it('gives it the primary treatment, not a buried tertiary link', () => {
    // A donate CTA styled as the least prominent thing in the row is the same
    // defect wearing different clothes.
    expect(heroActions()).toMatch(/mirror-btn-primary[^>]*>\s*Donate Now/);
  });
});
