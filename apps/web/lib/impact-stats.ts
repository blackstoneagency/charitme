import 'server-only';
import { unstable_cache } from 'next/cache';
import { supabaseAdmin } from './supabase';

/**
 * The "Our Impact" / "Our Impact in Numbers" strip, owner-controlled.
 *
 * ── Why this exists, and why it is ONE module ──────────────────────────────
 * Two designs — /about-us and /success-stories — show the same five-tile strip
 * with the same five figures. Two copies of that is how this repo's three
 * hand-maintained copies of CAMPAIGN_CATEGORIES drifted, and a number that
 * disagrees with itself across two pages of the same site is worse than a wrong
 * number on one: it tells the visitor at least one page is lying.
 *
 * ── Why the reference figures are not hardcoded ────────────────────────────
 * The designs read:
 *
 *     2.3M+ People Helped · 68K+ Lives Transformed · 1,250+ Programs Funded
 *     120+ Countries Reached · 98% Funds to Programs
 *
 * Measured against the live database on 2026-08-08, the platform has **352
 * active campaigns, $96,850 raised, 592 gifts and 69 supported countries**. Two
 * of the reference figures are roughly a thousand times the measured value, and
 * "98% Funds to Programs" contradicts this platform's own fee model — the
 * platform fee is 0% and /fees says 100% of a gift reaches the cause.
 *
 * Baking those five numbers into the page would put unverifiable impact claims
 * on a fundraising site, which is the class of claim a donor decides with. So
 * they are neither invented here nor refused: the strip is an **owner-editable
 * setting** (Super Admin → System Settings → About page), stored in
 * `platform_settings.config.about.impactStats`, read from Supabase like every
 * other setting on this page. Entering the design's figures is one edit, made
 * by the person entitled to make that claim.
 *
 * Until they do, the strip falls back to the MEASURED figures the caller passes
 * in — real numbers, from the same loader /causes and /campaigns use.
 */

export interface ImpactTile {
  /** Rendered verbatim: "2.3M+", "98%", "$96,850". Formatting is the owner's. */
  value: string;
  label: string;
}

/** Five tiles in both designs. More would wrap the strip onto a second row. */
export const MAX_IMPACT_TILES = 5;

/** Long enough for "$113,950" and "Lives Transformed"; short enough not to break the layout. */
const MAX_VALUE_LEN = 12;
const MAX_LABEL_LEN = 32;

/**
 * Parse the owner's tiles.
 *
 * Anything unusable is DROPPED rather than rendered blank — a tile with a
 * number and no label is a figure with no claim attached, which is worse on
 * this page than one fewer tile. An entry that is present but over-long is
 * truncated rather than dropped, because the owner clearly meant to say
 * something.
 */
export function parseImpactTiles(raw: unknown): ImpactTile[] {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  const out: ImpactTile[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const tileValue = typeof r.value === 'string' ? r.value.trim() : '';
    const label = typeof r.label === 'string' ? r.label.trim() : '';
    if (!tileValue || !label) continue;
    out.push({
      value: tileValue.slice(0, MAX_VALUE_LEN),
      label: label.slice(0, MAX_LABEL_LEN),
    });
    if (out.length === MAX_IMPACT_TILES) break;
  }
  return out;
}

/**
 * The owner's tiles, or `[]` when none are configured.
 *
 * Cached on the same `platform-settings` tag the Super Admin save already
 * busts, so an edit appears without waiting out the revalidate window.
 */
const fetchImpactTiles = unstable_cache(
  async (): Promise<ImpactTile[]> => {
    try {
      const { data, error } = await supabaseAdmin
        .from('platform_settings')
        .select('config')
        .eq('id', 1)
        .maybeSingle();

      // supabase-js resolves rather than throws on a failed query, so an
      // unchecked error would silently look like "the owner set nothing".
      if (error) return [];

      const config = data?.config && typeof data.config === 'object' && !Array.isArray(data.config)
        ? (data.config as Record<string, unknown>)
        : {};
      const about = config.about && typeof config.about === 'object' && !Array.isArray(config.about)
        ? (config.about as Record<string, unknown>)
        : {};

      // ⚠️ `[]`, NOT `DEFAULTS.about.impactStats`.
      //
      // This module's contract — stated in its own docstrings — is "[] when none
      // are configured", so the caller can fall back to figures it MEASURED. The
      // `?? DEFAULTS` did the opposite: an owner who had configured nothing got
      // the hardcoded marketing literals (2.3M+ People Helped, 68K+ Lives
      // Transformed, 98% Funds to Programs) rendered to donors as fact. Measured
      // production reality is 352 active campaigns, $96,850 raised, 592 gifts —
      // three orders of magnitude apart — and "98% to programs" contradicts /fees,
      // which correctly says 0% platform fee.
      //
      // DEFAULTS remains the seed the admin settings UI offers (app/admin/system,
      // /api/admin/settings, lib/about-page) — which is what it is for. It is just
      // no longer a silent fallback for a page that shows numbers to donors.
      return parseImpactTiles(about.impactStats ?? []);
    } catch {
      // supabaseAdmin throws on property access when its env is unset.
      return [];
    }
  },
  ['impact-stats-tiles'],
  { revalidate: 60, tags: ['about-content', 'platform-settings'] },
);

/**
 * `resolveImpactTiles(measured)` — the owner's figures if set, else the measured ones.
 *
 * The caller supplies `measured` because only it knows which numbers its own
 * page has already loaded; this module never queries campaign or donation
 * totals itself, so there is exactly one loader per page rather than two that
 * can disagree.
 */
export async function resolveImpactTiles(measured: ImpactTile[]): Promise<ImpactTile[]> {
  const owner = await fetchImpactTiles();
  return owner.length > 0 ? owner : measured.slice(0, MAX_IMPACT_TILES);
}
