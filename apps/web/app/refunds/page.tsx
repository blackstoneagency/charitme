import type { Metadata } from 'next';
import { DEFAULT_OG_IMAGE } from '../../lib/public-routes';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Refund Policy | CharitMe',
  description:
    'How refunds, chargebacks, and recurring-donation cancellations work on CharitMe, and how they are reflected in our auditable ledger.',
  alternates: { canonical: 'https://www.charitme.com/refunds' },
  openGraph: {
    images: [{ url: DEFAULT_OG_IMAGE }],
    title: 'Refund Policy | CharitMe',
    description: 'How refunds, chargebacks, and recurring cancellations work on CharitMe.',
    url: 'https://www.charitme.com/refunds',
    type: 'website',
  },
};

const LAST_UPDATED = 'July 2026';

export default function RefundPolicyPage() {
  return (
    <div className="pub-page simple-public legal-page">
      <section>
        <div className="pub-breadcrumb">
          Home <span>&gt;</span> <b>Refund Policy</b>
        </div>
        <h1>Refund Policy</h1>
        <p style={{ color: 'var(--t3)', fontSize: 14 }}>Last updated: {LAST_UPDATED}</p>
        <p>
          Donations are gifts, but we know circumstances change. This page explains how refunds and disputes
          work and how they are recorded.
        </p>
      </section>

      <article className="legal-body">
        <h2>1. Requesting a refund</h2>
        <p>
          If you believe a donation was made in error, was unauthorized, or a campaign misrepresented itself,
          contact us via <Link href="/contact">Contact</Link> (or the receipt email) with the donation details.
          Refund requests are reviewed on a case-by-case basis in line with our{' '}
          <Link href="/trust-safety">Trust &amp; Safety</Link> standards.
        </p>

        <h2>2. How refunds are processed</h2>
        <ul>
          <li>
            <strong>Full refunds</strong> return the entire donation to the original payment method. The
            transaction is reversed in CharitMe&apos;s immutable ledger so the recipient&apos;s balance is corrected.
          </li>
          <li>
            <strong>Partial refunds</strong> return part of a donation; the remainder stays with the campaign.
          </li>
          <li>
            <strong>Processing fees.</strong> Payment-processor fees are charged by the processor at the time of
            payment. Depending on the processor and timing, some fees may not be returned on a refund.
          </li>
        </ul>

        <h2>3. Timing</h2>
        <p>
          Once approved, refunds are issued through the payment processor and typically appear on the
          donor&apos;s statement within <strong>5–10 business days</strong>, depending on their bank or card
          issuer.
        </p>

        <h2>4. Chargebacks &amp; disputes</h2>
        <p>
          A donor may also dispute a charge with their bank (a chargeback). When a dispute is lost, the funds
          are returned to the donor and the transaction is reversed in our ledger into a separate disputes
          account, keeping our books balanced and auditable. Fraudulent chargebacks may affect a
          recipient&apos;s standing on the platform.
        </p>

        <h2>5. Recurring donations</h2>
        <p>
          Recurring (monthly) donations can be <strong>canceled at any time</strong> from your account; a
          cancellation stops future charges. Already-processed monthly donations follow the same refund rules
          above.
        </p>

        <h2>6. Recipient payouts</h2>
        <p>
          Recipients are only ever paid on verified, settled donations. Because funds settle directly to the
          recipient via Stripe (CharitMe never holds them), a refund after payout may be recovered from the
          recipient&apos;s connected account in accordance with Stripe&apos;s terms.
        </p>

        <p style={{ marginTop: 24, fontSize: 13, color: 'var(--t3)' }}>
          This Refund Policy is informational and forms part of, and is governed by, our{' '}
          <Link href="/terms">Terms of Service</Link>. See also the{' '}
          <Link href="/fees">Fee Policy</Link> and <Link href="/transparency">Transparency Center</Link>.
        </p>
      </article>
    </div>
  );
}
