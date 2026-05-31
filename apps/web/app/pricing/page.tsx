'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase-browser';
import { PublicIcon } from '../../components/PublicIcon';

const PLANS = [
  {
    name: 'CharitMe Free',
    audience: 'Perfect for getting started',
    monthlyPrice: 0,
    features: [
      'Create 1 active campaign',
      'CharitMe AI story writer (3 uses)',
      'Accept donations (0% platform fee)',
      'CharitScore™ trust badge',
      'Donor management',
      'Email support',
    ],
    cta: 'Get Started Free',
    outline: true,
  },
  {
    name: 'CharitMe Boost',
    audience: 'For individuals starting out',
    monthlyPrice: 9,
    yearlyPrice: 9,
    features: [
      'Create up to 3 active campaigns',
      'CharitMe AI builder (unlimited)',
      'Custom campaign URL',
      'Email updates to donors',
      'Social sharing tools',
      'Basic analytics & insights',
      'Priority email support',
    ],
    cta: 'Start Boost',
    outline: false,
    plan: 'starter',
  },
  {
    name: 'CharitMe Pro',
    audience: 'For creators and growing campaigns',
    monthlyPrice: 29,
    yearlyPrice: 29,
    features: [
      'Unlimited active campaigns',
      'Full CharitMe AI suite',
      'AI donor insights & recommendations',
      'Advanced analytics & reports',
      'Automated donor email sequences',
      'Offline donations',
      'Team members (up to 5)',
      'Priority phone & email support',
    ],
    cta: 'Start Pro',
    outline: false,
    popular: true,
    plan: 'pro',
  },
  {
    name: 'CharitMe Creator',
    audience: 'For influencers and content creators',
    monthlyPrice: 49,
    yearlyPrice: 49,
    features: [
      'Everything in Pro',
      'AI social post generator',
      'AI email campaign generator',
      'Custom branding (remove CharitMe badge)',
      'Peer-to-peer fundraising tools',
      'Team members (up to 10)',
      'Dedicated success manager',
    ],
    cta: 'Start Creator',
    outline: false,
    plan: 'pro',
  },
  {
    name: 'CharitMe Community',
    audience: 'For teams and communities',
    monthlyPrice: 99,
    yearlyPrice: 99,
    features: [
      'Everything in Creator',
      'Unlimited team members',
      'Team fundraising leaderboards',
      'AI grant writer',
      'Custom donation forms (embeddable)',
      'Advanced donor CRM',
      'Dedicated account manager',
    ],
    cta: 'Start Community',
    outline: false,
    plan: 'pro',
  },
  {
    name: 'CharitMe Nonprofit Growth',
    audience: 'For small nonprofits',
    monthlyPrice: 149,
    yearlyPrice: 149,
    features: [
      'Everything in Community',
      'EIN/501(c)(3) verification badge',
      'Tax-deductible donation receipts',
      'Recurring donor management',
      'AI nonprofit assistant',
      'Nonprofit reporting dashboard',
      'Donor CRM-lite',
    ],
    cta: 'Start Nonprofit Growth',
    outline: false,
    plan: 'pro',
  },
  {
    name: 'CharitMe Nonprofit Scale',
    audience: 'For established nonprofits',
    monthlyPrice: 499,
    yearlyPrice: 499,
    features: [
      'Everything in Nonprofit Growth',
      'Branded donation forms',
      'API access',
      'Custom integrations (Salesforce, HubSpot)',
      'Advanced security & permissions',
      'SLA support',
      'Unlimited campaigns',
    ],
    cta: 'Start Nonprofit Scale',
    outline: false,
    plan: 'pro',
  },
  {
    name: 'CharitMe Enterprise Impact Cloud',
    audience: 'For large organizations',
    monthlyPrice: null,
    features: [
      'Dedicated infrastructure',
      'Custom AI model tuning',
      'White-label option',
      'Custom Stripe Connect integrations',
      'Advanced security & permissions',
      'Unlimited everything',
      'Custom reporting & dashboards',
      'SLA & premium support',
    ],
    cta: 'Contact Sales',
    outline: true,
  },
] as const;

const FAQS = [
  ['Is there a setup fee?', 'No setup fees ever. Start for free and upgrade only when you need more features.'],
  ['Can I change my plan later?', 'Yes, upgrade or downgrade at any time. Changes take effect on your next billing cycle.'],
  ['Does CharitMe charge a platform fee?', 'Never. Our platform is 100% free from mandatory platform fees — we only charge for premium plans.'],
  ['Is there a free trial for paid plans?', 'Yes! Starter and Pro both come with a 14-day free trial. No credit card required to start.'],
] as const;

