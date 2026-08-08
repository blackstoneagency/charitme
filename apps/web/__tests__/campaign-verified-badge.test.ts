import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// The campaign page's "✓ Verified" chip was rendered UNCONDITIONALLY: every
// campaign claimed a verified organizer whether or not anything had been
// verified, in the exact spot a donor looks before trusting a stranger with
// money.
//
// This is a source-level guard because the page is a server component that
// queries Supabase, so it cannot be rendered here — and the alternative to a
// source guard is no guard at all. It is deliberately narrow: it asserts the
// badge is inside a conditional on a real signal, not how it looks.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE = join(__dirname, '..', 'app', 'campaigns', '[slug]', '(detail)', 'page.tsx');
const source = readFileSync(PAGE, 'utf8');

describe('the campaign page reads the source it is guarding', () => {
  it('finds the organizer row', () => {
    // Fails loudly if the page moves, rather than silently guarding nothing.
    expect(source).toContain('Organized by');
  });
});

describe('the Verified badge is earned, not decorative', () => {
  it('renders only when the organizer is actually verified', () => {
    expect(source).toContain('organizerVerified &&');
  });

  it('is never emitted outside that conditional', () => {
    // ⚠️ Match the RENDERED badge, not the string. An earlier version of this
    // test searched for "✓ Verified" and matched the explanatory comment above
    // the code — which sits before the guard, so the test failed on correct
    // code. The JSX form is what actually reaches a donor's screen.
    const RENDERED = />✓ Verified<\/span>/g;
    const occurrences = [...source.matchAll(RENDERED)];
    expect(occurrences.length, 'expected exactly one rendered Verified badge').toBe(1);

    const badgeIndex = occurrences[0]!.index!;
    const guardIndex = source.lastIndexOf('organizerVerified &&', badgeIndex);
    expect(guardIndex, 'rendered badge is not guarded by organizerVerified').toBeGreaterThan(-1);
    // The guard must be close by — not somewhere else entirely in the file.
    expect(badgeIndex - guardIndex).toBeLessThan(400);
  });

  it('derives the flag from profiles.identity_verified', () => {
    expect(source).toContain('identity_verified');
    expect(source).toContain('getOrganizerVerified');
  });

  it('fails toward showing NO badge when the answer is unknown', () => {
    // Under-claiming trust is the safe direction. A `catch` that returned true,
    // or a `?? true`, would restore the original problem on any read failure.
    expect(source).not.toMatch(/identity_verified\s*\?\?\s*true/);
    expect(source).toContain('=== true');
  });
});

describe('the campaign path is presented as a self-declaration', () => {
  it('labels a nonprofit campaign as self-declared', () => {
    // Nobody checks this answer in the builder, so the wording must not borrow
    // the authority of the verified badge sitting beside it.
    expect(source).toContain('Nonprofit — self-declared');
  });

  it('does not call a self-declared nonprofit "verified"', () => {
    expect(source).not.toContain('Verified nonprofit');
    expect(source).not.toContain('Verified Nonprofit');
  });

  it('renders nothing extra for a personal campaign', () => {
    // 'personal' is the default and carries no information worth a chip.
    expect(source).toContain("campaignPath === 'nonprofit'");
    expect(source).toContain("campaignPath === 'team'");
    expect(source).not.toContain("campaignPath === 'personal' &&");
  });

  it('treats a missing campaign_path as personal', () => {
    // Absent on every campaign predating step 1, and on any deployment where
    // the migration has not been applied. Neither may render a nonprofit claim.
    expect(source).toMatch(/campaign_path\s*\?\?\s*'personal'/);
  });
});
