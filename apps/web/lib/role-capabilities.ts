import { ASSIGNABLE_ROLES, type UserRole } from './roles';

// ─────────────────────────────────────────────────────────────────────────────
// Role capability map — the single place that says what each role MEANS.
//
// Audit finding this encodes: of the six roles, only `admin` and `super_admin`
// actually gate anything. `donor`, `organizer`, `beneficiary` and `nonprofit` are
// display-only labels — every reference to them computes a badge in the admin user
// list or filters it. Real authorization today comes from three other mechanisms:
//   • being signed in + owning the row (campaigns, donations, updates…)
//   • `campaigns.nonprofit_verified` — the actual tax-deductibility gate, which is
//     per-campaign and NOT derived from the `nonprofit` role
//   • `profiles.status` — suspension/deactivation
//
// So this module deliberately records TWO different things per capability, and
// keeping them apart is the whole point:
//   `enforced: true`  → code really denies access on this today.
//   `enforced: false` → intended meaning, currently unenforced. Advisory only.
//
// Nothing here grants or denies anything at runtime; it is descriptive. Gating a
// capability means changing the real check AND flipping `enforced` here, so the
// two can never quietly drift apart. Writing this as live authorization would have
// meant inventing restrictions on users who currently have none — the fastest way
// to lock an organizer out of their own campaign.
// ─────────────────────────────────────────────────────────────────────────────

export interface RoleCapability {
  /** Short imperative phrase: "Create and manage campaigns". */
  label: string;
  /** What actually enforces this today, or what would need to. */
  enforcedBy: string;
  /** True only when code genuinely denies access without this role. */
  enforced: boolean;
}

export interface RoleDefinition {
  role: UserRole;
  /** Display name used in admin and profile surfaces. */
  label: string;
  /** One sentence a non-engineer can read. */
  description: string;
  /** True when the role is granted automatically rather than assigned. */
  isDefault: boolean;
  /** True when only a super admin may assign it. */
  privileged: boolean;
  capabilities: RoleCapability[];
}

const OWNERSHIP = 'Signed-in session + row ownership (not the role)';

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  donor: {
    role: 'donor',
    label: 'Donor',
    description: 'The default for every account. Can give to campaigns and manage their own giving history.',
    isDefault: true,
    privileged: false,
    capabilities: [
      { label: 'Donate to any live campaign', enforcedBy: 'Public — no role needed', enforced: false },
      { label: 'View and export own donation history', enforcedBy: OWNERSHIP, enforced: false },
      { label: 'Request a refund on own donation', enforcedBy: OWNERSHIP, enforced: false },
      { label: 'Control own public giving visibility', enforcedBy: 'profiles.show_public_profile', enforced: false },
    ],
  },
  organizer: {
    role: 'organizer',
    label: 'Organizer',
    description: 'Runs fundraisers. Today this is a label — any signed-in account can already create and manage campaigns.',
    isDefault: false,
    privileged: false,
    capabilities: [
      { label: 'Create and publish campaigns', enforcedBy: 'Signed-in session only — NOT the role', enforced: false },
      { label: 'Edit and post updates to own campaigns', enforcedBy: OWNERSHIP, enforced: false },
      { label: 'Connect Stripe and receive payouts', enforcedBy: 'profiles.stripe_onboarded', enforced: false },
      { label: 'Message and thank own donors', enforcedBy: OWNERSHIP, enforced: false },
    ],
  },
  beneficiary: {
    role: 'beneficiary',
    label: 'Beneficiary',
    description: 'Someone a campaign raises money for, who is not necessarily the organizer. Currently descriptive only.',
    isDefault: false,
    privileged: false,
    capabilities: [
      { label: 'Be named as the recipient of a campaign', enforcedBy: 'Campaign beneficiary fields', enforced: false },
      { label: 'Confirm the beneficiary relationship', enforcedBy: 'Not implemented', enforced: false },
    ],
  },
  nonprofit: {
    role: 'nonprofit',
    label: 'Nonprofit',
    description: 'A registered organization. Note: tax-deductibility is NOT granted by this role — it comes from per-campaign verification.',
    isDefault: false,
    privileged: false,
    capabilities: [
      { label: 'Issue tax-deductible receipts', enforcedBy: 'campaigns.nonprofit_verified (per campaign, NOT this role)', enforced: false },
      { label: 'Hold a verified nonprofit profile with EIN', enforcedBy: 'nonprofit_profiles row + verification', enforced: false },
      { label: 'Show a verified-nonprofit badge', enforcedBy: 'campaigns.nonprofit_verified', enforced: false },
    ],
  },
  admin: {
    role: 'admin',
    label: 'Admin',
    description: 'Trust-and-safety and support staff. This role genuinely gates access.',
    isDefault: false,
    privileged: true,
    capabilities: [
      { label: 'Open the admin console', enforcedBy: 'isAdmin() — lib/roles.ts', enforced: true },
      { label: 'Review campaigns, reports and payouts', enforcedBy: 'isAdmin() on each admin route', enforced: true },
      { label: 'Run cron endpoints without CRON_SECRET', enforcedBy: 'Admin session fallback in /api/cron/*', enforced: true },
    ],
  },
  super_admin: {
    role: 'super_admin',
    label: 'Super Admin',
    description: 'Full platform control, including granting roles to other people. This role genuinely gates access.',
    isDefault: false,
    privileged: true,
    capabilities: [
      { label: 'Everything an Admin can do', enforcedBy: 'isAdmin() returns true for super_admin', enforced: true },
      { label: 'Assign and revoke roles', enforcedBy: 'isSuperAdmin() — /api/admin/super/roles', enforced: true },
      { label: 'Edit platform-wide settings and banners', enforcedBy: 'guardSuperAdmin on /api/admin/super/*', enforced: true },
    ],
  },
};

/** Ordered least- to most-privileged, for consistent display. */
export const ROLE_ORDER: readonly UserRole[] = ASSIGNABLE_ROLES;

/** Roles whose capabilities are genuinely enforced in code today. */
export function enforcedRoles(): UserRole[] {
  return ROLE_ORDER.filter((r) => ROLE_DEFINITIONS[r].capabilities.some((c) => c.enforced));
}

/** Roles that are currently descriptive labels only — nothing checks them. */
export function advisoryRoles(): UserRole[] {
  return ROLE_ORDER.filter((r) => !ROLE_DEFINITIONS[r].capabilities.some((c) => c.enforced));
}

/** The highest-privilege role held, for badges. Falls back to 'donor'. */
export function primaryRole(roles: UserRole[]): UserRole {
  for (let i = ROLE_ORDER.length - 1; i >= 0; i--) {
    if (roles.includes(ROLE_ORDER[i])) return ROLE_ORDER[i];
  }
  return 'donor';
}
