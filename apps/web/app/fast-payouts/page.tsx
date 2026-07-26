import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fast Payouts — Stripe Verified Payouts',
  description: 'CharitMe delivers donations via Stripe Connect Express. Standard payouts are free; same-day and instant payouts are available to eligible verified users.',
  alternates: { canonical: 'https://www.charitme.com/fast-payouts' },
};

const STATS = [
  { value: 'Free', label: 'Standard payout' },
  { value: '2 days', label: 'Standard speed' },
  { value: '1%', label: 'Same-day fee' },
  { value: '40+', label: 'Countries' },
];

const VERIFICATION_STEPS = [
  { step: '01', icon: '🔗', title: 'Connect a Stripe account', body: 'Click "Connect payouts" from your dashboard. CharitMe opens the Stripe Express onboarding flow — takes 2–3 minutes for most users.' },
  { step: '02', icon: '🪪', title: 'Complete identity verification', body: 'Stripe verifies your name, address, and government ID. This is required by banking and anti-money-laundering regulations. Most verifications complete in under 5 minutes.' },
  { step: '03', icon: '🏦', title: 'Link your bank account', body: 'Add your bank account or debit card through Stripe. Stripe verifies the account instantly via micro-deposit or instant bank verification.' },
  { step: '04', icon: '💸', title: 'Receive payouts automatically', body: 'After your account is verified, donations transfer to your Stripe balance on the standard 2-business-day schedule. No manual withdrawal required.' },
];

const PAYOUT_OPTIONS = [
  { name: 'Standard payout', speed: '2 business days', fee: 'Free', eligibility: 'All verified campaigns', recommended: true },
  { name: 'Same-day payout', speed: 'Same business day', fee: '1%', eligibility: 'Eligible verified users', recommended: false },
  { name: 'Instant payout', speed: 'Under 30 minutes', fee: '1.5%', eligibility: 'Low-risk verified accounts only', recommended: false },
];

const TRUST_POINTS = [
  'PCI DSS Level 1 certified payment processing',
  'Bank-level encryption for all financial data',
  'Automated fraud detection and risk scoring',
  'Secure identity verification and KYC compliance',
  'Support for 40+ countries and all major currencies',
];

const HOLDS = [
  { tone: 'amber', title: 'New account hold (7 days)', desc: 'First-campaign accounts have a 7-day payout hold to allow for fraud review and any donor disputes.' },
  { tone: 'red', title: 'Under review hold', desc: 'Campaigns flagged for trust review have payouts frozen until the review is complete. You are notified and have 48 hours to respond.' },
  { tone: 'green', title: 'No hold (verified accounts)', desc: 'Established accounts with clean history receive payouts on the standard schedule with no hold period.' },
];

const PAYOUT_FAQS = [
  { q: 'Why is there a 7-day hold for new accounts?', a: 'New fundraiser accounts have a 7-day payout hold on their first campaign to allow for fraud review and donor dispute resolution. This is standard practice across all major crowdfunding platforms. Established accounts with prior verified campaigns are not subject to this hold.' },
  { q: 'What countries support payouts?', a: 'CharitMe supports payouts in all countries where Stripe Connect Express is available — 40+ countries. Payout timing, currency, and method depend on your country and Stripe Connect rules.' },
  { q: 'Why would my payout be frozen?', a: 'Payouts are frozen if your campaign is under trust review, if Stripe flags unusual activity on your connected account, or if a donor dispute is filed. You will be notified and can respond within 48 hours.' },
  { q: 'What is the difference between same-day and instant payouts?', a: 'Standard payouts process in 2 business days. Same-day payouts (1% fee) process on the same business day. Instant payouts (1.5% fee) transfer to an eligible debit card or bank account in minutes. Instant payouts require low-risk verified accounts only.' },
  { q: 'Does CharitMe ever hold my money?', a: 'CharitMe is not a money transmitter and does not hold campaign funds. Donations are processed by Stripe and held in your Stripe Connect balance until payout. CharitMe instructs Stripe to transfer funds on the schedule you choose.' },
];

