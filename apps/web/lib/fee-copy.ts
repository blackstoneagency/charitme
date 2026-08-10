import {
  PLATFORM_FEE_PERCENT,
  PROCESSING_FEE_PERCENT,
  PROCESSING_FEE_FIXED_CENTS,
  SUGGESTED_SUPPORT_PERCENT,
  SUPPORT_TIER_PERCENTS,
} from '@shared/fees';

/**
 * The fee figures, as prose, derived from the shared constants.
 *
 * Nine public pages spelled out "2.9% + $0.30" as a literal, and the Terms of
 * Service — a contract — stated the suggested donor support as **8%** when the
 * real default is **15%**. Nothing caught it: a wrong number in a paragraph is
 * valid TSX that renders perfectly, and the page that contradicts another page
 * looks exactly as confident as the one that is right.
 *
 * So the numbers come from `@shared/fees` and the prose is assembled here.
 * `__tests__/fee-copy.test.ts` additionally scans public page sources for a
 * fee-shaped literal that disagrees with the constants, which catches the next
 * paragraph someone writes by hand.
 */

/** e.g. "2.9%" */
export const PROCESSING_PERCENT_COPY = `${PROCESSING_FEE_PERCENT}%`;

/** e.g. "$0.30" */
export const PROCESSING_FIXED_COPY = `$${(PROCESSING_FEE_FIXED_CENTS / 100).toFixed(2)}`;

/** e.g. "2.9% + $0.30" — the phrase these pages actually use. */
export const PROCESSING_FEE_COPY = `${PROCESSING_PERCENT_COPY} + ${PROCESSING_FIXED_COPY}`;

/** e.g. "0%" — the platform fee charged to organizers. */
export const PLATFORM_FEE_COPY = `${PLATFORM_FEE_PERCENT}%`;

/** e.g. "10%" — SUGGESTED, never required, and reducible to zero. */
export const SUGGESTED_SUPPORT_COPY = `${SUGGESTED_SUPPORT_PERCENT}%`;

/**
 * The rest of the ladder as prose — e.g. "15%, 12%, 8%, 5%, 3%, 1%, or 0%".
 *
 * /fees spelled this list out by hand next to the suggested figure, so moving
 * the suggested rate left the sentence naming it twice: once as the suggestion
 * and again among the alternatives. Derived from the same array the donate card
 * renders, minus whichever rung is currently suggested.
 */
export const SUPPORT_ALTERNATIVES_COPY = (() => {
  const others = SUPPORT_TIER_PERCENTS.filter((p) => p !== SUGGESTED_SUPPORT_PERCENT);
  const head = others.slice(0, -1).map((p) => `${p}%`).join(', ');
  const tail = `${others[others.length - 1]}%`;
  return head ? `${head}, or ${tail}` : tail;
})();
