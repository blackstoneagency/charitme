/**
 * Signed-in left navigation: persona defaults → platform overrides → per-user overrides.
 *
 * ── Why this is a PURE module ──────────────────────────────────────────────
 * Three inputs decide what a person sees in the sidebar, and two of them are
 * user-editable. That is exactly the shape that goes wrong silently: a bad
 * override does not throw, it just renders a nav that is missing the item
 * someone needed. So the composition lives here, with no Supabase import and no
 * React, and is tested directly — the loaders around it only fetch rows.
 *
 * ── The layers, and who owns each ──────────────────────────────────────────
 *   1. PERSONA DEFAULTS  (lib/persona-navigation.ts) — what the role gets.
 *   2. PLATFORM OVERRIDE (Super Admin, platform_settings.config.navigation) —
 *      applies to everyone with that role. This is the "template" control.
 *   3. USER OVERRIDE     (user_nav_preferences) — one person's own sidebar.
 *
 * Later layers win, but only ever by REORDERING or HIDING items the persona
 * already had. An override cannot introduce a link, which is deliberate: the
 * sidebar would otherwise become a way to point staff at routes their role does
 * not grant, and authorization lives server-side, not in a nav list.
 */

export type NavItemLike = {
  label: string;
  href: string;
  icon: string;
  badge?: string;
};

export type NavOverride = {
  /** hrefs to hide. Unknown hrefs are ignored. */
  hidden?: string[];
  /** hrefs in the order they should appear. Unlisted items keep their relative order, after these. */
  order?: string[];
};

export type NavOverrideMap = Record<string, NavOverride>;

/** An override that changes nothing — the safe result for absent or malformed input. */
export const EMPTY_OVERRIDE: NavOverride = {};

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((v): v is string => typeof v === 'string' && v.length > 0);
  return out.length > 0 ? out : undefined;
}

/**
 * Parse an override from untrusted JSON (a settings blob or a database row).
 *
 * Anything unrecognised yields `{}` rather than throwing. A malformed override
 * must degrade to "no customization", never to an empty or broken sidebar —
 * this runs on every signed-in page render.
 */
export function parseNavOverride(raw: unknown): NavOverride {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return EMPTY_OVERRIDE;
  const record = raw as Record<string, unknown>;
  const hidden = asStringArray(record.hidden);
  const order = asStringArray(record.order);
  const out: NavOverride = {};
  if (hidden) out.hidden = hidden;
  if (order) out.order = order;
  return out;
}

/**
 * Parse a role→override map, e.g. `platform_settings.config.navigation.byRole`.
 *
 * ⚠️ Accepts a JSON STRING as well as an object. Every other structured value in
 * `platform_settings.config` is stored stringified (see `DEFAULTS.about.impactStats`),
 * so an object-only parser would return `{}` for a setting the Super Admin had
 * actually saved — the setting would appear to do nothing, with no error anywhere.
 */
export function parseNavOverrideMap(raw: unknown): NavOverrideMap {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: NavOverrideMap = {};
  for (const [role, entry] of Object.entries(value as Record<string, unknown>)) {
    const parsed = parseNavOverride(entry);
    if (parsed.hidden || parsed.order) out[role] = parsed;
  }
  return out;
}

/**
 * Apply one override layer.
 *
 * ⚠️ Hiding EVERY item is treated as no override at all. A sidebar with zero
 * links strands the person on whatever page they are on — there is no way back
 * to the dashboard, and on mobile the sidebar is the only navigation. A
 * customization screen that can lock someone out of the product is worse than
 * one that quietly refuses the last removal, so the floor is enforced here
 * rather than trusted to every caller's validation.
 */
export function applyNavOverride<T extends NavItemLike>(
  items: readonly T[],
  override: NavOverride | undefined,
): T[] {
  if (!override || (!override.hidden && !override.order)) return [...items];

  const hidden = new Set(override.hidden ?? []);
  const visible = items.filter((item) => !hidden.has(item.href));
  // Everything hidden → refuse the override rather than render an empty nav.
  if (visible.length === 0) return [...items];

  if (!override.order) return visible;

  const rank = new Map(override.order.map((href, index) => [href, index]));
  // Stable: listed items first in the given order, then the rest in their
  // original order. A partial `order` is the common case — someone pins two
  // items to the top and leaves the remainder alone.
  return [...visible].sort((a, b) => {
    const ra = rank.has(a.href) ? rank.get(a.href)! : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.href) ? rank.get(b.href)! : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return items.indexOf(a) - items.indexOf(b);
  });
}

/**
 * The composed sidebar for one person.
 *
 * `platform` is keyed by role so a Super Admin can shape, say, every donor's
 * sidebar without touching organizers'.
 */
export function composeNavigation<T extends NavItemLike>(
  personaItems: readonly T[],
  role: string,
  platform: NavOverrideMap | undefined,
  user: NavOverride | undefined,
): T[] {
  const afterPlatform = applyNavOverride(personaItems, platform?.[role]);
  return applyNavOverride(afterPlatform, user);
}
