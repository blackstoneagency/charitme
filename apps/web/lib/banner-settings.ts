import 'server-only';
import { unstable_cache } from 'next/cache';
import { supabaseAdmin } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Site-wide announcement-banner appearance, controlled by super admins.
//
// SECURITY: every field here is interpolated into an inline `style`, so each one
// is re-validated on read — not just on write. A value that fails validation
// falls back to the default rather than reaching the DOM, so even a row edited
// directly in the database cannot inject CSS.
// ─────────────────────────────────────────────────────────────────────────────

export type BannerTextAlign = 'left' | 'center' | 'right';

export interface BannerSettings {
  enabled: boolean;
  backgroundColor: string;
  textColor: string;
  linkColor: string;
  fontFamily: string;
  fontSizePx: number;
  titleFontSizePx: number;
  fontWeight: number;
  titleFontWeight: number;
  textAlign: BannerTextAlign;
  letterSpacingEm: number;
  uppercase: boolean;
  paddingYPx: number;
  dismissible: boolean;
  useLevelColors: boolean;
}

/**
 * Reproduces the banner as it looked before it became configurable, with one
 * correction: the background was `#12b76a`, which gives white banner text only
 * **2.62:1** contrast (WCAG AA needs 4.5:1). Because the banner renders on every
 * page, that single default dropped sitewide Lighthouse accessibility from 100 to
 * 94-96. `#08763b` is the app's AA-safe green (`--green-dark`, 5.68:1 on white).
 */
export const DEFAULT_BANNER_SETTINGS: BannerSettings = {
  enabled: true,
  backgroundColor: '#08763b',
  textColor: '#ffffff',
  linkColor: '#ffffff',
  fontFamily: 'inherit',
  fontSizePx: 14,
  titleFontSizePx: 14,
  fontWeight: 400,
  titleFontWeight: 700,
  textAlign: 'left',
  letterSpacingEm: 0,
  uppercase: false,
  paddingYPx: 9,
  dismissible: true,
  useLevelColors: false,
};

/**
 * The font stacks a super admin may choose. An allow-list (rather than a free
 * text field) is deliberate: `font-family` accepts arbitrary text, and letting
 * it through unfiltered would be a CSS-injection vector.
 */
export const BANNER_FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Site default',      value: 'inherit' },
  { label: 'System sans',       value: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  { label: 'Georgia (serif)',   value: 'Georgia, "Times New Roman", serif' },
  { label: 'Monospace',         value: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
  { label: 'Rounded',           value: '"Nunito", "Quicksand", ui-rounded, system-ui, sans-serif' },
];

export const BANNER_FONT_WEIGHTS = [300, 400, 500, 600, 700, 800, 900] as const;

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
const ALLOWED_FONTS = new Set(BANNER_FONT_OPTIONS.map((f) => f.value));

/** A safe hex colour, or the fallback. Never returns caller-controlled text. */
export function safeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value.trim()) ? value.trim() : fallback;
}

/** A font stack from the allow-list, or the fallback. */
export function safeFontFamily(value: unknown, fallback: string): string {
  return typeof value === 'string' && ALLOWED_FONTS.has(value) ? value : fallback;
}

function safeInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  const r = Math.round(n);
  return r >= min && r <= max ? r : fallback;
}

function safeNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(n)) return fallback;
  return n >= min && n <= max ? n : fallback;
}

function safeWeight(value: unknown, fallback: number): number {
  const n = safeInt(value, 100, 900, fallback);
  return (BANNER_FONT_WEIGHTS as readonly number[]).includes(n) ? n : fallback;
}

function safeAlign(value: unknown, fallback: BannerTextAlign): BannerTextAlign {
  return value === 'left' || value === 'center' || value === 'right' ? value : fallback;
}

type Row = Record<string, unknown> | null | undefined;

/** Coerce a raw DB row into settings that are always safe to render. Pure. */
export function normalizeBannerSettings(row: Row): BannerSettings {
  const d = DEFAULT_BANNER_SETTINGS;
  if (!row) return d;
  return {
    enabled:         typeof row.enabled === 'boolean' ? row.enabled : d.enabled,
    backgroundColor: safeColor(row.background_color, d.backgroundColor),
    textColor:       safeColor(row.text_color, d.textColor),
    linkColor:       safeColor(row.link_color, d.linkColor),
    fontFamily:      safeFontFamily(row.font_family, d.fontFamily),
    fontSizePx:      safeInt(row.font_size_px, 10, 28, d.fontSizePx),
    titleFontSizePx: safeInt(row.title_font_size_px, 10, 28, d.titleFontSizePx),
    fontWeight:      safeWeight(row.font_weight, d.fontWeight),
    titleFontWeight: safeWeight(row.title_font_weight, d.titleFontWeight),
    textAlign:       safeAlign(row.text_align, d.textAlign),
    letterSpacingEm: safeNum(row.letter_spacing_em, -0.05, 0.5, d.letterSpacingEm),
    uppercase:       typeof row.uppercase === 'boolean' ? row.uppercase : d.uppercase,
    paddingYPx:      safeInt(row.padding_y_px, 0, 40, d.paddingYPx),
    dismissible:     typeof row.dismissible === 'boolean' ? row.dismissible : d.dismissible,
    useLevelColors:  typeof row.use_level_colors === 'boolean' ? row.use_level_colors : d.useLevelColors,
  };
}

// Cached like getActiveAnnouncements so rendering the banner in the (static) root
// layout doesn't force the whole app dynamic. Revalidates on the same 60s window,
// and the API busts the 'banner-settings' tag on save for an immediate update.
const fetchBannerSettings = unstable_cache(
  async (): Promise<BannerSettings> => {
    try {
      const { data } = await supabaseAdmin
        .from('banner_settings')
        .select('*')
        .eq('id', 'global')
        .maybeSingle();
      return normalizeBannerSettings(data as Row);
    } catch {
      // Table missing (migration not yet applied) or DB unavailable — render the
      // banner exactly as it looked before this feature existed.
      return DEFAULT_BANNER_SETTINGS;
    }
  },
  ['banner-settings'],
  { revalidate: 60, tags: ['banner-settings'] },
);

export async function getBannerSettings(): Promise<BannerSettings> {
  return fetchBannerSettings();
}
