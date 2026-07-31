// ─────────────────────────────────────────────────────────────────────────────
// Primary (header) navigation.
//
// The header carried eight flat links — Home, AI Fundraising, How It Works,
// Pricing, Success Stories, About Us, Blog, Contact Us — while the FOOTER carried
// 41 across four columns. Everything a visitor might actually be looking for
// (Crisis Relief, Grants, Volunteer, Matching Gifts, Events, Transparency) was
// reachable only by scrolling past the entire page.
//
// Grouped into three dropdowns so the header can expose the real surface without
// becoming a wall of links. Every destination here already exists and returns
// 200 — verified against a running server — so this reorganises discovery rather
// than promising pages that are not built.
//
// Shares the FooterLink shape (label + href + labelKey) on purpose: one link type,
// one translation convention, and the footer-links test can reason about both.
// ─────────────────────────────────────────────────────────────────────────────

import type { FooterLink } from './footer-nav';

export interface NavGroup {
  /** English name, kept as the fallback and the source string. */
  label: string;
  labelKey: string;
  /** Short line under the group name in the open menu. */
  blurbKey: string;
  links: readonly FooterLink[];
}

export const PRIMARY_NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Explore',
    labelKey: 'nav.group.explore',
    blurbKey: 'nav.group.explore_blurb',
    links: [
      { label: 'Browse Campaigns', href: '/campaigns', labelKey: 'footer.link.campaigns' },
      { label: 'Fundraisers Near You', href: '/nearby', labelKey: 'footer.link.nearby' },
      { label: 'Success Stories', href: '/success-stories', labelKey: 'footer.link.success_stories' },
      { label: 'Leaderboard', href: '/leaderboard', labelKey: 'footer.link.leaderboard' },
      { label: 'Events', href: '/events', labelKey: 'footer.link.events' },
      { label: 'Our Impact', href: '/impact', labelKey: 'footer.link.impact' },
    ],
  },
  {
    label: 'Causes',
    labelKey: 'nav.group.causes',
    blurbKey: 'nav.group.causes_blurb',
    links: [
      { label: 'Crisis Relief', href: '/crisis', labelKey: 'footer.link.crisis' },
      { label: 'Give to Many Causes', href: '/give', labelKey: 'footer.link.give' },
      { label: 'Matching Gifts', href: '/matching', labelKey: 'footer.link.matching' },
      { label: 'Sponsor a Cause', href: '/sponsor', labelKey: 'footer.link.sponsor' },
      { label: 'Volunteer', href: '/volunteer', labelKey: 'footer.link.volunteer' },
      { label: 'Grants', href: '/grants', labelKey: 'footer.link.grants' },
    ],
  },
  {
    label: 'Resources',
    labelKey: 'nav.group.resources',
    blurbKey: 'nav.group.resources_blurb',
    links: [
      { label: 'How It Works', href: '/how-it-works', labelKey: 'footer.link.how_it_works' },
      { label: 'Help Center', href: '/help', labelKey: 'footer.link.help' },
      { label: 'Blog', href: '/blog', labelKey: 'footer.link.blog' },
      { label: 'Trust & Safety', href: '/trust-safety', labelKey: 'footer.link.trust_safety' },
      { label: 'Transparency Center', href: '/transparency', labelKey: 'footer.link.transparency' },
      { label: 'Supported Countries', href: '/supported-countries', labelKey: 'footer.link.supported_countries' },
    ],
  },
];

/**
 * Links that stay visible in the header rather than living inside a group.
 *
 * Pricing earns its place because "what does this cost" is the question a new
 * organiser asks first, and CharitMe's answer (0%) is the product's main claim.
 */
export const PRIMARY_NAV_DIRECT: readonly FooterLink[] = [
  { label: 'AI Fundraising', href: '/ai-fundraising', labelKey: 'footer.link.ai_fundraising' },
  { label: 'Pricing', href: '/pricing', labelKey: 'footer.link.pricing' },
];

/** Every destination reachable from the header, for tests and the route audit. */
export function primaryNavHrefs(): string[] {
  return [
    ...PRIMARY_NAV_GROUPS.flatMap((g) => g.links.map((l) => l.href)),
    ...PRIMARY_NAV_DIRECT.map((l) => l.href),
  ];
}
