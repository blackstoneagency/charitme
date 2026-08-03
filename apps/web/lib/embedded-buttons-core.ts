import {
  DEFAULT_WIDGET_OPTIONS,
  clampWidth,
  type WidgetOptions,
  type WidgetTheme,
} from './widget-embed';

/**
 * Saved embed buttons — the persistent form of the widget configurator.
 *
 * `/dashboard/campaigns/[id]/widget` builds a snippet and forgets it, so a
 * fundraiser who wants the same button on three pages configures it three times
 * and has no way to change them together later. `embedded_buttons` was built for
 * exactly that and had neither a reader nor a writer.
 *
 * Pure module: the type vocabulary, the config shape, and snippet generation.
 */

/**
 * Exactly the values the database CHECK allows, duplicated so a bad value is
 * refused with a readable reason rather than failing at the constraint. The test
 * diffs this against the schema mirror — a duplicated list that drifts is worse
 * than no list.
 */
export const BUTTON_TYPES = ['donate', 'tip', 'membership', 'product'] as const;
export type ButtonType = (typeof BUTTON_TYPES)[number];

export function isButtonType(value: unknown): value is ButtonType {
  return typeof value === 'string' && (BUTTON_TYPES as readonly string[]).includes(value);
}

export const LABEL_MAX_LENGTH = 60;

/** What a saved button remembers, beyond its target. */
export type ButtonConfig = Readonly<{
  theme: WidgetTheme;
  width: number;
  showCover: boolean;
  showProgress: boolean;
  showDonorCount: boolean;
}>;

export const DEFAULT_BUTTON_CONFIG: ButtonConfig = {
  theme: DEFAULT_WIDGET_OPTIONS.theme,
  width: DEFAULT_WIDGET_OPTIONS.width,
  showCover: DEFAULT_WIDGET_OPTIONS.showCover,
  showProgress: DEFAULT_WIDGET_OPTIONS.showProgress,
  showDonorCount: DEFAULT_WIDGET_OPTIONS.showDonorCount,
};

/**
 * Narrow arbitrary jsonb into a config.
 *
 * The column is `jsonb DEFAULT '{}'`, so every stored row may be missing any
 * field, and a row written by an older version of this code will be. Falling
 * back per-field rather than rejecting the whole object means an old button
 * still renders instead of disappearing from the list.
 */
export function parseButtonConfig(value: unknown): ButtonConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_BUTTON_CONFIG;
  const raw = value as Record<string, unknown>;
  const bool = (key: keyof ButtonConfig, fallback: boolean): boolean =>
    typeof raw[key] === 'boolean' ? (raw[key] as boolean) : fallback;
  const theme = raw.theme;
  return {
    theme: theme === 'light' || theme === 'dark' || theme === 'auto' ? theme : DEFAULT_BUTTON_CONFIG.theme,
    width: typeof raw.width === 'number' ? clampWidth(raw.width) : DEFAULT_BUTTON_CONFIG.width,
    showCover: bool('showCover', DEFAULT_BUTTON_CONFIG.showCover),
    showProgress: bool('showProgress', DEFAULT_BUTTON_CONFIG.showProgress),
    showDonorCount: bool('showDonorCount', DEFAULT_BUTTON_CONFIG.showDonorCount),
  };
}

/** A saved config is exactly the widget's option set — one shape, not two. */
export function toWidgetOptions(config: ButtonConfig): WidgetOptions {
  return {
    theme: config.theme,
    width: config.width,
    showCover: config.showCover,
    showProgress: config.showProgress,
    showDonorCount: config.showDonorCount,
  };
}

export function isValidLabel(label: string): boolean {
  const trimmed = label.trim();
  return trimmed.length > 0 && trimmed.length <= LABEL_MAX_LENGTH;
}

/**
 * A donate button needs a campaign to send money to.
 *
 * The column is nullable because the other three types target something else,
 * so the database cannot express this and the check has to live here. A donate
 * button with no campaign is a button that cannot take a donation — the exact
 * dead control this repo keeps finding.
 */
export function requiresCampaign(type: ButtonType): boolean {
  return type === 'donate';
}

export function isValidTarget(type: ButtonType, campaignId: string | null): boolean {
  if (requiresCampaign(type) && !campaignId) return false;
  return true;
}

/** Human label for the list view. */
export function describeButtonType(type: ButtonType): string {
  switch (type) {
    case 'donate': return 'Donation';
    case 'tip': return 'Tip';
    case 'membership': return 'Membership';
    case 'product': return 'Product';
  }
}
