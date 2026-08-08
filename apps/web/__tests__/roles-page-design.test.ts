import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROLE_DEFINITIONS, ROLE_ORDER } from '../lib/role-capabilities';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, '..', p), 'utf8');

const page = read('app/roles/page.tsx');
const glyph = read('app/roles/RoleGlyph.tsx');
const css = read('app/globals.css');
/** Comments explain what was rejected, so absence checks must not read them. */
const code = page.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ─────────────────────────────────────────────────────────────────────────────
// /roles rebuilt to the supplied design: circular role mark, "Default" pill,
// permissions checklist, one card per role.
//
// ⚠️ The reference is a DIFFERENT product's role model — Account Owner, Admin,
// Manager, Editor, Viewer, with member counts and an Invite Member button. This
// product has six real roles and no team-invite on a public page. So the visual
// language is adopted and the CONTENT stays this product's own; the two things
// the reference shows that cannot be true here are asserted absent below.
// ─────────────────────────────────────────────────────────────────────────────

describe('the page renders the real roles, not the reference model', () => {
  it('drives every card from role-capabilities, with no local list', () => {
    // A hand-written role list here is how CAMPAIGN_CATEGORIES drifted three
    // ways; a roles page that disagrees with the admin console is worse than
    // none at all.
    expect(code).toMatch(/ROLE_DEFINITIONS\[role\]/);
    expect(code).not.toMatch(/const\s+\w*ROLES?\w*\s*=\s*\[/);
  });

  it('ships none of the reference role names this product does not have', () => {
    for (const invented of ['Account Owner', 'Manager', 'Editor', 'Viewer']) {
      expect(code, `"${invented}" is not a role in this product`).not.toContain(invented);
    }
  });

  it('covers all six real roles between the two sections', () => {
    expect(ROLE_ORDER.length).toBe(6);
    expect(code).toMatch(/openRoles\.map/);
    expect(code).toMatch(/staffRoles\.map/);
  });

  it('gives every role a glyph, so none renders an empty disc', () => {
    for (const role of ROLE_ORDER) {
      expect(glyph, `no glyph for ${role}`).toMatch(new RegExp(`\\b${role}:`));
    }
  });
});

describe('the two things the reference shows that cannot be true here', () => {
  it('publishes no member counts', () => {
    // Per-role member counts are not available without auth and are not
    // something to publish on a public page.
    expect(code).not.toMatch(/\bmembers?\b/i);
  });

  it('offers no Invite Member button', () => {
    // Team invites are scoped to a campaign by /api/team-members. A button here
    // would be a control that invites nobody to nothing.
    expect(code).not.toContain('Invite Member');
  });

  it('puts a real destination in that slot instead', () => {
    expect(code).toMatch(/href="\/profile" className="rl-action"/);
  });
});

describe('the checklist distinguishes a rule from a description', () => {
  it('marks only genuinely enforced capabilities', () => {
    // The reference's ticks all look alike, which would claim every line is a
    // rule. Only some are — `enforced` is what records that, and it is the
    // reason lib/role-capabilities.ts keeps meaning and enforcement apart.
    expect(code).toMatch(/cap\.enforced && <span className="rl-enforced"/);
  });

  it('and there really are both kinds, so the distinction is not decorative', () => {
    const all = ROLE_ORDER.flatMap((r) => ROLE_DEFINITIONS[r].capabilities);
    expect(all.some((c) => c.enforced), 'no enforced capability exists').toBe(true);
    expect(all.some((c) => !c.enforced), 'no advisory capability exists').toBe(true);
  });

  it('keeps the honest lede that no role is needed to fundraise', () => {
    // Removing this is how a reader concludes they must apply for "Organizer"
    // before they can raise money. They do not.
    expect(code).toMatch(/never need to request a role to raise money/);
  });
});

describe('the cards work in both themes and on a phone', () => {
  // Bounded at BOTH ends. Slicing to end-of-file swallowed whatever block was
  // appended after this one — another lane's resource-page CSS landed there on
  // a merge, and its colour literals failed the token check below, on rules this
  // page never touched. An unbounded slice makes a test fail for someone else's
  // change, which is worse than not having it.
  const start = css.indexOf('.rl-page {');
  const nextSection = css.indexOf('\n/* ', css.indexOf('.rl-enforced'));
  const block = css.slice(start, nextSection > start ? nextSection : undefined);

  it('styles with tokens, not the mock\'s literal darks', () => {
    const hardcoded = block.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(hardcoded.every((h) => h.toLowerCase() === '#fff'), `hardcoded: ${hardcoded}`).toBe(true);
  });

  it('lays the grid out with minmax, never a bare 1fr', () => {
    expect(block).toMatch(/\.rl-grid \{[^}]*repeat\(auto-fill, minmax\(min\(100%, 258px\), 1fr\)\)/);
  });

  it('reflows the three-column permission row on a phone', () => {
    // `auto minmax(0,1fr) auto` with an "enforced" pill overflows a narrow card.
    const mq = block.slice(block.indexOf('@media (max-width: 560px)'));
    expect(mq).toMatch(/\.rl-perms li \{[^}]*grid-template-columns: auto minmax\(0, 1fr\)/);
  });

  it('keeps a focus ring on the only interactive element in the header', () => {
    expect(block).toMatch(/\.rl-action:focus-visible \{[^}]*outline:/);
  });

  it('falls back to a default tint for a role added later', () => {
    // data-role selectors, so a new role gets the violet disc rather than an
    // unstyled circle.
    expect(block).toMatch(/\.rl-mark \{[^}]*background: var\(--tint-violet\)/);
    expect(block).toMatch(/\.rl-card\[data-role="donor"\]/);
  });
});
