// ─────────────────────────────────────────────────────────────────────────────
// How many featured campaigns may wear the highlight on one cause page.
//
// Measured on production once the flags were set: /causes/people-in-need came
// back with SIX of six cards ringed and badged, because it spans three
// categories (Family + Wishes + Memorial) at two featured each. A grid where
// every card is highlighted distinguishes nothing — visually it is identical to
// a grid where none is. The mark only means something while it is scarce.
//
// This is a PRESENTATION cap, deliberately. It does not unset `campaigns.featured`
// and does not change ordering: featured campaigns still sort ahead of
// `raised_amount`, so the same campaigns still occupy the top slots and every
// creator's placement is intact. Only the ring and badge are rationed.
//
// That distinction matters because `featured` is also what the Stripe webhook
// sets when a creator PAYS for rotator placement. Solving a visual problem by
// clearing flags would take away something people bought; capping the treatment
// takes away nothing.
// ─────────────────────────────────────────────────────────────────────────────

/** Most highlighted cards on one cause page. */
export const CAUSE_FEATURED_CAP = 3;

interface Highlightable {
  id: string;
  featured?: boolean | null;
}

/**
 * Which cards keep the highlight.
 *
 * Takes the FIRST `cap` featured campaigns in the order they are rendered.
 * Order is the caller's, not re-derived here: the list arrives sorted
 * featured-first then by amount raised, so the survivors are the top-ranked
 * featured campaigns rather than an arbitrary subset. Re-sorting inside this
 * helper is how the highlight would drift away from the position.
 *
 * Returns a Set of ids rather than a filtered list because the cards that lose
 * the highlight are still RENDERED — they just render like any other card.
 */
export function cappedFeaturedIds(
  campaigns: readonly Highlightable[],
  cap: number = CAUSE_FEATURED_CAP,
): Set<string> {
  const kept = new Set<string>();
  if (cap <= 0) return kept;
  for (const c of campaigns) {
    // `=== true`, matching CampaignCard: most listings do not select the column,
    // and `undefined` means "not known", which must not consume a slot.
    if (c.featured !== true) continue;
    kept.add(c.id);
    if (kept.size >= cap) break;
  }
  return kept;
}
