/**
 * The donation widget's option model.
 *
 * This is pure on purpose. A widget configurator has exactly one requirement
 * that matters: **the preview must be the thing the snippet produces.** If the
 * preview panel and the generated `<iframe>` read the options through different
 * code, they drift, and the fundraiser pastes a widget onto their site that
 * looks nothing like what they approved — a defect they only discover in
 * public. So the preview URL and the snippet URL are built by the SAME function
 * here, from the same options, and `/campaigns/[slug]/embed` parses them back
 * with `parseWidgetOptions`. Round-tripping is asserted in the tests.
 *
 * Heights are computed rather than fixed for the same reason: an iframe sized
 * for a widget with a cover image leaves a band of blank page under one without
 * it, and `height="500"` in a copied snippet is not something the fundraiser
 * will think to adjust.
 */

export type WidgetTheme = 'auto' | 'light' | 'dark';

export type WidgetOptions = Readonly<{
  theme: WidgetTheme;
  showCover: boolean;
  showProgress: boolean;
  showDonorCount: boolean;
  width: number;
}>;

export const WIDGET_MIN_WIDTH = 260;
export const WIDGET_MAX_WIDTH = 600;

/**
 * The default theme is `light`, not `auto`, because it has to be. Widget
 * snippets are already pasted on third-party sites and carry no `theme` param;
 * `.campaign-embed` has always painted itself light. Defaulting to `auto` would
 * silently repaint every one of those live widgets the moment this ships,
 * against a host page that may well be white.
 */
export const DEFAULT_WIDGET_OPTIONS: WidgetOptions = {
  theme: 'light',
  showCover: true,
  showProgress: true,
  showDonorCount: true,
  width: 400,
};

const THEMES: readonly WidgetTheme[] = ['auto', 'light', 'dark'];

function isTheme(value: unknown): value is WidgetTheme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/** `?cover=0` disables; anything else (including absent) keeps the default on. */
function readFlag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  if (raw === '0' || raw === 'false') return false;
  if (raw === '1' || raw === 'true') return true;
  return fallback;
}

export function clampWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_WIDGET_OPTIONS.width;
  return Math.min(WIDGET_MAX_WIDTH, Math.max(WIDGET_MIN_WIDTH, Math.round(value)));
}

type RawParams = Record<string, string | string[] | undefined>;

function first(params: RawParams, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Never throws and never rejects a request. A malformed query on an embedded
 * widget must render the DEFAULT widget on the fundraiser's site, not an error
 * page inside their iframe — the visitor cannot fix the URL and would simply see
 * a broken donation box.
 */
export function parseWidgetOptions(params: RawParams): WidgetOptions {
  const theme = first(params, 'theme');
  const width = first(params, 'width');
  return {
    theme: isTheme(theme) ? theme : DEFAULT_WIDGET_OPTIONS.theme,
    showCover: readFlag(first(params, 'cover'), DEFAULT_WIDGET_OPTIONS.showCover),
    showProgress: readFlag(first(params, 'progress'), DEFAULT_WIDGET_OPTIONS.showProgress),
    showDonorCount: readFlag(first(params, 'donors'), DEFAULT_WIDGET_OPTIONS.showDonorCount),
    width: width === undefined ? DEFAULT_WIDGET_OPTIONS.width : clampWidth(Number(width)),
  };
}

/**
 * Only non-default options are emitted, so the common case is a bare URL. Width
 * is deliberately excluded — it sizes the iframe element, not the page inside
 * it, and putting it in the query would imply the widget could disagree with
 * its own frame.
 */
export function widgetQuery(options: WidgetOptions): string {
  const q = new URLSearchParams();
  if (options.theme !== DEFAULT_WIDGET_OPTIONS.theme) q.set('theme', options.theme);
  if (!options.showCover) q.set('cover', '0');
  if (!options.showProgress) q.set('progress', '0');
  if (!options.showDonorCount) q.set('donors', '0');
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function widgetPath(slug: string, options: WidgetOptions): string {
  return `/campaigns/${encodeURIComponent(slug)}/embed${widgetQuery(options)}`;
}

const HEIGHT_BASE = 232; // padding + title + donate button + attribution
const HEIGHT_COVER = 174;
const HEIGHT_PROGRESS = 46;
const HEIGHT_DONORS = 22;

/** Sized from what is actually rendered — see the module note. */
export function widgetHeight(options: WidgetOptions): number {
  let h = HEIGHT_BASE;
  if (options.showCover) h += HEIGHT_COVER;
  if (options.showProgress) h += HEIGHT_PROGRESS;
  if (options.showProgress && options.showDonorCount) h += HEIGHT_DONORS;
  return h;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * `origin` must be absolute — a snippet pasted onto someone else's site cannot
 * resolve a relative path, and a widget that 404s on their domain is the whole
 * failure mode this function exists to avoid.
 */
export function embedSnippet(origin: string, slug: string, title: string, options: WidgetOptions): string {
  const src = escapeAttr(`${origin.replace(/\/+$/, '')}${widgetPath(slug, options)}`);
  const label = escapeAttr(`Donate to ${title}`);
  return [
    `<iframe src="${src}"`,
    `        width="${options.width}" height="${widgetHeight(options)}"`,
    `        style="border:0;max-width:100%" loading="lazy"`,
    `        title="${label}"></iframe>`,
  ].join('\n');
}