function FeeCalculator() {
  const [amount, setAmount] = useState(1000);
  const cents = amount * 100;
  const stripeFixed = 30;
  const stripePct = 0.029;
  const tipPct = 0.08;

  // CharitMe with donor covering fee + 0% tip
  const kfStripe = Math.round(cents * stripePct) + stripeFixed;
  const kfNet = cents - kfStripe; // donor covers fee, 0% tip

  // CharitMe with tip (default 8%)
  const kfTip = Math.round(cents * tipPct);

  // GoFundMe: 0% platform + ~2.9%+$0.30 Stripe (same), but 5% on recurring
  const gfmStripe = kfStripe;
  const gfmNet = cents - gfmStripe;
  const gfmRecurringFee = Math.round(cents * 0.05);
  const gfmNetRecurring = cents - gfmStripe - gfmRecurringFee;

  const fmt = (n: number) => `$${n.toLocaleString('en-US')}`;
  const pct = (n: number) => `${((n / cents) * 100).toFixed(1)}%`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14, fontWeight: 700, color: '#26335c' }}>
          Donation amount:
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#64748b' }}>$</span>
            <input type="number" value={amount} onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
              min="1" style={{ width: 120, height: 42, border: '1.5px solid #e0d5ff', borderRadius: 10, padding: '0 12px', fontSize: 16, fontWeight: 700, outline: 'none' }} />
          </div>
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 22 }}>
          {[100, 500, 1000, 5000].map(v => (
            <button key={v} type="button" onClick={() => setAmount(v)}
              style={{ height: 36, padding: '0 16px', borderRadius: 8, border: `1.5px solid ${amount === v ? '#6c35ff' : '#e0d5ff'}`, background: amount === v ? '#f0eaff' : '#fff', color: amount === v ? '#551cf2' : '#64748b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              ${v.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* CharitMe */}
        <div style={{ background: '#f0fff8', border: '2px solid #19b86a', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontWeight: 900, fontSize: 16, color: '#065f46' }}>💚 CharitMe</span>
            <span style={{ background: '#19b86a', color: '#fff', fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 20 }}>BEST VALUE</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#047857', marginBottom: 4 }}>{fmt(kfNet)}</div>
          <div style={{ fontSize: 13, color: '#065f46', marginBottom: 16 }}>reaches the fundraiser ({pct(kfNet)} of {fmt(amount)})</div>
          <div style={{ fontSize: 12, color: '#047857', lineHeight: 1.8 }}>
            <div>Platform fee: <strong>$0</strong> (0%)</div>
            <div>Stripe processing: <strong>−{fmt(kfStripe)}</strong></div>
            <div>Optional donor tip: <strong>+{fmt(kfTip)}</strong> (8% default, donor chooses)</div>
            <div style={{ marginTop: 8, fontWeight: 900 }}>Monthly recurring: <strong>$0 extra fee</strong></div>
          </div>
        </div>

        {/* GoFundMe */}
        <div style={{ background: '#faf8ff', border: '1px solid #e0d5ff', borderRadius: 16, padding: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: '#334064', marginBottom: 16 }}>GoFundMe</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#4b5676', marginBottom: 4 }}>{fmt(gfmNet)}</div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>reaches the fundraiser ({pct(gfmNet)} of {fmt(amount)})</div>
          <div style={{ fontSize: 12, color: '#4b5676', lineHeight: 1.8 }}>
            <div>Platform fee: <strong>$0</strong> (0%)</div>
            <div>Stripe processing: <strong>−{fmt(gfmStripe)}</strong></div>
            <div style={{ color: '#e11d48', fontWeight: 700 }}>
              Monthly recurring: <strong>−{fmt(gfmRecurringFee)}</strong> extra (5% fee on recurring)
            </div>
            <div style={{ marginTop: 8 }}>Recurring fundraiser gets: <strong style={{ color: '#e11d48' }}>{fmt(gfmNetRecurring)}</strong></div>
          </div>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 16 }}>
        * Stripe fees (2.9% + $0.30) apply to both platforms. CharitMe charges 0% on all donations including recurring. GoFundMe charges 5% on recurring donations.
        Donors can optionally cover Stripe fees on CharitMe.
      </p>
    </div>
  );
}

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();

  const yearly = billing === 'yearly';

  const handleCTA = async (plan: typeof PLANS[number]) => {
    setError('');

    if (plan.monthlyPrice === 0) {
      router.push('/create');
      return;
    }
    if (plan.monthlyPrice === null) {
      router.push('/contact');
      return;
    }

    setLoading(plan.plan ?? null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/create`);
        return;
      }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.plan, billing }),
      });
      const payload = await res.json();

      if (!res.ok || !payload.url) {
        setError(payload.error ?? 'Stripe checkout is not configured yet. Please set your Stripe price IDs.');
        return;
      }
      window.location.assign(payload.url);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="pub-page pricing-page">
      <section className="pricing-hero">
        <div className="pub-breadcrumb">
          <Link href="/">Home</Link> <span>&gt;</span> <b>Pricing</b>
        </div>
        <h1>Simple, transparent pricing.<br /><em>More impact for your cause.</em></h1>
        <p>Choose the plan that fits your needs. Start free and upgrade anytime.</p>
        <div className="billing-toggle">
          <button className={!yearly ? 'active' : ''} onClick={() => setBilling('monthly')}>Monthly</button>
          <button className={yearly ? 'active' : ''} onClick={() => setBilling('yearly')}>Yearly (Save 20%)</button>
        </div>
        <small>Save more with yearly billing!</small>
      </section>

      {error ? (
        <div className="pricing-error-banner">
          <PublicIcon name="shield" />
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}>✕</button>
        </div>
      ) : null}

      <section className="pricing-grid">
        {PLANS.map((plan) => {
          const price = yearly && 'yearlyPrice' in plan && plan.yearlyPrice != null
            ? plan.yearlyPrice
            : plan.monthlyPrice;
          const isLoading = 'plan' in plan && loading === plan.plan;

          const isPopular = 'popular' in plan && plan.popular === true;
          return (
            <article
              className={`price-card${isPopular ? ' popular' : ''}`}
              key={plan.name}
            >
              {isPopular ? <div className="popular-ribbon">Most Popular</div> : null}
              <h2>{plan.name}</h2>
              <p>{plan.audience}</p>
              <strong>
                {price === null ? 'Custom' : price === 0 ? '$0' : `$${price}`}
                {price !== null && price > 0 ? <span>/{yearly ? 'mo' : 'month'}</span> : null}
              </strong>
              <small>
                {price === 0
                  ? 'Forever free'
                  : price === null
                  ? 'Tailored to your needs'
                  : yearly
                  ? `Billed annually at $${(price * 12).toLocaleString()}`
                  : `Billed monthly at $${price}/month`}
              </small>

              <button
                type="button"
                className={plan.outline ? 'outline' : ''}
                onClick={() => handleCTA(plan)}
                disabled={isLoading}
                style={{ height: 40, margin: '24px 0 18px', display: 'grid', placeItems: 'center', borderRadius: 6, color: plan.outline ? '#4015e8' : '#fff', background: plan.outline ? '#fff' : '#4b1af2', border: plan.outline ? '1px solid #5e38ff' : 'none', fontWeight: 950, cursor: 'pointer' }}
              >
                {isLoading ? 'Opening Stripe…' : plan.cta}
              </button>

              <hr />
              <b>{price === 0 ? 'Includes:' : 'Everything in previous plan, plus:'}</b>
              <ul>
                {(plan.features as readonly string[]).map((feature) => (
                  <li key={feature}><PublicIcon name="check" /> {feature}</li>
                ))}
              </ul>
              {price === 0 ? (
                <div className="no-card"><PublicIcon name="heart" /> No credit card required</div>
              ) : null}
            </article>
          );
        })}
      </section>

      {/* ── Fee calculator vs GoFundMe ── */}
      <section style={{ maxWidth: 760, margin: '0 auto 48px', padding: '0 24px' }}>
        <h2 style={{ textAlign: 'center', fontWeight: 900, fontSize: 26, marginBottom: 8 }}>
          Real fee comparison
        </h2>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: 28, fontSize: 15 }}>
          On a $1,000 campaign — what actually reaches the fundraiser?
        </p>
        <FeeCalculator />
      </section>

      <section className="pricing-promises">
        {[
          ['shield', 'We\'re Transparent', 'No hidden fees. We keep pricing simple and fair for every fundraiser.'],
          ['lock', 'Secure & Reliable', 'Your data and donations are always protected with bank-level security.'],
          ['refresh', 'Cancel Anytime', 'Change or cancel your plan at any time. No hassle, no penalties.'],
          ['heart', 'Our Promise', 'We\'re here to help you create more impact, together.'],
        ].map(([icon, title, body]) => (
          <article key={title}>
            <span><PublicIcon name={icon} /></span>
            <div><b>{title}</b><p>{body}</p></div>
          </article>
        ))}
      </section>

      <section className="pricing-faq">
        <h2>Frequently Asked Questions</h2>
        <div>
          {FAQS.map(([question, answer]) => (
            <details key={question} className="pricing-faq-item">
              <summary>{question}<PublicIcon name="arrow" /></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
        <Link href="/faq" className="all-faqs">View all FAQs <PublicIcon name="arrow" /></Link>
      </section>
    </div>
  );
}