export default function FastPayoutsPage() {
  return (
    <div className="fp">
      {/* Hero */}
      <section className="fp-hero">
        <div className="container">
          <div className="fp-hero-inner">
            <span className="fp-badge"><i />Fast verified payouts</span>
            <h1 className="fp-h1">Get donations to your bank the moment you need them.</h1>
            <p className="fp-lead">
              CharitMe uses Stripe Connect Express to deliver funds directly to your bank.
              Standard payouts are always free — same-day and instant options are available for eligible verified users.
            </p>
            <div className="fp-ctas">
              <Link href="/create/choose-path" className="fp-btn fp-btn-primary">Start a campaign</Link>
              <Link href="/dashboard" className="fp-btn fp-btn-ghost">Connect payouts</Link>
            </div>
            <p className="fp-hero-note">🔒 CharitMe never sees or stores your bank details — everything runs through Stripe.</p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="fp-stats">
        <div className="container">
          <div className="fp-stat-grid">
            {STATS.map((s) => (
              <div key={s.label} className="fp-stat">
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="fp-section">
        <div className="container">
          <div className="fp-head">
            <div className="fp-eyebrow">Setup</div>
            <h2 className="fp-h2">How to set up payouts</h2>
            <p className="fp-sub">Connect your Stripe account once — all future campaigns pay out automatically.</p>
          </div>
          <div className="fp-steps">
            {VERIFICATION_STEPS.map((step) => (
              <div key={step.step} className="fp-step">
                <div className="fp-step-ic" aria-hidden="true">{step.icon}</div>
                <div>
                  <div className="fp-step-n">Step {step.step}</div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Options */}
      <section className="fp-section alt">
        <div className="container">
          <div className="fp-head">
            <div className="fp-eyebrow">Speed &amp; fees</div>
            <h2 className="fp-h2">Payout speed options</h2>
            <p className="fp-sub">Standard payouts are free for everyone. Faster options are available for eligible verified accounts through Stripe Connect.</p>
          </div>
          {/* The wrapper scrolls horizontally on narrow screens, so it must be
              reachable by keyboard — without tabIndex a keyboard-only user cannot
              scroll it and the right-hand columns are unreachable. A named region
              also tells a screen-reader user what they landed in. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex --
              deliberate, and the two rules genuinely conflict here: jsx-a11y sees a
              non-interactive element, while axe's scrollable-region-focusable (WCAG
              2.1.1) requires a scrollable container to be focusable or its overflowed
              content is unreachable by keyboard. axe is right about this element
              because it actually scrolls; the lint rule cannot see that. */}
          <div className="fp-table-wrap" tabIndex={0} role="region" aria-label="Payout speed options">
            <table className="fp-table">
              <thead>
                <tr>
                  <th scope="col">Payout type</th>
                  <th scope="col">Speed</th>
                  <th scope="col">Fee</th>
                  <th scope="col">Eligibility</th>
                </tr>
              </thead>
              <tbody>
                {PAYOUT_OPTIONS.map((opt) => (
                  <tr key={opt.name} className={opt.recommended ? 'hl' : ''}>
                    <td>
                      <span className="fp-opt-name">
                        {opt.name}
                        {opt.recommended && <span className="fp-pill">Most popular</span>}
                      </span>
                    </td>
                    <td>{opt.speed}</td>
                    <td className="fp-fee">{opt.fee}</td>
                    <td>{opt.eligibility}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fp-note">
            Payout eligibility is determined by Stripe verification status, account age, and risk score.
            Instant payouts require a low-risk verified account and an eligible bank or debit card.
          </p>
        </div>
      </section>

      {/* Trust + holds */}
      <section className="fp-section">
        <div className="container">
          <div className="fp-trust-grid">
            <div>
              <div className="fp-eyebrow">Security</div>
              <h2 className="fp-h2">Powered by Stripe — trusted by millions</h2>
              <p className="fp-sub">
                CharitMe uses Stripe Connect Express to process and deliver every donation.
                Stripe is a PCI DSS Level 1 certified processor used by Amazon, Google, and Shopify.
                CharitMe never sees, stores, or handles your bank account or card details.
              </p>
              <div className="fp-checks">
                {TRUST_POINTS.map((item) => (
                  <div key={item} className="fp-check"><span>✓</span><span>{item}</span></div>
                ))}
              </div>
            </div>
            <div className="fp-hold-card">
              <h3>Payout holds — explained</h3>
              {HOLDS.map((h) => (
                <div key={h.title} className={`fp-hold ${h.tone}`}>
                  <b>{h.title}</b>
                  <p>{h.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="fp-section alt">
        <div className="container">
          <div className="fp-head">
            <div className="fp-eyebrow">Questions</div>
            <h2 className="fp-h2">Payout FAQ</h2>
          </div>
          <div className="fp-faqs">
            {PAYOUT_FAQS.map((item) => (
              <div key={item.q} className="fp-faq">
                <h3><span>Q</span>{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="fp-cta">
        <div className="container">
          <div className="fp-cta-box">
            <h2>Ready to get paid?</h2>
            <p>Connect your Stripe account from your dashboard in under 5 minutes. Donations start transferring automatically once your campaign goes live.</p>
            <div className="fp-cta-btns">
              <Link href="/create/choose-path" className="fp-btn fp-btn-primary">Start a campaign →</Link>
              <Link href="/faq#payouts" className="fp-btn fp-btn-ghost">Payout FAQ</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
