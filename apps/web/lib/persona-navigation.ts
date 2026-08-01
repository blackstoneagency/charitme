import type { UserRole } from './roles-shared';

export type DashboardNavItem = Readonly<{
  label: string;
  href: string;
  icon: string;
  badge?: string;
}>;

const DASHBOARD = { label: 'Dashboard', href: '/dashboard', icon: 'home' } as const;
const GIVING_HISTORY = { label: 'Giving History', href: '/donor', icon: 'gift' } as const;
// Saved causes sits with giving history: both are 'things I already engaged
// with'. Without a nav entry the page exists but is unreachable, which is how
// saved_campaigns ended up with 240 rows and no reader.
const SAVED_CAUSES = { label: 'Saved Causes', href: '/dashboard/saved', icon: 'heart' } as const;
const TAX_DOCUMENTS = { label: 'Tax Documents', href: '/dashboard/tax', icon: 'doc' } as const;
const VOLUNTEERING = { label: 'Volunteering', href: '/dashboard/volunteer', icon: 'team' } as const;
const MESSAGES = { label: 'Messages', href: '/dashboard/messages', icon: 'chat' } as const;
const SETTINGS = { label: 'Settings', href: '/dashboard/settings', icon: 'gear' } as const;

const DONOR_NAV: readonly DashboardNavItem[] = [
  DASHBOARD,
  GIVING_HISTORY,
  SAVED_CAUSES,
  TAX_DOCUMENTS,
  { label: 'Recurring Gifts', href: '/dashboard/recurring', icon: 'gift' },
  VOLUNTEERING,
  { label: 'Referrals', href: '/dashboard/referrals', icon: 'crown' },
  SETTINGS,
];

const ORGANIZER_NAV: readonly DashboardNavItem[] = [
  DASHBOARD,
  { label: 'My Campaigns', href: '/dashboard/campaigns', icon: 'stack' },
  { label: 'AI Growth Plan', href: '/dashboard/ai-growth-plan', icon: 'send', badge: 'New' },
  { label: 'AI Coach', href: '/dashboard/ai-coach', icon: 'send', badge: 'AI' },
  { label: 'Donations Received', href: '/dashboard/donations', icon: 'gift' },
  TAX_DOCUMENTS,
  { label: 'Donors', href: '/dashboard/donor', icon: 'users' },
  { label: 'Grants', href: '/dashboard/grants', icon: 'audit' },
  VOLUNTEERING,
  { label: 'Corporate Giving', href: '/dashboard/corporate', icon: 'crown' },
  { label: 'Referrals', href: '/dashboard/referrals', icon: 'crown' },
  { label: 'Updates', href: '/dashboard/updates', icon: 'doc' },
  { label: 'Creator Page', href: '/dashboard/creator', icon: 'crown' },
  { label: 'Payouts', href: '/dashboard/payouts', icon: 'wallet' },
  { label: 'Analytics', href: '/dashboard/analytics', icon: 'chart' },
  MESSAGES,
  { label: 'Team', href: '/dashboard/team', icon: 'team' },
  { label: 'Integrations', href: '/dashboard/integrations', icon: 'link' },
  { label: 'Developers', href: '/dashboard/developers', icon: 'doc' },
  SETTINGS,
];

const BENEFICIARY_NAV: readonly DashboardNavItem[] = [
  DASHBOARD,
  { label: 'Campaigns for You', href: '/dashboard/beneficiary', icon: 'gift' },
  GIVING_HISTORY,
  SAVED_CAUSES,
  TAX_DOCUMENTS,
  VOLUNTEERING,
  MESSAGES,
  SETTINGS,
];

const NONPROFIT_NAV: readonly DashboardNavItem[] = [
  DASHBOARD,
  { label: 'Your Organization', href: '/dashboard/nonprofit', icon: 'check' },
  ...ORGANIZER_NAV.slice(1),
];

const STAFF_NAV: readonly DashboardNavItem[] = [
  DASHBOARD,
  GIVING_HISTORY,
  TAX_DOCUMENTS,
  MESSAGES,
  SETTINGS,
];

const PERSONA_NAVIGATION: Readonly<Record<UserRole, readonly DashboardNavItem[]>> = {
  donor: DONOR_NAV,
  organizer: ORGANIZER_NAV,
  beneficiary: BENEFICIARY_NAV,
  nonprofit: NONPROFIT_NAV,
  admin: STAFF_NAV,
  super_admin: STAFF_NAV,
};

// Navigation is an ergonomic view of the account's primary role. Authorization
// remains in server-side ownership and admin checks.
export function dashboardNavigationFor(role: UserRole): readonly DashboardNavItem[] {
  return PERSONA_NAVIGATION[role];
}

export function allDashboardNavigation(): readonly DashboardNavItem[] {
  const byHref = new Map<string, DashboardNavItem>();
  for (const items of Object.values(PERSONA_NAVIGATION)) {
    for (const item of items) byHref.set(item.href, item);
  }
  return [...byHref.values()];
}
