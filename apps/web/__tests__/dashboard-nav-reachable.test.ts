import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ASSIGNABLE_ROLES, type UserRole } from '../lib/roles-shared';
import {
  allDashboardNavigation,
  dashboardNavigationFor,
} from '../lib/persona-navigation';

function hrefs(role: UserRole): string[] {
  return dashboardNavigationFor(role).map((item) => item.href);
}

describe('dashboard persona navigation', () => {
  it('gives every role a dashboard, tax center, and settings', () => {
    for (const role of ASSIGNABLE_ROLES) {
      expect(hrefs(role), `${role} dashboard link`).toContain('/dashboard');
      expect(hrefs(role), `${role} tax link`).toContain('/dashboard/tax');
      expect(hrefs(role), `${role} settings link`).toContain('/dashboard/settings');
    }
  });

  it('keeps organizer operations out of the donor experience', () => {
    const donorHrefs = hrefs('donor');
    expect(donorHrefs).toContain('/donor');
    expect(donorHrefs).not.toContain('/dashboard/payouts');
    expect(donorHrefs).not.toContain('/dashboard/donations');
    expect(donorHrefs).not.toContain('/dashboard/donor');
  });

  it('maps beneficiary and nonprofit tools to their intended personas', () => {
    expect(hrefs('beneficiary')).toContain('/dashboard/beneficiary');
    expect(hrefs('beneficiary')).not.toContain('/dashboard/nonprofit');
    expect(hrefs('nonprofit')).toContain('/dashboard/nonprofit');
    expect(hrefs('nonprofit')).not.toContain('/dashboard/beneficiary');
  });

  it('gives organizers the campaign operations needed to run a fundraiser', () => {
    const organizerHrefs = hrefs('organizer');
    expect(organizerHrefs).toContain('/dashboard/campaigns');
    expect(organizerHrefs).toContain('/dashboard/donations');
    expect(organizerHrefs).toContain('/dashboard/payouts');
    expect(organizerHrefs).toContain('/dashboard/analytics');
  });

  it('only exposes personal tools in dashboard mode for staff accounts', () => {
    for (const role of ['admin', 'super_admin'] as const) {
      expect(hrefs(role)).toEqual([
        '/dashboard',
        '/donor',
        '/dashboard/tax',
        '/dashboard/messages',
        '/dashboard/settings',
      ]);
    }
  });

  it('points every persona navigation item to a real static page', () => {
    for (const item of allDashboardNavigation()) {
      const page = join(__dirname, '..', 'app', item.href.replace(/^\//, ''), 'page.tsx');
      expect(existsSync(page), `${item.href} has a nav entry but no page.tsx`).toBe(true);
    }
  });
});
