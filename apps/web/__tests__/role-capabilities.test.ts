import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASSIGNABLE_ROLES, type UserRole } from '../lib/roles-shared';
import {
  ROLE_DEFINITIONS,
  ROLE_ORDER,
  enforcedRoles,
  advisoryRoles,
  primaryRole,
} from '../lib/role-capabilities';

describe('role capability map', () => {
  it('defines every assignable role, with nothing extra', () => {
    // Adding a role to UserRole without describing it here should fail, so the
    // catalog cannot silently fall behind the union.
    expect(Object.keys(ROLE_DEFINITIONS).sort()).toEqual([...ASSIGNABLE_ROLES].sort());
  });

  it('gives every role a description and at least one capability', () => {
    for (const role of ASSIGNABLE_ROLES) {
      const def = ROLE_DEFINITIONS[role];
      expect(def.role, `${role}.role must match its key`).toBe(role);
      expect(def.label.length, `${role} needs a label`).toBeGreaterThan(0);
      expect(def.description.length, `${role} needs a description`).toBeGreaterThan(20);
      expect(def.capabilities.length, `${role} needs capabilities`).toBeGreaterThan(0);
      for (const cap of def.capabilities) {
        expect(cap.enforcedBy.length, `${role}: "${cap.label}" must say what enforces it`).toBeGreaterThan(0);
      }
    }
  });

  it('roles are actually distinct from one another', () => {
    // The goal criterion is that roles differ. Identical capability sets would
    // mean two roles that are the same thing under different names.
    const seen = new Map<string, UserRole>();
    for (const role of ASSIGNABLE_ROLES) {
      const key = ROLE_DEFINITIONS[role].capabilities.map((c) => c.label).sort().join('|');
      const clash = seen.get(key);
      expect(clash, `${role} and ${clash} have identical capabilities`).toBeUndefined();
      seen.set(key, role);
    }
    const labels = ASSIGNABLE_ROLES.map((r) => ROLE_DEFINITIONS[r].label);
    expect(new Set(labels).size, 'role labels must be unique').toBe(labels.length);
  });

  it('records honestly that only admin roles are enforced today', () => {
    // This is the audit result, pinned. When someone implements real gating for
    // organizer/beneficiary/nonprofit they must flip `enforced` here, and this
    // assertion is the reminder that the two must move together.
    expect(enforcedRoles()).toEqual(['admin', 'super_admin']);
    expect(advisoryRoles()).toEqual(['donor', 'organizer', 'beneficiary', 'nonprofit']);
  });

  it('marks exactly the two admin roles as privileged', () => {
    const privileged = ROLE_ORDER.filter((r) => ROLE_DEFINITIONS[r].privileged);
    expect(privileged).toEqual(['admin', 'super_admin']);
  });

  it('treats donor as the only default role', () => {
    const defaults = ROLE_ORDER.filter((r) => ROLE_DEFINITIONS[r].isDefault);
    expect(defaults).toEqual(['donor']);
  });

  it('primaryRole picks the highest privilege held', () => {
    expect(primaryRole(['donor', 'admin'])).toBe('admin');
    expect(primaryRole(['admin', 'super_admin'])).toBe('super_admin');
    expect(primaryRole(['organizer', 'donor'])).toBe('organizer');
    expect(primaryRole([])).toBe('donor');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin-console surfaces must render roles FROM this catalog, not from
// hand-maintained copies. Every copy that existed had already drifted:
//   • the role summary labelled the `admin` row "Super Admin", conflating
//     trust-and-safety staff with the one account that can grant roles
//   • it counted a phantom 'user' role that is not in ASSIGNABLE_ROLES
//   • `primaryRole` had no super_admin case, so an account granted only
//     super_admin displayed as "Donor"
//   • the role pill normalised 'Super Admin' → 'Super admin', missing the map
// ─────────────────────────────────────────────────────────────────────────────
describe('admin console renders roles from the catalog', () => {
  const usersPage = readFileSync(join(__dirname, '../app/admin/users/page.tsx'), 'utf8');
  const usersClient = readFileSync(
    join(__dirname, '../app/admin/users/_components/AdminUsersClient.tsx'),
    'utf8',
  );

  it('does not reintroduce the phantom "user" role', () => {
    // Matches real usage only — the comments in both files deliberately mention
    // 'user' to explain why it was removed.
    const USES_PHANTOM = /(includes|key:\s*|value:\s*)\(?'user'/;
    for (const [name, src] of [['page', usersPage], ['client', usersClient]] as const) {
      expect(USES_PHANTOM.test(src), `${name} uses a 'user' role that cannot be assigned`).toBe(false);
    }
  });

  it('never labels a non-super role "Super Admin"', () => {
    expect(usersPage).not.toMatch(/role:\s*'Super Admin',\s*key:\s*'admin'/);
  });

  it('builds the summary and pills from ROLE_DEFINITIONS', () => {
    expect(usersPage).toContain('ROLE_DEFINITIONS');
    expect(usersPage).toContain('ROLE_ORDER');
    expect(usersClient).toContain('ROLE_DEFINITIONS');
  });

  it('gives Admin and Super Admin visibly different pills', () => {
    const pill = usersClient.slice(usersClient.indexOf('function rolePillColor'));
    const body = pill.slice(0, pill.indexOf('\n}'));
    expect(body).toContain("'super admin'");
    // Keyed lowercase — a normaliser that title-cases only the first word would
    // silently drop the two-word label back to the unknown-role grey.
    const superColor = /'super admin':\s*\{[^}]*color:\s*'([^']+)'/.exec(body)?.[1];
    const adminColor = /\n\s*admin:\s*\{[^}]*color:\s*'([^']+)'/.exec(body)?.[1];
    expect(superColor).toBeTruthy();
    expect(adminColor).toBeTruthy();
    expect(superColor).not.toBe(adminColor);
  });

  it('the summary the page computes is actually rendered', () => {
    // It was passed as `_roles` and dropped, so the console had no answer to
    // "who holds what?" while still paying to compute it.
    expect(usersClient).not.toContain('roles: _roles');
    expect(usersClient).toContain('roleSummaries.map');
  });
});
