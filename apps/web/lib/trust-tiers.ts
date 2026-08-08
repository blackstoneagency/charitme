// ─────────────────────────────────────────────────────────────────────────────
// Which trust tiers may be PROMOTED on a marketing surface.
//
// Why this file exists: `/success-stories` — a page headed "Featured Stories" —
// was showcasing a campaign titled "Support my medical expenses — Bitches!" as
// its second card. Measured across all 314 live campaigns it is the only one of
// its kind, and it carried exactly the signals that should have disqualified it:
// `trust_status: 'Needs More Info'`, `campaign_health_score: 0`, no backers, no
// money raised.
//
// The fix is not a profanity list. The platform already publishes a judgement
// about that campaign — it declines to vouch for it — and a page that presents
// campaigns as exemplars should honour it. This is that rule, in one place.
//
// ⚠️ THE VOCABULARY HAD ALREADY DRIFTED THREE WAYS, which is why the set below
// is written down rather than inferred:
//
//   lib/ai-platform.ts   'Verified' | 'Strong Trust' | 'Needs More Info' | 'Under Review'
//   admin allow-list     'Needs More Info' | 'Under Review' | 'Trusted' | 'Verified' | 'Flagged'
//   production data      'Verified' (88) | 'Trusted' (133) | 'Needs More Info' (93)
//
// So `'Trusted'` is the most common value in the database and is absent from the
// TypeScript union; `'Strong Trust'` is in the union and cannot be set by an
// admin; `'Flagged'` is settable and appears in neither. A filter written from
// any ONE of those three lists is wrong. `__tests__/trust-tiers.test.ts` fails if
// the admin allow-list gains a value this file does not classify.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tiers that assert positive trust, and may therefore be promoted.
 *
 * An ALLOW-list, not a deny-list, and that direction is the whole safety
 * property: a new tier added tomorrow is not promotable until someone decides it
 * is. A deny-list would promote it by default — and the tier most likely to be
 * added to a trust vocabulary is a bad one.
 */
export const PROMOTABLE_TRUST_TIERS = ['Verified', 'Trusted'] as const;

/**
 * Tiers that must never be promoted, listed explicitly so the test can prove
 * every settable value is accounted for rather than merely absent.
 *
 * `'Flagged'` is the one that matters most: nothing previously stopped a flagged
 * campaign from appearing under a "Featured Stories" heading.
 */
export const NON_PROMOTABLE_TRUST_TIERS = ['Needs More Info', 'Under Review', 'Flagged'] as const;

/**
 * May this campaign appear on a surface that presents campaigns as exemplars?
 *
 * `null`/`undefined` is NOT promotable. An unscored campaign has not earned a
 * marketing slot, and treating "no answer" as a pass is the same fail-open shape
 * this repo keeps finding in its money paths.
 */
export function isPromotableTrustTier(status: string | null | undefined): boolean {
  return (PROMOTABLE_TRUST_TIERS as readonly string[]).includes(status ?? '');
}

/**
 * Every tier the stored `campaigns.trust_status` column can actually hold.
 *
 * ⚠️ THERE ARE TWO TRUST VOCABULARIES IN THIS PRODUCT AND THEY ARE NOT THE SAME.
 *
 * | | set by | values |
 * |---|---|---|
 * | this one — STORED | an admin, on `campaigns.trust_status` | Verified, Trusted, Needs More Info, Under Review, Flagged |
 * | `TrustStatus` (lib/ai-platform.ts) — COMPUTED | `getTrustStatus(score)` | Verified, Strong Trust, Needs More Info, Under Review |
 *
 * They share three words and differ on three. `Trusted` is the most common
 * STORED value in production (130 of 308 measured) and the scorer can never
 * produce it; `Strong Trust` is the reverse — only the scorer produces it, and
 * the stored column has **zero** such rows because admin cannot set it.
 *
 * ⚠️ `PROMOTABLE_TRUST_TIERS` above listed `Strong Trust` when it was written,
 * which was this same conflation: that constant filters the STORED column on
 * /success-stories, so the value matched nothing and quietly narrowed the query
 * to two tiers while appearing to allow three. Removed — the promotable set is
 * a subset of what the column can hold, by construction.
 */
export const STORED_TRUST_TIERS = [
  ...PROMOTABLE_TRUST_TIERS,
  ...NON_PROMOTABLE_TRUST_TIERS,
] as const;
