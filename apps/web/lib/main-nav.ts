// ─────────────────────────────────────────────────────────────────────────────
// The header's information architecture, kept out of AppShell so it can be
// tested and so the desktop bar and the mobile sheet render from ONE structure.
//
// They previously read the same flat `NAV` array, which worked only because the
// nav was flat. With two mega-dropdowns the mobile sheet has to flatten what the
// desktop bar nests, and that is exactly the kind of duplication that drifts —
// a link added to a dropdown would appear on desktop and quietly not on mobile.
// `flattenNav()` derives the mobile list, so it cannot fall behind.
// ─────────────────────────────────────────────────────────────────────────────

import { ALL_CAUSES_COLUMN, POPULAR_CAUSES, causeBrowseHref } from './causes';

export interface NavLink {
  label: string;
  href: string;
  /** One-line description, rendered in the Resources dropdown only. */
  description?: string;
  /** Renders the "New" pill. */
  isNew?: boolean;
}

export interface NavColumn {
  heading: string;
  links: readonly NavLink[];
  /** Optional link rendered at the foot of the column. */
  footer?: NavLink;
}

export type NavItem =
  | { kind: 'link'; label: string; href: string; isNew?: boolean }
  | { kind: 'menu'; label: string; id: string; columns: readonly NavColumn[] };

const VIEW_ALL: NavLink = { label: 'View All Causes', href: '/causes' };

export const EXPLORE_CAUSES: NavItem = {
  kind: 'menu',
  label: 'Explore Causes',
  id: 'explore-causes',
  columns: [
    {
      heading: 'Popular Causes',
      links: POPULAR_CAUSES.map((c) => ({ label: c.label, href: causeBrowseHref(c) })),
      footer: VIEW_ALL,
    },
    {
      heading: 'All Causes',
      links: ALL_CAUSES_COLUMN.map((c) => ({ label: c.label, href: causeBrowseHref(c) })),
      footer: VIEW_ALL,
    },
  ],
};

export const RESOURCES: NavItem = {
  kind: 'menu',
  label: 'Resources',
  id: 'resources',
  columns: [
    {
      heading: 'Learn',
      links: [
        { label: 'Blog & Insights', href: '/blog', description: 'Fundraising strategy, product news, and donor research.' },
        { label: 'Fundraising Guide', href: '/fundraising-guide', description: 'A step-by-step playbook for your first campaign.' },
        { label: 'Impact Education', href: '/impact-education', description: 'How giving works, and how to measure what it changes.' },
        { label: 'Reports & Research', href: '/reports', description: 'Platform transparency reports and giving data.' },
      ],
    },
    {
      heading: 'Get Involved',
      links: [
        { label: 'Volunteer', href: '/volunteer', description: 'Find opportunities to give time instead of money.' },
        { label: 'Events', href: '/events', description: 'Fundraising events near you and online.' },
        { label: 'Donate', href: '/donate', description: 'Give to a cause, or support the platform directly.' },
        { label: 'Partner With Us', href: '/partner', description: 'Bring CharitMe to your network or community.' },
      ],
    },
    {
      heading: 'For Organizations',
      links: [
        { label: 'For Nonprofits', href: '/for-nonprofits', description: 'Tools built for registered charities.' },
        { label: 'Verification Process', href: '/verification', description: 'How we confirm organizations are who they say.' },
        { label: 'Nonprofit Dashboard', href: '/dashboard/nonprofit', description: 'Manage your organization, team, and payouts.' },
        { label: 'Corporate Partnerships', href: '/corporate-partnerships', description: 'Matching gifts and workplace giving programmes.' },
      ],
    },
  ],
};

/**
 * The desktop bar, in order.
 *
 * Deliberately SIX items where the old flat nav had eight. #98 measured that the
 * header has no spare horizontal capacity below 1366px — three links became
 * unclickable under `.kind-auth` — so the dropdowns are not free real estate.
 * Two menus absorbing twenty destinations is what makes the new structure fit at
 * all; adding a seventh top-level item needs re-measuring, not eyeballing.
 */
export const MAIN_NAV: readonly NavItem[] = [
  EXPLORE_CAUSES,
  { kind: 'link', label: 'How It Works', href: '/how-it-works' },
  { kind: 'link', label: 'Impact', href: '/impact' },
  { kind: 'link', label: 'Stories', href: '/success-stories' },
  { kind: 'link', label: 'About Us', href: '/about-us' },
  RESOURCES,
];

/**
 * Every destination in the header, flattened for the mobile sheet.
 *
 * `heading` is null for top-level links and carries the column heading for
 * items that live inside a dropdown, so the sheet can group them without
 * re-stating the structure.
 */
export function flattenNav(
  nav: readonly NavItem[] = MAIN_NAV,
): { label: string; href: string; heading: string | null }[] {
  const out: { label: string; href: string; heading: string | null }[] = [];
  const seen = new Set<string>();

  for (const item of nav) {
    if (item.kind === 'link') {
      out.push({ label: item.label, href: item.href, heading: null });
      continue;
    }
    for (const col of item.columns) {
      for (const link of col.links) {
        out.push({ label: link.label, href: link.href, heading: col.heading });
      }
      // "View All Causes" is the footer of BOTH cause columns — one link, shown
      // twice by design on desktop. Emitting it twice on mobile would just look
      // like a bug, so the flattened list de-duplicates by href+label.
      if (col.footer) {
        const key = `${col.footer.href}|${col.footer.label}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ label: col.footer.label, href: col.footer.href, heading: col.heading });
        }
      }
    }
  }
  return out;
}

/** Every internal href the header links to. Used by the link-integrity test. */
export function allNavHrefs(nav: readonly NavItem[] = MAIN_NAV): string[] {
  const hrefs = new Set<string>();
  for (const item of nav) {
    if (item.kind === 'link') { hrefs.add(item.href); continue; }
    for (const col of item.columns) {
      for (const l of col.links) hrefs.add(l.href);
      if (col.footer) hrefs.add(col.footer.href);
    }
  }
  return [...hrefs];
}
