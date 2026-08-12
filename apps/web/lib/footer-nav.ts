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
  /** English text. Kept as the fallback and as the source string for translation. */
  label: string;
  href: string;
  /**
   * Translation key, resolved at render time.
   *
   * The label stays here rather than being replaced by the key: this file is also
   * read by footer-links.test.ts and by the sitemap tooling, both of which want
   * human-readable text, and an untranslated key rendering in the footer would be
   * worse than English. `t()` falls back to English anyway, so a missing key is
   * invisible rather than broken.
   */
  labelKey: string;
}

export type FooterSectionName = 'Platform' | 'Ways to Give' | 'Company' | 'Legal';

/** Column links as authored, BEFORE legal-bar de-duplication. */
export const FOOTER_SECTIONS: Record<FooterSectionName, readonly FooterLink[]> = {
  // ⚠️ Column LENGTHS are part of the design, not an accident. "Platform" carried
  // 13 links against 5 / 6 / 8 elsewhere, so it ran roughly twice as long as its
  // neighbours and left a large empty area beside them. Balancing the content is
  // the fix; no CSS can make four lists of wildly different length look
  // deliberate. footer-links.test.ts holds them within one of each other.
  Platform: [
    { label: 'How It Works', href: '/how-it-works', labelKey: 'footer.link.how_it_works' },
    { label: 'AI Fundraising', href: '/ai-fundraising', labelKey: 'footer.link.ai_fundraising' },
    { label: 'AI Campaign Builder', href: '/ai-campaign', labelKey: 'footer.link.ai_campaign' },
    { label: 'Platform Features', href: '/features', labelKey: 'footer.link.features' },
    { label: 'Fast Payouts', href: '/fast-payouts', labelKey: 'footer.link.fast_payouts' },
    { label: 'Pricing', href: '/pricing', labelKey: 'footer.link.pricing' },
    { label: 'Success Stories', href: '/success-stories', labelKey: 'footer.link.success_stories' },
    { label: 'Campaign Gallery', href: '/gallery', labelKey: 'footer.link.gallery' },
    { label: 'Leaderboard', href: '/leaderboard', labelKey: 'footer.link.leaderboard' },
    { label: 'Developers & API', href: '/developers', labelKey: 'footer.link.developers' },
    { label: 'CharitMe on Mobile', href: '/mobile-app', labelKey: 'footer.link.mobile_app' },
    { label: 'Support', href: '/support', labelKey: 'footer.link.support' },
    { label: 'Start a Team', href: '/teams/create', labelKey: 'footer.link.create_team' },
    // /signup had no inbound link anywhere, which `nav-orphans` correctly
    // refused: a route in the sitemap that the global chrome never links is a
    // page search engines find and visitors cannot.
    { label: 'Create an Account', href: '/signup', labelKey: 'footer.link.signup' },
  ],
  // Splitting the ways to GIVE out of "Platform" is what balances the grid, and
  // it is better navigation besides: a donor looking for somewhere to give was
  // reading a list that opened with "AI Campaign Builder".
  //
  // /crisis, /nearby and /developers had all shipped and were linked from
  // nowhere in the footer. (/give was here too, until portfolio split gifts were
  // withdrawn — it now redirects to /campaigns and is no longer navigation.)
  'Ways to Give': [
    { label: 'Browse Campaigns', href: '/campaigns', labelKey: 'footer.link.campaigns' },
    { label: 'Current Needs', href: '/needs', labelKey: 'footer.link.needs' },
    { label: 'Crisis Relief', href: '/crisis', labelKey: 'footer.link.crisis' },
    { label: 'Fundraisers Near You', href: '/nearby', labelKey: 'footer.link.nearby' },
    { label: 'Volunteer', href: '/volunteer', labelKey: 'footer.link.volunteer' },
    { label: 'Sponsor a Cause', href: '/sponsor', labelKey: 'footer.link.sponsor' },
    { label: 'Matching Gifts', href: '/matching', labelKey: 'footer.link.matching' },
    { label: 'Grants', href: '/grants', labelKey: 'footer.link.grants' },
    { label: 'Events', href: '/events', labelKey: 'footer.link.events' },
    { label: 'Giving Days', href: '/giving-days', labelKey: 'footer.link.giving_days' },
    { label: 'Webinars', href: '/webinars', labelKey: 'footer.link.webinars' },
    { label: 'Impact Map', href: '/impact-map', labelKey: 'footer.link.impact_map' },
    { label: 'Donor Wall', href: '/donor-wall', labelKey: 'footer.link.donor_wall' },
    { label: 'Ambassador Programme', href: '/ambassadors', labelKey: 'footer.link.ambassadors' },
  ],
  Company: [
    { label: 'About Us', href: '/about-us', labelKey: 'footer.link.about_us' },
    { label: 'Contact Us', href: '/contact', labelKey: 'footer.link.contact' },
    { label: 'For Nonprofits', href: '/for-nonprofits', labelKey: 'footer.link.for_nonprofits' },
    { label: 'For Individuals', href: '/for-individuals', labelKey: 'footer.link.for_individuals' },
    { label: 'For Donors', href: '/for-donors', labelKey: 'footer.link.for_donors' },
    { label: 'Blog', href: '/blog', labelKey: 'footer.link.blog' },
    { label: 'Changelog', href: '/changelog', labelKey: 'footer.link.changelog' },
    { label: 'Help Center', href: '/help', labelKey: 'footer.link.help' },
    { label: 'FAQ', href: '/faq', labelKey: 'footer.link.faq' },
    { label: 'Supported Countries', href: '/supported-countries', labelKey: 'footer.link.supported_countries' },
    { label: 'Resources', href: '/resources', labelKey: 'footer.link.resources' },
    { label: 'Community', href: '/community', labelKey: 'footer.link.community' },
    { label: 'Glossary', href: '/glossary', labelKey: 'footer.link.glossary' },
    { label: 'Careers', href: '/careers', labelKey: 'footer.link.careers' },
    // The footer is the only global surface that can carry /newsletter — it is
    // not a header destination — and `nav-orphans` refuses a sitemap route that
    // nothing links, which is how /signup got here too.
    { label: 'Newsletter', href: '/newsletter', labelKey: 'footer.link.newsletter' },
  ],
  Legal: [
    { label: 'Trust & Safety', href: '/trust-safety', labelKey: 'footer.link.trust_safety' },
    { label: 'Community Guidelines', href: '/community-guidelines', labelKey: 'footer.link.community_guidelines' },
    { label: 'Verification', href: '/verification', labelKey: 'footer.link.verification' },
    { label: 'System Status', href: '/status', labelKey: 'footer.link.status' },
    { label: 'Our Impact', href: '/impact', labelKey: 'footer.link.impact' },
    { label: 'Transparency Center', href: '/transparency', labelKey: 'footer.link.transparency' },
    { label: 'Fee Policy', href: '/fees', labelKey: 'footer.link.fees' },
    { label: 'Refund Policy', href: '/refunds', labelKey: 'footer.link.refunds' },
    { label: 'Send Feedback', href: '/feedback', labelKey: 'footer.link.feedback' },
    { label: 'Internships', href: '/internships', labelKey: 'footer.link.internships' },
    { label: 'Press', href: '/press', labelKey: 'footer.link.press' },
    { label: 'Brand Assets', href: '/brand-assets', labelKey: 'footer.link.brand_assets' },
    // "Privacy Center" (/privacy-center) used to sit here and REQUIRES A SESSION,
    // so a signed-out visitor clicking it from any page landed on /login with no
    // explanation. The legal bar already carries Privacy Notice, Cookie Policy
    // and the privacy controls, so nothing public is lost by dropping it.
    { label: 'Privacy Policy', href: '/privacy', labelKey: 'footer.link.privacy_policy' },
    { label: 'Terms of Service', href: '/terms', labelKey: 'footer.link.terms_of_service' },
    { label: 'Security', href: '/security', labelKey: 'footer.link.security' },
    { label: 'Prohibited Use', href: '/prohibited-use', labelKey: 'footer.link.prohibited_use' },
  ],
};

export const FOOTER_SECTION_ORDER: readonly FooterSectionName[] = [
  'Platform', 'Ways to Give', 'Company', 'Legal',
];

/**
 * The bar under the copyright line. These are the canonical destinations for
 * their policies — anything here is stripped from the columns above.
 */
export const FOOTER_LEGAL_BAR: readonly FooterLink[] = [
  { label: 'Terms', href: '/terms', labelKey: 'footer.link.terms' },
  { label: 'Privacy Notice', href: '/privacy', labelKey: 'footer.link.privacy_notice' },
  { label: 'Legal', href: '/legal', labelKey: 'footer.link.legal' },
  { label: 'Accessibility Statement', href: '/accessibility', labelKey: 'footer.link.accessibility' },
  { label: 'Cookie Policy', href: '/cookies', labelKey: 'footer.link.cookies' },
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
