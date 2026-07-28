import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Fee Policy — 0% Platform Fee | CharitMe',
  description:
    'CharitMe charges organizers a 0% platform fee. Donor support is optional and reducible to 0%. Processing fees go to the processor, never to CharitMe.',
  alternates: { canonical: 'https://www.charitme.com/fees' },
  openGraph: {
    title: 'Fee Policy — 0% Platform Fee | CharitMe',
    description: '0% platform fee for organizers. Optional donor support. Transparent processing fees.',
    url: 'https://www.charitme.com/fees',
    type: 'website',
  },
};

const LAST_UPDATED = 'July 2026';

export default function FeePolicyPage() {
  return (
    <div className="pub-page simple-public legal-page">
      <section>
        <div className="pub-breadcrumb">
          Home <span>&gt;</span> <b>Fee Policy</b>
        </div>
        <h1>Fee Policy</h1>
        <p style={{ color: 'var(--t3)', fontSize: 14 }}>Last updated: {LAST_UPDATED}</p>
        <p>
          This page explains every fee on CharitMe in plain language. For an interactive breakdown of any
          donation, see the <Link href="/transparency">Transparency Center</Link>.
        </p>
      </section>

      <article className="legal-body">
        <h2>1. Platform fee: 0%</h2>
        <p>
          CharitMe charges organizers a <strong>0% platform fee</strong>. We never charge you to create a
          campaign, post updates, add photos or videos, receive donations, or withdraw funds. There is no
          required subscription to raise money on CharitMe.
        </p>

        <h2>2. Donor support (optional)</h2>
        <p>
          CharitMe is funded primarily by <strong>optional donor support</strong> — a contribution a donor may
          choose to add on top of their gift to keep the platform running. Support is:
        </p>
        <ul>
          <li><strong>Optional.</strong> Suggested at 15%, but a donor may set it to 12%, 10%, 8%, 5%, 3%, 1%, or 0%.</li>
          <li><strong>Always reducible to 0%</strong>, in one tap, with no dark patterns and nothing hidden.</li>
          <li><strong>Separate from the gift.</strong> Support never reduces what the recipient receives.</li>
        </ul>

        <h2>3. Payment processing fees</h2>
        <p>
          Payment processors (such as Stripe) charge a fee to move money securely. This fee goes to the
          <strong> processor, not to CharitMe</strong>. Typical rates:
        </p>
        <ul>
          <li><strong>Card / Google Pay / Apple Pay:</strong> 2.9% + $0.30</li>
          <li><strong>Bank transfer (ACH):</strong> 0.8% (capped at $5.00)</li>
          <li><strong>Cash App, Link, Amazon Pay, Klarna, Afterpay:</strong> vary by provider</li>
        </ul>
        <p style={{ fontSize: 13, color: 'var(--t3)' }}>
          PayPal and Venmo are not currently accepted at checkout.
        </p>
        <p>
          If a donor chooses to cover the processing fee, <strong>100% of their donation reaches the
          recipient</strong>. If they don&apos;t, only the processor&apos;s fee is deducted from the gift — CharitMe
          still takes nothing.
        </p>

        <h2>4. Where the money goes</h2>
        <p>
          Donations are made as Stripe Connect destination charges and settle directly to the verified
          recipient&apos;s connected account. <strong>CharitMe never holds recipient funds.</strong> The only money
          CharitMe receives is optional donor support and (where applicable) optional subscription revenue.
        </p>
        <p className="mono" style={{ fontWeight: 700 }}>
          Donor → Stripe → Verified recipient → Their bank account
        </p>

        <h2>5. Optional subscriptions</h2>
        <p>
          CharitMe offers optional paid plans (for example, advanced AI fundraising tools for organizers and
          software for nonprofits). These are <strong>additive products</strong> — they are never required to
          give or to raise money for free, and they never change the 0% platform fee. See{' '}
          <Link href="/pricing">Pricing</Link>.
        </p>

        <h2>6. Currency &amp; international giving</h2>
        <p>
          Processing fees and currency-conversion charges may vary by country and payment method. The exact
          amounts are always shown before a donor confirms a donation.
        </p>

        <h2>7. Refunds</h2>
        <p>
          For how refunds and chargebacks are handled, see our <Link href="/refunds">Refund Policy</Link>.
        </p>

        <p style={{ marginTop: 24, fontSize: 13, color: 'var(--t3)' }}>
          This Fee Policy is informational and forms part of, and is governed by, our{' '}
          <Link href="/terms">Terms of Service</Link>.
        </p>
      </article>
    </div>
  );
}
