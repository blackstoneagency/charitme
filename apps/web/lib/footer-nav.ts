// ─────────────────────────────────────────────────────────────────────────────
// Global footer structure — the single source of truth for both the column grid
// and the legal bar beneath it.
//
// Why this is computed rather than two hand-written lists: the footer shows the
// same destination in two places (the Legal column had "Terms of Service" while
// the bottom bar has "Terms"; likewise "Privacy Policy" / "Privacy Notice").
// Hand-maintaining the split guarantees they drift back together the next time
// someone adds a policy page — the repo has already been bitten by exactly this
// with CAMPAIGN_CATEGORIES, which had three copies that disagreed.
//
// So: declare every column link and every legal-bar link, then derive the
// rendered columns by REMOVING anything the legal bar already owns. The legal
// bar wins because it is present on every page at the bottom of the viewport,
// and it is where the compliance links are expected to live.
// ─────────────────────────────────────────────────────────────────────────────

export interface FooterLink {
  label: string;
  href: string;
}

export type FooterSectionName = 'Platform' | 'Resources' | 'Company' | 'Legal';

/** Column links as authored, BEFORE legal-bar de-duplication. */
export const FOOTER_SECTIONS: Record<FooterSectionName, readonly FooterLink[]> = {
  Platform: [
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'AI Fundraising', href: '/ai-fundraising' },
    { label: 'AI Campaign Builder', href: '/ai-campaign' },
    { label: 'Platform Features', href: '/features' },
    { label: 'Success Stories', href: '/success-stories' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Fast Payouts', href: '/fast-payouts' },
    { label: 'Volunteer', href: '/volunteer' },
    { label: 'Sponsor a Cause', href: '/sponsor' },
    { label: 'Grants', href: '/grants' },
    { label: 'Matching Gifts', href: '/matching' },
    { label: 'Events', href: '/events' },
    { label: 'Impact & Transparency', href: '/impact' },
  ],
  Resources: [
    { label: 'Blog', href: '/blog' },
    { label: 'Leaderboard', href: '/leaderboard' },
    { label: 'Help Center', href: '/help' },
    { label: 'FAQ', href: '/faq' },
    // "Fundraising Guides" used to sit here pointing at /how-it-works — the same
    // destination as the Platform column's "How It Works", under a label that
    // promised a guide library the site does not have. Two links to one page
    // under different names is the same defect as the Terms/Privacy duplication
    // below, so it goes rather than being exempted. Restore it when a real
    // /guides route exists.
    { label: 'Supported Countries', href: '/supported-countries' },
  ],
  Company: [
    { label: 'About Us', href: '/about-us' },
    { label: 'Contact Us', href: '/contact' },
    { label: 'For Nonprofits', href: '/for-nonprofits' },
    { label: 'For Individuals', href: '/for-individuals' },
    { label: 'For Donors', href: '/for-donors' },
    { label: 'Trust & Safety', href: '/trust-safety' },
  ],
  Legal: [
    { label: 'Transparency Center', href: '/transparency' },
    { label: 'Fee Policy', href: '/fees' },
    { label: 'Refund Policy', href: '/refunds' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Privacy Center', href: '/privacy-center' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Security', href: '/security' },
    { label: 'Prohibited Use', href: '/prohibited-use' },
  ],
};

export const FOOTER_SECTION_ORDER: readonly FooterSectionName[] = [
  'Platform', 'Resources', 'Company', 'Legal',
];

/**
 * The bar under the copyright line. These are the canonical destinations for
 * their policies — anything here is stripped from the columns above.
 */
export const FOOTER_LEGAL_BAR: readonly FooterLink[] = [
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy Notice', href: '/privacy' },
  { label: 'Legal', href: '/legal' },
  { label: 'Accessibility Statement', href: '/accessibility' },
  { label: 'Cookie Policy', href: '/cookies' },
];

/** Trailing slash and case are not meaningful differences between two hrefs. */
function normalizeHref(href: string): string {
  const trimmed = href.trim().toLowerCase();
  return trimmed.length > 1 && trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

/**
 * Columns as RENDERED: authored links minus every destination the legal bar
 * already links to. A section that empties out entirely is dropped, so the grid
 * never renders a heading over nothing.
 */
export function resolveFooterSections(): Array<{ name: FooterSectionName; links: FooterLink[] }> {
  const owned = new Set(FOOTER_LEGAL_BAR.map((l) => normalizeHref(l.href)));
  return FOOTER_SECTION_ORDER
    .map((name) => ({
      name,
      links: FOOTER_SECTIONS[name].filter((l) => !owned.has(normalizeHref(l.href))),
    }))
    .filter((section) => section.links.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Operator-configurable bits: social profiles, app store listings, contact.
// Stored under `platform_settings.config.footer` and editable in Super Admin →
// Settings → Footer. A link with an empty URL is not rendered at all rather than
// rendered pointing at '#': a dead social icon in the global footer of every
// page reads as a broken site, and '#' scrolls to top, which looks like a bug.
// ─────────────────────────────────────────────────────────────────────────────

export interface FooterSettings {
  contactEmail: string;
  facebookUrl: string;
  youtubeUrl: string;
  twitterUrl: string;
  instagramUrl: string;
  appStoreUrl: string;
  googlePlayUrl: string;
}

export const FOOTER_SETTINGS_DEFAULTS: FooterSettings = {
  contactEmail: 'hello@charitme.com',
  facebookUrl: 'https://www.facebook.com/charitme',
  youtubeUrl: 'https://www.youtube.com/@charitme',
  twitterUrl: 'https://x.com/charitme',
  instagramUrl: 'https://www.instagram.com/charitme',
  appStoreUrl: '',
  googlePlayUrl: '',
};

/**
 * An `https:` URL, or ''. Anything else — `javascript:`, `data:`, a protocol
 * relative `//evil.example`, junk — collapses to empty and is therefore not
 * rendered.
 *
 * Validated on READ, not only on write, for the same reason the banner settings
 * are: these values land in an `href` on every page of the site, and a row
 * edited directly in the database has never passed through the write path.
 */
export function safeExternalUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (!url) return '';
  try {
    return new URL(url).protocol === 'https:' ? url.slice(0, 500) : '';
  } catch {
    return '';
  }
}

/** A plain `local@domain.tld` address, or ''. Guards the `mailto:` href. */
export function safeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  const email = value.trim();
  return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email) ? email.slice(0, 254) : '';
}

/**
 * Merge stored footer settings over the defaults. Unknown keys are dropped so a
 * malformed settings row cannot inject arbitrary fields into the footer, and
 * every value is re-validated for the context it is rendered into.
 *
 * A stored value that fails validation falls back to the DEFAULT rather than to
 * '': an operator who pastes a broken URL should see the previous working link,
 * not a silently vanished social icon.
 */
export function resolveFooterSettings(raw: unknown): FooterSettings {
  const stored = (raw && typeof raw === 'object' && !Array.isArray(raw))
    ? (raw as Record<string, unknown>)
    : {};
  const result = { ...FOOTER_SETTINGS_DEFAULTS };

  for (const key of Object.keys(FOOTER_SETTINGS_DEFAULTS) as Array<keyof FooterSettings>) {
    const raw = stored[key];
    if (typeof raw !== 'string') continue;
    // An explicitly empty string is a real choice: "hide this link".
    if (raw.trim() === '') { result[key] = ''; continue; }
    const safe = key === 'contactEmail' ? safeEmail(raw) : safeExternalUrl(raw);
    if (safe) result[key] = safe;
  }
  return result;
}
