import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  isMaintenanceBypassPath,
  resolveMaintenanceStatus,
} from '../lib/maintenance-mode';

describe('resolveMaintenanceStatus', () => {
  it('uses the validated top-level Supabase configuration', () => {
    expect(resolveMaintenanceStatus({
      maintenanceMode: true,
      maintenanceMessage: 'Deploying a safer donation flow.',
      maintenanceExpectedBackAt: '2026-08-01T18:00:00-04:00',
    })).toEqual({
      enabled: true,
      message: 'Deploying a safer donation flow.',
      expectedBackAt: '2026-08-01T22:00:00.000Z',
      supportEmail: 'support@charitme.com',
    });
  });

  it('supports the legacy nested setting without letting it override the top level', () => {
    expect(resolveMaintenanceStatus({
      maintenanceMode: false,
      maintenance: { maintenanceMode: true, message: 'Legacy message' },
    }).enabled).toBe(false);
    expect(resolveMaintenanceStatus({ maintenance: { maintenanceMode: true } }).enabled).toBe(true);
  });

  it('fails open and replaces malformed display values', () => {
    expect(resolveMaintenanceStatus({
      maintenanceMode: 'yes',
      maintenanceMessage: '   ',
      maintenanceExpectedBackAt: 'not-a-date',
    })).toEqual({
      enabled: false,
      message: DEFAULT_MAINTENANCE_MESSAGE,
      expectedBackAt: null,
      supportEmail: 'support@charitme.com',
    });
  });

  it('reads the configured support address and rejects invalid direct database edits', () => {
    expect(resolveMaintenanceStatus({ supportEmail: 'help@charitme.com' }).supportEmail).toBe('help@charitme.com');
    expect(resolveMaintenanceStatus({ supportEmail: 'javascript:alert(1)' }).supportEmail).toBe('support@charitme.com');
  });
});

describe('isMaintenanceBypassPath', () => {
  it.each(['/maintenance', '/login', '/login/mfa', '/forgot-password', '/admin', '/admin/super/settings', '/offline'])(
    'keeps %s reachable while maintenance mode is active',
    (path) => expect(isMaintenanceBypassPath(path)).toBe(true),
  );

  it.each(['/', '/campaigns', '/dashboard', '/administrator'])(
    'gates %s',
    (path) => expect(isMaintenanceBypassPath(path)).toBe(false),
  );
});
