import { describe, expect, it } from 'vitest';
import {
  ORG_ROLES,
  canAdministerOrg,
  canEditBrands,
  isOrgRole,
  isOwner,
  orgRoleSatisfies,
} from '../lib/organizations-core';

// These pin the ladder against the SQL in
// 20260807000000_organizations_multitenancy.sql. If the migration's `case
// min_role` branches change, these should fail — a TS gate that disagrees with
// RLS either shows a 500 where it meant a 403, or implies access the DB refuses.

describe('orgRoleSatisfies', () => {
  it('owner satisfies every requirement', () => {
    for (const min of ORG_ROLES) expect(orgRoleSatisfies('owner', min)).toBe(true);
  });

  it('matches the SQL admin branch: owner and admin only', () => {
    expect(canAdministerOrg('owner')).toBe(true);
    expect(canAdministerOrg('admin')).toBe(true);
    for (const r of ['editor', 'viewer', 'member']) expect(canAdministerOrg(r)).toBe(false);
  });

  it('matches the SQL editor branch: owner, admin, editor', () => {
    for (const r of ['owner', 'admin', 'editor']) expect(canEditBrands(r)).toBe(true);
    for (const r of ['viewer', 'member']) expect(canEditBrands(r)).toBe(false);
  });

  it('matches the SQL owner branch: owner alone', () => {
    expect(isOwner('owner')).toBe(true);
    for (const r of ['admin', 'editor', 'viewer', 'member']) expect(isOwner(r)).toBe(false);
  });

  it('treats viewer and member as the same authority', () => {
    // The SQL `else true` branch admits both. Ranking viewer above member would
    // invent a tier the database does not enforce.
    expect(orgRoleSatisfies('viewer', 'member')).toBe(true);
    expect(orgRoleSatisfies('member', 'viewer')).toBe(true);
    expect(orgRoleSatisfies('viewer', 'editor')).toBe(false);
    expect(orgRoleSatisfies('member', 'editor')).toBe(false);
  });
});

describe('fails closed on bad input', () => {
  it.each([undefined, null, '', 'OWNER', 'superuser', 0, {}, []])(
    'denies %p rather than throwing',
    (bad) => {
      // An unrecognised role — a value a later migration adds, say — must deny,
      // never default to allow. Same instinct as coalesce(..., false) in the SQL.
      expect(orgRoleSatisfies(bad)).toBe(false);
      expect(canAdministerOrg(bad)).toBe(false);
    },
  );

  it('is case-sensitive, matching the SQL check constraint', () => {
    expect(isOrgRole('Owner')).toBe(false);
    expect(isOrgRole('owner')).toBe(true);
  });

  it('defaults to the lowest requirement when minRole is omitted', () => {
    for (const r of ORG_ROLES) expect(orgRoleSatisfies(r)).toBe(true);
  });
});
