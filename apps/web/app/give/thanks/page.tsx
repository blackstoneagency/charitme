import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '../../../components/ui';
import { formatMoneyShort, DEFAULT_CURRENCY } from '@shared/currencies';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Thank you | CharitMe',
  // Not indexable: it is a per-transaction confirmation, and a search result
  // leading here would show a stranger a "thank you for your gift" page.
  robots: { index: false, follow: false },
};

// Reads the total from the query string only to acknowledge it. The DONATION
// record comes from the Stripe webhook, never from this page — a success_url is
// just where Stripe sends the browser and can be visited by anyone who guesses
// it, so nothing here may write or be trusted as proof of payment.

export default async function GiveThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ total?: string }>;
}) {
  const { total } = await searchParams;
  const cents = Number(total);
  const showAmount = Number.isInteger(cents) && cents > 0;

  return (
    <main id="main-content" style={{ maxWidth: 640, margin: '0 auto', padding: '64px 24px' }}>
      <Card>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 10px', color: 'var(--t1)' }}>
          Thank you — your gift is on its way
        </h1>
        <p style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.6, margin: '0 0 16px' }}>
          {showAmount ? (
            <>
              Your <strong>{formatMoneyShort(cents, DEFAULT_CURRENCY)}</strong> is being split across the
              campaigns you chose.{' '}
            </>
          ) : (
            <>Your gift is being split across the campaigns you chose. </>
          )}
          Each one is credited separately, and your receipt covers the whole gift.
        </p>
        <p style={{ fontSize: 13.5, color: 'var(--t3)', lineHeight: 1.6, margin: '0 0 20px' }}>
          Donations appear on each campaign within a few moments of the payment clearing. If you do not
          see yours, it is still processing — nothing is lost.
        </p>
        <div style={{ display: 'flex', minWidth: 0, gap: 12, flexWrap: 'wrap' }}>
          <Link
            href="/donor"
            style={{ fontSize: 14, fontWeight: 700, color: 'var(--violet-ink)', textDecoration: 'none' }}
          >
            View your giving history →
          </Link>
          <Link
            href="/give"
            style={{ fontSize: 14, fontWeight: 700, color: 'var(--t3)', textDecoration: 'none' }}
          >
            Give again
          </Link>
        </div>
      </Card>
    </main>
  );
}
