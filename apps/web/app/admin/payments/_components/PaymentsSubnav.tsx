'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PAYMENTS_NAV, currentPaymentsHref } from '../../../../lib/payments-nav';

/**
 * Section navigation for the payments console — see lib/payments-nav.ts for why
 * this exists. Rendered by every page in the section, so any one of them leads
 * to all the others.
 */
export function PaymentsSubnav() {
  const pathname = usePathname() ?? '';
  const current = currentPaymentsHref(pathname);

  return (
    <nav
      aria-label="Payments console"
      style={{
        display: 'flex', minWidth: 0, gap: 8, flexWrap: 'wrap',
        marginBottom: 18, paddingBottom: 14,
        borderBottom: '1px solid var(--b1)',
      }}
    >
      {PAYMENTS_NAV.map((item) => {
        const active = item.href === current;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.blurb}
            aria-current={active ? 'page' : undefined}
            style={{
              fontSize: 13, fontWeight: 650, padding: '7px 13px',
              borderRadius: 999, textDecoration: 'none',
              border: `1px solid ${active ? 'var(--brand-text)' : 'var(--b1)'}`,
              background: active ? 'var(--s2)' : 'transparent',
              color: active ? 'var(--t1)' : 'var(--t2)',
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
