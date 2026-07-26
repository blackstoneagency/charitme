import { describe, it, expect } from 'vitest';
import { ASSIGNABLE_ROLES, type UserRole } from '../lib/roles';
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
