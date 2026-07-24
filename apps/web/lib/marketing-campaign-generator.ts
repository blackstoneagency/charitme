// Deterministic, dependency-free multichannel campaign generator.
// Given a goal, it assembles a connected set of real draft assets (landing page,
// email, social, SEO metadata, FAQ) that share the same audience, message, and
// CTA. Content is brand-safe by construction: no guarantees, no tax-deductibility
// or fee claims, no fabricated statistics. Every asset is a human-editable draft.

export interface GoalLike {
  title: string;
  objective?: string | null;
  category?: string | null;
  geography?: string | null;
  audience?: string | null;
  target_metric?: string | null;
}

export interface AssetDraft {
  asset_type: 'landing_page' | 'email' | 'social_post' | 'seo_meta' | 'faq';
  channel: 'web' | 'email' | 'social' | 'search';
  title: string;
  body: string;
  meta: Record<string, unknown>;
  sort_order: number;
}

export interface GeneratedPlan {
  plan: { title: string; objective: string; audience: string | null; geography: string | null; category: string | null; summary: string };
  assets: AssetDraft[];
}

function focus(goal: GoalLike): string {
  const cat = goal.category ? `${goal.category.toLowerCase()} ` : '';
  return `${cat}fundraisers`.trim();
}
function place(goal: GoalLike): string {
  return goal.geography ? ` in ${goal.geography}` : '';
}
function who(goal: GoalLike): string {
  return goal.audience || 'organizers and donors';
}

/** Search-result limits the generated SEO metadata is composed to respect. */
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;

/**
 * Pick the first candidate that fits `max`, progressively shedding optional
 * detail (region, audience). If even the shortest candidate is too long — a very
 * long category name — it is clamped at a word boundary with an ellipsis so the
 * limit always holds.
 */
export function fitSeo(candidates: string[], max: number): string {
  for (const c of candidates) {
    if (c.length <= max) return c;
  }
  const last = candidates[candidates.length - 1] ?? '';
  if (last.length <= max) return last;
  const cut = last.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export function generateCampaignPlan(goal: GoalLike): GeneratedPlan {
  const theme = focus(goal);
  const region = place(goal);
  const audience = who(goal);
  const cat = goal.category || 'community';
  const cta = 'Start your fundraiser';

  const summary =
    `Multichannel campaign to advance the goal “${goal.title}”. Targets ${audience}${region} around ${theme}, ` +
    `with a shared message and call-to-action across a landing page, email, social, search, and FAQ. All assets are drafts pending review.`;

  const landingBody =
    `# Raise more for what matters${region ? `,${region}` : ''}\n\n` +
    `CharitMe helps ${audience} turn a cause into a campaign in minutes — with the tools to reach donors and keep them coming back.\n\n` +
    `## Why ${cat} organizers choose CharitMe\n` +
    `- Set up a ${theme.replace(/s$/, '')} in minutes, on any device\n` +
    `- Share to social, email, and text with built-in tools\n` +
    `- Keep supporters updated so they give again\n\n` +
    `## How it works\n` +
    `1. Tell your story and set a goal\n` +
    `2. Share your campaign link\n` +
    `3. Thank donors and post updates\n\n` +
    `**${cta} →**`;

  const emailBody =
    `Subject: A better way to raise money for ${theme}${region}\n\n` +
    `Hi there,\n\n` +
    `Starting a ${cat.toLowerCase()} campaign shouldn’t be hard. On CharitMe you can create a fundraiser in minutes, ` +
    `share it everywhere, and keep supporters engaged with updates.\n\n` +
    `If you’ve been meaning to get started, now is a great time.\n\n` +
    `${cta}: {{campaign_url}}\n\n` +
    `— The CharitMe Team\n\n` +
    `You’re receiving this because you opted in. Unsubscribe: {{unsubscribe_url}}`;

  const social = [
    `Have a cause you care about${region}? Turn it into a ${theme.replace(/s$/, '')} on CharitMe in minutes. ${cta} → {{campaign_url}} #fundraising`,
    `${audience[0].toUpperCase()}${audience.slice(1)}: your community is ready to help. Launch a ${cat.toLowerCase()} campaign today. {{campaign_url}}`,
    `Every big goal starts with one share. Create your fundraiser${region} and reach the people who want to give. {{campaign_url}}`,
  ];

  const faqBody = [
    `Q: How long does it take to start a ${cat.toLowerCase()} fundraiser?\nA: Most organizers create a campaign in a few minutes — add your story, set a goal, and share your link.`,
    `Q: Who can I reach${region}?\nA: Share your campaign by social, email, and text. CharitMe includes tools to help supporters share it further.`,
    `Q: How do I keep donors engaged?\nA: Post updates and thank donors from your dashboard — campaigns with regular updates tend to keep supporters involved.`,
    `Q: What happens after I reach my goal?\nA: You can keep raising, post a final update, and start a new campaign whenever you’re ready.`,
  ].join('\n\n');

  // Search engines truncate around 60 chars (title) and 160 (description), so the
  // generated metadata is composed to fit: the region/audience tail is dropped
  // before the core message, and a hard clamp guarantees the limit is never
  // exceeded no matter how long a goal's category/geography/audience is.
  const seoTitle = fitSeo(
    [`Start a ${cat} fundraiser${region} | CharitMe`, `Start a ${cat} fundraiser | CharitMe`, `${cat} fundraising | CharitMe`],
    SEO_TITLE_MAX,
  );
  const seoDescription = fitSeo(
    [
      `Create a ${cat.toLowerCase()} fundraiser${region} on CharitMe. Set a goal, share your story, and reach donors — for ${audience}.`,
      `Create a ${cat.toLowerCase()} fundraiser${region} on CharitMe. Set a goal, share your story, and reach donors.`,
      `Create a ${cat.toLowerCase()} fundraiser on CharitMe. Set a goal, share your story, and reach donors.`,
    ],
    SEO_DESCRIPTION_MAX,
  );

  const assets: AssetDraft[] = [
    { asset_type: 'landing_page', channel: 'web', title: `${cat} campaign landing page`, body: landingBody, meta: { cta }, sort_order: 0 },
    { asset_type: 'email', channel: 'email', title: `${cat} organizer outreach email`, body: emailBody, meta: { audience }, sort_order: 1 },
    { asset_type: 'social_post', channel: 'social', title: 'Social post — awareness', body: social[0], meta: { variant: 'awareness' }, sort_order: 2 },
    { asset_type: 'social_post', channel: 'social', title: 'Social post — audience call', body: social[1], meta: { variant: 'audience' }, sort_order: 3 },
    { asset_type: 'social_post', channel: 'social', title: 'Social post — share nudge', body: social[2], meta: { variant: 'share' }, sort_order: 4 },
    { asset_type: 'seo_meta', channel: 'search', title: 'SEO metadata', body: `${seoTitle}\n\n${seoDescription}`, meta: { seo_title: seoTitle, seo_description: seoDescription, keywords: [cat.toLowerCase(), 'fundraiser', 'donations', goal.geography].filter(Boolean) }, sort_order: 5 },
    { asset_type: 'faq', channel: 'web', title: 'Campaign FAQ', body: faqBody, meta: { count: 4 }, sort_order: 6 },
  ];

  return {
    plan: {
      title: `Campaign — ${goal.title}`,
      objective: goal.objective || goal.title,
      audience: goal.audience ?? null,
      geography: goal.geography ?? null,
      category: goal.category ?? null,
      summary,
    },
    assets,
  };
}
