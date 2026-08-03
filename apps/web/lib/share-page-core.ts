/**
 * Public share page — pure helpers.
 *
 * The supporter-facing counterpart to `/dashboard/campaigns/[id]/share`, which
 * is owner-gated. A supporter who wants to spread a campaign had no page to open:
 * the campaign detail page has inline share buttons, but nothing linkable and
 * nothing a campaign can point at in a text message.
 *
 * No Supabase, no `server-only` — message building and stat shaping only.
 */

export type ShareStats = {
  /** Total recorded shares for this campaign. */
  shares: number;
  /** Shares that a donation was later attributed to. */
  converted: number;
};

/**
 * Share → donation conversion, or `null` when there is nothing to divide by.
 *
 * `null` rather than 0%: a campaign nobody has shared yet has not achieved a 0%
 * conversion rate, it has no rate at all. Rendering "0%" beside a share button
 * would be actively discouraging, and wrong.
 */
export function conversionRate(stats: ShareStats): number | null {
  if (stats.shares <= 0) return null;
  return Math.round((stats.converted / stats.shares) * 100);
}

/**
 * The line that tells a supporter their share is worth making.
 *
 * Deliberately returns `null` below a floor rather than quoting a percentage off
 * two or three events. "100% of shares led to a donation" from a single share is
 * technically true, useless, and reads as a fabricated statistic — which costs
 * more trust than saying nothing.
 */
export const MIN_SHARES_FOR_RATE = 10;

export function describeShareImpact(stats: ShareStats): string | null {
  if (stats.shares < MIN_SHARES_FOR_RATE) return null;
  const rate = conversionRate(stats);
  if (rate === null || rate <= 0) return null;
  return `${rate}% of shares for this campaign have led to a donation.`;
}

/** Suggested messages a supporter can copy, rather than facing an empty box. */
export type ShareTemplate = {
  id: string;
  label: string;
  /** Where it is meant to go — shapes length and tone. */
  medium: 'short' | 'long';
  build: (campaignTitle: string, url: string) => string;
};

/**
 * Templates are FUNCTIONS of the campaign, not fill-in-the-blank strings, so a
 * campaign title containing an apostrophe or an emoji composes correctly instead
 * of needing escaping at the call site.
 *
 * Kept deliberately plain: no false urgency, no invented claims about the
 * campaign, nothing a supporter would be embarrassed to have sent under their
 * own name. Every one is editable before sending.
 */
export const SHARE_TEMPLATES: readonly ShareTemplate[] = [
  {
    id: 'personal',
    label: 'Personal note',
    medium: 'short',
    build: (title, url) =>
      `I'm supporting "${title}" and thought of you. Even a small amount helps, and sharing it helps just as much: ${url}`,
  },
  {
    id: 'why-it-matters',
    label: 'Why it matters',
    medium: 'long',
    build: (title, url) =>
      `"${title}" is raising money for something I care about. Every donation goes to the organiser — the platform takes 0%. If you can give, here's the link; if you can't, sharing it costs nothing and genuinely helps: ${url}`,
  },
  {
    id: 'ask-to-share',
    label: 'Ask to share',
    medium: 'short',
    build: (title, url) =>
      `No pressure to donate — but would you share this? "${title}" reaches more people every time someone passes it on. ${url}`,
  },
  {
    id: 'workplace',
    label: 'For a group or workplace',
    medium: 'long',
    build: (title, url) =>
      `Sharing a campaign a few of us are supporting: "${title}". If anyone would like to chip in, the link is below — and some employers will match what you give. ${url}`,
  },
];

export function buildTemplate(id: string, campaignTitle: string, url: string): string | null {
  const template = SHARE_TEMPLATES.find((t) => t.id === id);
  if (!template) return null;
  return template.build(campaignTitle, url);
}

/**
 * Absolute campaign URL, with the share attribution parameter.
 *
 * The `utm_*` values line up with what `POST /api/share-events` records and what
 * the Stripe webhook reads back when it marks a share converted, so a link
 * pasted from here is attributable end to end rather than arriving anonymous.
 */
export function campaignShareUrl(origin: string, slug: string, channel?: string): string {
  const base = `${origin.replace(/\/$/, '')}/campaigns/${slug}`;
  if (!channel) return base;
  const params = new URLSearchParams({ utm_source: 'share-page', utm_medium: channel, utm_campaign: slug });
  return `${base}?${params.toString()}`;
}
