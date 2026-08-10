// The super-admin feature list, in a module with NO 'use client' directive.
//
// This lived in components/SuperAdminNav.tsx, which IS a client module. A Server
// Component importing a non-component value across that boundary does not get
// the value — Next replaces the module with a client-reference proxy, so
// app/admin/super/page.tsx received an object and threw
// "SUPER_ADMIN_NAV.filter is not a function". The super-admin console overview
// 500'd, and because it is behind requireSuperAdmin() nothing routine visits it.
//
// A default-exported COMPONENT crosses that boundary fine (components/CharitMeApp
// .tsx imports the SuperAdminNav component and works). It is specifically plain
// data that does not survive, which makes the failure easy to reintroduce — hence
// the guard in __tests__/rsc-client-value-imports.test.ts.
//
// The sidebar entry still self-gates via /api/admin/super/whoami and must NOT be
// added to `adminNav` in CharitMeApp.tsx, which renders for every admin.
export const SUPER_ADMIN_NAV: readonly (readonly [string, string, string])[] = [
  ['Overview', '/admin/super', 'grid'],
  ['AI', '/admin/ai', 'spark'],
  ['Roles & Permissions', '/admin/super/roles', 'crown'],
  ['Users', '/admin/super/users', 'users'],
  ['Marketing', '/admin/marketing', 'send'],
  ['Feature Flags', '/admin/super/flags', 'flag'],
  ['Platform Settings', '/admin/super/settings', 'gear'],
  ['Announcements', '/admin/super/announcements', 'bell'],
  ['Banner', '/admin/super/banner', 'flag'],
  ['Demo Data', '/admin/super/demo-data', 'list'],
  ['Activity Log', '/admin/super/activity', 'list'],
] as const;
