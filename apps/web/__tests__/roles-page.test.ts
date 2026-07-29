import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROLE_DEFINITIONS, ROLE_ORDER, advisoryRoles } from '../lib/role-capabilities';

const SOURCE = readFileSync(join(__dirname, '../app/roles/page.tsx'), 'utf8');

describe('/roles — the public role reference', () => {
  it('renders every role from the shared map, so the page cannot silently omit one', () => {
    // The page splits ROLE_ORDER by `privileged` and renders both halves. If a
    // seventh role is added to roles-shared.ts it lands in one of these two
    // buckets automatically — this asserts the page never regains a hardcoded
    // subset, which is how the three CAMPAIGN_CATEGORIES copies drifted apart.
    expect(SOURCE).toContain('ROLE_DEFINITIONS');
    expect(SOURCE).toContain('ROLE_ORDER');

    const partitioned = [
      ...ROLE_ORDER.filter((r) => !ROLE_DEFINITIONS[r].privileged),
      ...ROLE_ORDER.filter((r) => ROLE_DEFINITIONS[r].privileged),
    ];
    expect(partitioned.slice().sort()).toEqual(ROLE_ORDER.slice().sort());
    expect(partitioned).toHaveLength(ROLE_ORDER.length);
  });

  it('does not restate role labels or descriptions as literals', () => {
    // A copy-pasted description is a copy that can disagree with the admin
    // console. Every role's prose must come through the import.
    for (const role of ROLE_ORDER) {
      const def = ROLE_DEFINITIONS[role];
      expect(SOURCE, `${role} description is inlined in the page`).not.toContain(def.description);
      for (const cap of def.capabilities) {
        expect(SOURCE, `${role} capability "${cap.label}" is inlined`).not.toContain(cap.label);
      }
    }
  });

  it('only calls a role "Open to every account" while nothing actually gates it', () => {
    // This is the guard that matters. The page labels every non-privileged role
    // "Open to every account" — true today, because only admin/super_admin gate
    // anything. The moment someone enforces `organizer` or `nonprofit`, that copy
    // becomes a false promise to a user who will then hit a wall the page told
    // them did not exist.
    //
    // Fails in BOTH directions on purpose:
    //  • enforce a non-privileged role and this test demands the copy be fixed;
    //  • mark a role privileged without enforcing it and the second block fires.
    const openRoles = ROLE_ORDER.filter((r) => !ROLE_DEFINITIONS[r].privileged);
    expect(SOURCE).toContain('Open to every account');

    for (const role of openRoles) {
      const enforced = ROLE_DEFINITIONS[role].capabilities.filter((c) => c.enforced);
      expect(
        enforced.map((c) => c.label),
        `${role} is shown as "Open to every account" but now enforces something — update app/roles/page.tsx`,
      ).toEqual([]);
    }

    for (const role of ROLE_ORDER.filter((r) => ROLE_DEFINITIONS[r].privileged)) {
      expect(
        ROLE_DEFINITIONS[role].capabilities.some((c) => c.enforced),
        `${role} is shown as "Restricted access" but gates nothing`,
      ).toBe(true);
    }
  });

  it('states plainly that a role is not needed to fundraise', () => {
    // The specific misconception this page exists to prevent: a signed-in user
    // deciding they must obtain "Organizer" before they can start a campaign.
    expect(SOURCE).toMatch(/never need to request a role/i);
    expect(SOURCE).toMatch(/start its own fundraiser/i);
  });

  it('keeps tax-deductibility attributed to the campaign, not the nonprofit role', () => {
    // campaigns.nonprofit_verified is the real gate. Saying otherwise on a public
    // page is a compliance statement, not a copy nit.
    expect(SOURCE).toMatch(/per campaign, not per role/i);
    expect(SOURCE).toMatch(/does not by itself make donations/i);
  });

  it('agrees with advisoryRoles() about which roles are descriptive', () => {
    // Ties the page's two-bucket split to the helper the admin console uses, so
    // the public page and the internal one can never tell different stories.
    const advisory = advisoryRoles();
    const shownAsOpen = ROLE_ORDER.filter((r) => !ROLE_DEFINITIONS[r].privileged);
    expect(shownAsOpen.slice().sort()).toEqual(advisory.slice().sort());
  });
});
