import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase-server', () => ({ createClient: vi.fn() }));
vi.mock('../lib/roles', () => ({ isAdmin: vi.fn(), isSuperAdmin: vi.fn() }));

const {
  hasPrivilegedRole,
  rolesFor,
  rolesWithStatus,
} = await import('../app/api/admin/users/_auth');

const createRoute = readFileSync(
  resolve(process.cwd(), 'app/api/admin/users/route.ts'),
  'utf8',
);
const userRoute = readFileSync(
  resolve(process.cwd(), 'app/api/admin/users/[id]/route.ts'),
  'utf8',
);
const bulkRoute = readFileSync(
  resolve(process.cwd(), 'app/api/admin/users/bulk/route.ts'),
  'utf8',
);
const superRolesRoute = readFileSync(
  resolve(process.cwd(), 'app/api/admin/super/roles/route.ts'),
  'utf8',
);
const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/20260814010000_harden_role_and_team_boundaries.sql'),
  'utf8',
).toLowerCase();

describe('privileged account boundaries', () => {
  it('recognizes both privileged roles', () => {
    expect(hasPrivilegedRole(['donor', 'admin'])).toBe(true);
    expect(hasPrivilegedRole(['super_admin'])).toBe(true);
    expect(hasPrivilegedRole(['donor', 'organizer'])).toBe(false);
  });

  it('makes super_admin inherit donor and admin', () => {
    expect(rolesFor('super_admin', 'Active')).toEqual(
      expect.arrayContaining(['donor', 'admin', 'super_admin']),
    );
  });

  it('changes account status without erasing domain roles', () => {
    expect(rolesWithStatus(['donor', 'organizer', 'beneficiary'], 'Suspended')).toEqual(
      expect.arrayContaining(['donor', 'organizer', 'beneficiary', 'suspended']),
    );
    expect(rolesWithStatus(['donor', 'organizer', 'suspended'], 'Active')).toEqual(
      expect.arrayContaining(['donor', 'organizer']),
    );
    expect(rolesWithStatus(['donor', 'organizer', 'suspended'], 'Active')).not.toContain('suspended');
  });

  it('requires super-admin authorization for privileged creation and mutation', () => {
    expect(createRoute).toContain('verifySuperAdmin()');
    expect(createRoute).toContain("code: 'SUPER_ADMIN_REQUIRED'");
    expect(userRoute.match(/verifySuperAdmin\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(userRoute).toContain("code: 'SELF_DELETE_FORBIDDEN'");
    expect(bulkRoute).toContain('actorIsSuperAdmin');
    expect(bulkRoute.match(/SUPER_ADMIN_REQUIRED/g)?.length).toBeGreaterThanOrEqual(3);
    expect(bulkRoute).toContain('rolesWithStatus(currentRoles, status)');
  });

  it('preserves super-admin inheritance in both the role API and RLS', () => {
    expect(superRolesRoute).toContain("finalRoleSet.add('admin')");
    expect(migration).toMatch(/roles \? 'admin' or roles \? 'super_admin'/);
  });

  it('removes browser team mutations at the database boundary', () => {
    expect(migration).toContain(
      'revoke insert, update, delete, truncate, references, trigger',
    );
    expect(migration).toContain('from authenticated');
    expect(migration).not.toContain('create policy team_members_admin_owner_write');
  });
});
