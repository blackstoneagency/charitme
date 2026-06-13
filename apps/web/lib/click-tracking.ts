// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers for the /go/[code] click-tracking redirect route. Kept
// dependency-free so they can be unit-tested without Supabase/Next mocks.
// ─────────────────────────────────────────────────────────────────────────────

export interface UtmParams {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
}

const UTM_KEYS: Array<[keyof UtmParams, string]> = [
  ['source', 'utm_source'],
  ['medium', 'utm_medium'],
  ['campaign', 'utm_campaign'],
  ['term', 'utm_term'],
  ['content', 'utm_content'],
];

/**
 * Appends utm_* query params (from a marketing_utm_links row) onto a
 * destination URL, skipping any that are already present in the query
 * string. Works for absolute and relative URLs. Falls back to returning the
 * original string on invalid input.
 */
export function appendUtmParams(destinationUrl: string, utm: UtmParams): string {
  try {
    const isAbsolute = /^https?:\/\//i.test(destinationUrl);
    const url = new URL(destinationUrl, isAbsolute ? undefined : 'http://localhost');
    for (const [key, param] of UTM_KEYS) {
      const value = utm[key];
      if (value && !url.searchParams.has(param)) {
        url.searchParams.set(param, value);
      }
    }
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return destinationUrl;
  }
}

/**
 * Resolves a (possibly relative) destination into an absolute URL the
 * browser can be redirected to. Falls back to `${origin}/` on invalid input.
 */
export function resolveRedirectUrl(destination: string, origin: string): string {
  try {
    if (/^https?:\/\//i.test(destination)) return destination;
    return new URL(destination, origin).toString();
  } catch {
    return `${origin.replace(/\/$/, '')}/`;
  }
}

const SHORT_CODE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Random lowercase alphanumeric short code for /go/[code] links. */
export function generateShortCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SHORT_CODE_CHARS[bytes[i] % SHORT_CODE_CHARS.length];
  }
  return out;
}

/** Slugifies a campaign name for use as a utm_campaign value. */
export function slugifyCampaignName(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'campaign';
}

/**
 * Builds the /go/[code] tracking URL for a campaign recipient. `cid` is
 * omitted for anonymous (e.g. test-send) links.
 */
export function buildTrackingUrl(origin: string, shortCode: string, campaignId: string, contactId?: string): string {
  const url = new URL(`/go/${shortCode}`, origin);
  url.searchParams.set('camp', campaignId);
  if (contactId) url.searchParams.set('cid', contactId);
  return url.toString();
}
