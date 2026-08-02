/**
 * Partner/sponsor display rules — pure, no Supabase, no `server-only`.
 *
 * Split from `sponsors-server.ts` so these can be tested directly: importing the
 * server module into a unit test pulls in `server-only` and fails.
 */

export type Sponsor = {
  id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
};

/**
 * A partner is only renderable if there is something to show for it.
 *
 * Mirrors the filter `/api/sponsors` already applies, kept in one place so the
 * page and the endpoint agree: a row with neither a logo nor a website renders
 * as a bare word in a logo strip, which reads as a rendering bug.
 */
export function isDisplayable(sponsor: Sponsor): boolean {
  return Boolean(sponsor.logo_url?.startsWith('http') || sponsor.website);
}

/**
 * Favicon fallback for a partner with a website but no uploaded logo.
 *
 * Google's favicon service rather than a guessed `/favicon.ico`, which is
 * missing often enough to leave broken images across the strip.
 */
export function sponsorLogoUrl(sponsor: Sponsor): string | null {
  if (sponsor.logo_url?.startsWith('http')) return sponsor.logo_url;
  if (!sponsor.website) return null;
  try {
    const host = new URL(sponsor.website).hostname;
    if (!host) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  } catch {
    // A malformed stored website is not a reason to render a broken image.
    return null;
  }
}

/**
 * Absolute, http(s)-only outbound link, or `null` if the stored value is unusable.
 *
 * The value is administrator-entered, but administrator-entered is not the same
 * as safe — a stored `javascript:` URL would become a live link in a page anyone
 * can open. Anything but http(s) is refused rather than rendered.
 */
export function sponsorHref(sponsor: Sponsor): string | null {
  if (!sponsor.website) return null;
  try {
    const url = new URL(sponsor.website);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Partners worth rendering, in the admin's chosen order. */
export function displayableSponsors(sponsors: readonly Sponsor[]): Sponsor[] {
  return sponsors.filter(isDisplayable);
}
