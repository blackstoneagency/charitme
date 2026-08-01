/**
 * The six views of the payments console.
 *
 * Five of them — disputes, owner payouts, processors, reconciliation and
 * refunds — shipped fully wired to `lib/payment-admin-data.ts` and were linked
 * from NOTHING. `adminNav` carries one entry, "Payment Flows", pointing at
 * `campaign-flows`; grepping the whole tree for hrefs into this section, from
 * outside this section, returned exactly two — campaign-flows and an export
 * endpoint. An admin could reach one table and had no way to discover the other
 * five views of the same records.
 *
 * This list is the single source for the section sub-nav, and
 * `__tests__/payments-nav.test.ts` asserts it against the pages actually on
 * disk — so the next view added here cannot be born unreachable.
 */
export type PaymentsNavItem = Readonly<{ href: string; label: string; blurb: string }>;

export const PAYMENTS_NAV: readonly PaymentsNavItem[] = [
  {
    href: '/admin/payments/campaign-flows',
    label: 'Payment Flows',
    blurb: 'Every campaign payment end to end, with filters.',
  },
  {
    href: '/admin/payments/payouts',
    label: 'Owner Payouts',
    blurb: 'What has reached the fundraiser, and what has not.',
  },
  {
    href: '/admin/payments/refunds',
    label: 'Refunds',
    blurb: 'Refunded payments and their current state.',
  },
  {
    href: '/admin/payments/disputes',
    label: 'Disputes',
    blurb: 'Chargebacks: open, won and lost.',
  },
  {
    href: '/admin/payments/reconciliation',
    label: 'Reconciliation',
    blurb: 'Where our records and the processor disagree.',
  },
  {
    href: '/admin/payments/processors',
    label: 'Processors',
    blurb: 'Which processors are enabled, and which are half-configured.',
  },
] as const;

/**
 * Longest-prefix match, so a detail route under a section still marks its
 * section current. Exact-match alone would leave
 * `/admin/payments/campaign-flows/<id>/transactions` with nothing highlighted,
 * which reads as "you have left the console".
 */
export function currentPaymentsHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of PAYMENTS_NAV) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (best === null || item.href.length > best.length) best = item.href;
    }
  }
  return best;
}
