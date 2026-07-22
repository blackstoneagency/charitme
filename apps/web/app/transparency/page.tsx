import type { Metadata } from 'next';
import Link from 'next/link';
import { safeJsonLd } from '../../lib/json-ld';
import { seoMetadata } from '../../lib/seo';
import MoneyCalculator from './MoneyCalculator';

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('/transparency', {
  title: 'Transparency Center — Where Your Money Goes | CharitMe',
  description:
    'See exactly where every dollar goes. CharitMe charges organizers a 0% platform fee, donor support is always optional, and funds flow directly to verified recipients via Stripe — never held by CharitMe.',
  alternates: { canonical: 'https://www.charitme.com/transparency' },
  openGraph: {
    title: 'Transparency Center — Where Your Money Goes | CharitMe',
    description:
      '0% platform fee. Optional donor support. Funds flow directly to verified recipients via Stripe. See the full breakdown.',
    url: 'https://www.charitme.com/transparency',
    type: 'website',
  },
  });
}

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Does CharitMe take a cut of my donation?',
    a: 'No. CharitMe charges organizers a 0% platform fee. We are funded primarily by optional donor support, which you can set to any amount — including 0% — at checkout.',
  },
  {
    q: 'What is the processing fee?',
    a: 'Payment processors (Stripe and others) charge a fee to move money securely — for cards it is 2.9% + $0.30. This goes to the processor, not to CharitMe. If you choose to cover it, 100% of your donation reaches the recipient.',
  },
  {
    q: 'Does CharitMe ever hold my donation?',
    a: 'No. Donations are made as Stripe Connect destination charges and settle directly to the verified recipient’s connected account. CharitMe never takes custody of recipient funds; we only ever receive optional support and subscription revenue.',
  },
  {
    q: 'How do I know the recipient is real?',
    a: 'Recipients complete Stripe identity verification (KYC) before a campaign can accept donations. Donations are blocked until the recipient’s payout account is verified and payout-ready.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Refunds are supported. When a refund or chargeback occurs, the transaction is reversed in our immutable double-entry ledger and reconciled daily, so the books always reflect reality.',
  },
];

export default function TransparencyPage() {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="pub-page simple-public legal-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqLd) }} />

      <section>
        <div className="pub-breadcrumb">
          Home <span>&gt;</span> <b>Transparency Center</b>
        </div>
        <h1>Where your money goes</h1>
        <p>
          The most transparent fundraising platform in the world. <strong>0% platform fee</strong> for
          organizers, optional donor support you fully control, and funds that flow{' '}
          <strong>directly to verified recipients</strong> — never held by CharitMe.
        </p>
      </section>

      <section style={{ margin: '28px 0' }}>
        <MoneyCalculator />
      </section>

      <article className="legal-body">
        <h2>How payments work</h2>
        <ol>
          <li>
            <strong>You give.</strong> Your card (or bank/PayPal/Venmo) is charged the amount you see —
            your donation, any optional support, and processing if you choose to cover it.
          </li>
          <li>
            <strong>Stripe processes it.</strong> Payments run through Stripe, a PCI DSS Level 1 processor.
            CharitMe never sees or stores your card details.
          </li>
          <li>
            <strong>The recipient is paid directly.</strong> Using Stripe Connect destination charges, the
            donation settles straight to the verified recipient’s connected account and out to their bank.
          </li>
        </ol>

        <h2>Where the fees go</h2>
        <ul>
          <li>
            <strong>CharitMe platform fee: 0%.</strong> Always. We never charge organizers a required fee to
            create campaigns or receive donations.
          </li>
          <li>
            <strong>Donor support: optional.</strong> Suggested at 15%, but reducible to 0% in one tap with
            no dark patterns. This is what keeps CharitMe running.
          </li>
          <li>
            <strong>Processing fee: goes to the processor.</strong> Stripe’s fee (e.g. 2.9% + $0.30 for
            cards) is not CharitMe revenue. Cover it and 100% of your donation reaches the recipient.
          </li>
        </ul>

        <h2>CharitMe never holds your donation</h2>
        <p>
          This is the core of our model. Recipient funds are never routed into a CharitMe balance and never
          held in escrow. Donations settle directly to the verified recipient via Stripe. CharitMe only ever
          receives optional donor support and subscription revenue — never the donation itself.
        </p>
        <p className="mono" style={{ fontWeight: 700 }}>
          Donor → Stripe → Verified recipient → Their bank account
        </p>

        <h2>Verification, security &amp; compliance</h2>
        <ul>
          <li>
            <strong>KYC / identity verification.</strong> Recipients verify their identity with Stripe before
            a campaign can accept donations. Unverified accounts cannot receive funds.
          </li>
          <li>
            <strong>PCI DSS Level 1.</strong> All card data is handled by Stripe — the highest payment
            security certification. See our <Link href="/security">Security</Link> page.
          </li>
          <li>
            <strong>AML monitoring.</strong> Stripe screens transactions for fraud and money-laundering risk;
            CharitMe adds its own trust &amp; safety review. See <Link href="/trust-safety">Trust &amp; Safety</Link>.
          </li>
          <li>
            <strong>Auditable ledger.</strong> Every donation, refund, and dispute is recorded in an immutable
            double-entry ledger and reconciled against Stripe daily.
          </li>
        </ul>

        <h2>Refunds &amp; chargebacks</h2>
        <p>
          Refunds are supported and are reversed cleanly in the ledger. A full refund returns the entire gift;
          a lost dispute (chargeback) is reversed into a separate disputes account so the books always balance.
          Recipients are only paid on verified, settled donations.
        </p>

        <h2>Frequently asked questions</h2>
        {FAQ.map((f) => (
          <div key={f.q} style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 6 }}>{f.q}</h3>
            <p style={{ marginTop: 0 }}>{f.a}</p>
          </div>
        ))}

        <p style={{ marginTop: 28 }}>
          Ready to start? <Link href="/create">Create a campaign</Link> for free, or read{' '}
          <Link href="/how-it-works">how it works</Link> and our <Link href="/pricing">pricing</Link>.
        </p>
      </article>
    </div>
  );
}
