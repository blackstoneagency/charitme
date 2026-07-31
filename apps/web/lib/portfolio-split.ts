// ─────────────────────────────────────────────────────────────────────────────
// "Give once, fund many" — splitting one payment across several campaigns.
//
// GoFundMe Pro sells a "Nonprofit Giving Cart". This is deliberately not a cart:
// a donor picks ONE amount and a set of campaigns, and the money is divided.
// The interesting problems are all in the division, so it lives here, pure and
// tested, rather than inside a route where a rounding bug would be invisible.
//
// ⚠️ THE RULE THAT DRIVES EVERYTHING: the parts must sum to the whole, exactly.
//
// Splitting $10 three ways in cents gives 333.33…, and every naive approach
// loses or invents money:
//   • Math.round on each part →  334+333+333 = 1000 sometimes, 1001 others
//   • Math.floor on each part →  333+333+333 = 999, one cent silently vanishes
// A cent that disappears is a reconciliation failure; a cent that appears is
// worse, because the platform is transferring money it did not collect. So the
// split uses largest-remainder: floor everything, then hand the leftover cents
// out one at a time. It is exact by construction, not by luck.
// ─────────────────────────────────────────────────────────────────────────────

/** Stripe metadata values cap at 500 characters, and the encoded split rides there. */
export const MAX_PORTFOLIO_CAMPAIGNS = 8;
export const MIN_PORTFOLIO_SHARE_CENTS = 100;

export interface SplitPart {
  campaignId: string;
  amountCents: number;
}

/**
 * Divide `totalCents` across `campaignIds` as evenly as cents allow.
 *
 * Largest-remainder: every part gets the floor, then the remaining cents go one
 * each to the earliest campaigns. With $10 across 3 that is 334/333/333 — the
 * difference is at most one cent, and the sum is always exactly the total.
 */
export function splitEvenly(totalCents: number, campaignIds: readonly string[]): SplitPart[] {
  if (campaignIds.length === 0) return [];
  const base = Math.floor(totalCents / campaignIds.length);
  let remainder = totalCents - base * campaignIds.length;

  return campaignIds.map((campaignId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { campaignId, amountCents: base + extra };
  });
}

export type SplitError =
  | { ok: false; code: 'no_campaigns'; message: string }
  | { ok: false; code: 'too_many'; message: string }
  | { ok: false; code: 'duplicate'; message: string }
  | { ok: false; code: 'share_too_small'; message: string }
  | { ok: false; code: 'mismatch'; message: string };

export type SplitResult = { ok: true; parts: SplitPart[] } | SplitError;

/**
 * Validate a split before it becomes a charge.
 *
 * `parts` may be supplied by the caller (a donor choosing custom amounts) or
 * omitted for an even division. Either way the invariants are the same, and they
 * are checked HERE rather than trusted from the request body.
 */
export function buildSplit(
  totalCents: number,
  campaignIds: readonly string[],
  parts?: readonly SplitPart[],
): SplitResult {
  if (campaignIds.length === 0) {
    return { ok: false, code: 'no_campaigns', message: 'Choose at least one campaign.' };
  }
  if (campaignIds.length > MAX_PORTFOLIO_CAMPAIGNS) {
    return {
      ok: false,
      code: 'too_many',
      message: `You can support up to ${MAX_PORTFOLIO_CAMPAIGNS} campaigns in one gift.`,
    };
  }
  if (new Set(campaignIds).size !== campaignIds.length) {
    // Not cosmetic: a duplicate id would be transferred to twice and would break
    // the per-line idempotency key, which is (session, campaign).
    return { ok: false, code: 'duplicate', message: 'That list contains the same campaign twice.' };
  }

  const resolved = parts && parts.length > 0 ? [...parts] : splitEvenly(totalCents, campaignIds);

  if (resolved.length !== campaignIds.length) {
    return { ok: false, code: 'mismatch', message: 'Every chosen campaign needs an amount.' };
  }

  const ids = new Set(campaignIds);
  for (const p of resolved) {
    if (!ids.has(p.campaignId)) {
      return { ok: false, code: 'mismatch', message: 'An amount was given for a campaign that was not chosen.' };
    }
    if (!Number.isInteger(p.amountCents) || p.amountCents < MIN_PORTFOLIO_SHARE_CENTS) {
      return {
        ok: false,
        code: 'share_too_small',
        message: `Each campaign must receive at least $${(MIN_PORTFOLIO_SHARE_CENTS / 100).toFixed(2)}.`,
      };
    }
  }

  const sum = resolved.reduce((s, p) => s + p.amountCents, 0);
  if (sum !== totalCents) {
    // The whole point. A split that does not reconcile must never reach Stripe:
    // the platform would either transfer money it did not collect, or keep money
    // a donor intended for a campaign.
    return {
      ok: false,
      code: 'mismatch',
      message: `The amounts add up to ${sum} cents but the gift is ${totalCents} cents.`,
    };
  }

  return { ok: true, parts: resolved };
}

/**
 * Compact encoding for Stripe metadata: `id:cents,id:cents`.
 *
 * Stripe caps a metadata VALUE at 500 characters. A uuid is 36 and a cents
 * figure is up to 8, so 8 campaigns is ~360 — which is why
 * MAX_PORTFOLIO_CAMPAIGNS is 8 and not an arbitrary number. Exceeding the cap
 * would make Stripe reject the session outright, at checkout, in front of a
 * donor.
 */
export function encodeSplit(parts: readonly SplitPart[]): string {
  return parts.map((p) => `${p.campaignId}:${p.amountCents}`).join(',');
}

export function decodeSplit(encoded: string | null | undefined): SplitPart[] {
  if (!encoded) return [];
  const out: SplitPart[] = [];
  for (const chunk of encoded.split(',')) {
    const idx = chunk.lastIndexOf(':');
    if (idx <= 0) continue;
    const campaignId = chunk.slice(0, idx).trim();
    const amountCents = Number(chunk.slice(idx + 1));
    // Skip rather than throw: this runs in the Stripe webhook, where throwing
    // makes Stripe retry forever. A malformed chunk is dropped and the rest of
    // the gift is still recorded.
    if (!campaignId || !Number.isInteger(amountCents) || amountCents <= 0) continue;
    out.push({ campaignId, amountCents });
  }
  return out;
}

/**
 * The per-line idempotency key for `record_donation`.
 *
 * `record_donation` is idempotent on the checkout session id, so N campaigns
 * sharing ONE session would collapse into a single donation row — the first call
 * inserts and the rest return `already_processed`. Giving each line its own
 * composite key keeps every line independently idempotent while a Stripe retry
 * of the whole session still lands on the same keys and is refused.
 */
export function lineSessionId(sessionId: string, campaignId: string): string {
  return `${sessionId}#${campaignId}`;
}
