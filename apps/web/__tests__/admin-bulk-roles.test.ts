import { describe, it, expect } from 'vitest';
import { rolesFor } from '../app/api/admin/users/_auth';

// Regression guard for the bulk user endpoint.
//
// The handler used to read a user's current roles with `.single()` and fall back
// to ['donor'] whenever the select returned nothing — including a transient or
// RLS failure. Combined with an unchecked update, a bulk "activate" could
// overwrite a real admin's roles with plain 'donor', silently demoting them,
// while the response still reported every id as updated.
//
// The handler now skips a row whose read failed. These tests pin the role math
// it depends on, so the "default to donor" shape can't quietly come back.
describe('rolesFor — bulk user updates must not invent privileges', () => {
  it('preserves the elevated role when activating', () => {
    expect(rolesFor('admin', 'Active')).toContain('admin');
    expect(rolesFor('admin', 'Active')).not.toContain('suspended');
  });

  it('keeps the role while marking suspended, rather than downgrading', () => {
    const roles = rolesFor('admin', 'Suspended');
    expect(roles).toContain('admin');
    expect(roles).toContain('suspended');
  });

  it('never silently yields a bare donor role for an elevated input', () => {
    for (const role of ['organizer', 'nonprofit', 'beneficiary', 'admin']) {
      for (const status of ['Active', 'Suspended', 'Inactive']) {
        const roles = rolesFor(role, status);
        expect(roles, `${role}/${status}`).toContain(role);
      }
    }
  });

  it('marks inactive without dropping the role', () => {
    const roles = rolesFor('organizer', 'Inactive');
    expect(roles).toContain('organizer');
    expect(roles).toContain('inactive');
  });
});
