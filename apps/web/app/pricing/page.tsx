'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase-browser';
import { PublicIcon } from '../../components/PublicIcon';

const PLANS = [
  {
    name: 'Free',
    audience: 'Perfect for getting started',
    monthlyPrice: 0,
    features: [
      'Create 1 active campaign',
      'Basic campaign templates',
      'Accept donations (KindFund branding)',
      'Donor management',
      'Email support',
    ],
    cta: 'Get Started Free',
    outline: true,
  },
  {
    name: 'Starter',
    audience: 'For individuals and small campaigns',
    monthlyPrice: 19,
    yearlyPrice: 19,
    features: [
      'Create up to 5 active campaigns',
      'Custom campaign URL',
      'Email updates to donors',
      'Social sharing tools',
      'Basic analytics & insights',
      'Priority email support',
    ],
    cta: 'Start Starter',
    outline: false,
    plan: 'starter',
  },
  {
    name: 'Pro',
    audience: 'For growing organizations',
    monthlyPrice: 59,
    yearlyPrice: 59,
    features: [
      'Unlimited active campaigns',
      'Advanced analytics & reports',
      'Custom branding (remove KindFund badge)',
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
    name: 'Enterprise',
    audience: 'For large organizations & nonprofits',
    monthlyPrice: null,
    features: [
      'Dedicated account manager',
      'Custom Stripe Connect integrations',
      'Advanced security & permissions',
      'Unlimited team members',
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
  ['Does KindFund charge a platform fee?', 'Never. Our platform is 100% free from mandatory platform fees — we only charge for premium plans.'],
  ['Is there a free trial for paid plans?', 'Yes! Starter and Pro both come with a 14-day free trial. No credit card required to start.'],
] as const;

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();

  const yearly = billing === 'yearly';

  const handleCTA = async (plan: typeof PLANS[number]) => {
    setError('');

    if (plan.name === 'Free') {
      router.push('/login?mode=signup');
      return;
    }
    if (plan.name === 'Enterprise') {
      router.push('/contact');
      return;
    }

    setLoading(plan.plan ?? null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?next=/pricing&mode=signup`);
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
          const annualSavings = 'yearlyPrice' in plan && plan.yearlyPrice != null && yearly
            ? ((plan.monthlyPrice - plan.yearlyPrice) * 12)
            : 0;
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
                {plan.name === 'Starter' && yearly
                  ? 'Billed annually at $228'
                  : plan.name === 'Starter' && !yearly
                  ? 'Billed monthly at $19/month'
                  : plan.name === 'Pro' && yearly
                  ? 'Billed annually at $708'
                  : plan.name === 'Pro' && !yearly
                  ? 'Billed monthly at $59/month'
                  : plan.name === 'Free'
                  ? 'Forever free'
                  : 'Tailored to your needs'}
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
              <b>{plan.name === 'Free' ? 'Includes:' : plan.name === 'Starter' ? 'Everything in Free, plus:' : plan.name === 'Pro' ? 'Everything in Starter, plus:' : 'Everything in Pro, plus:'}</b>
              <ul>
                {(plan.features as readonly string[]).map((feature) => (
                  <li key={feature}><PublicIcon name="check" /> {feature}</li>
                ))}
              </ul>
              {plan.name === 'Free' ? (
                <div className="no-card"><PublicIcon name="heart" /> No credit card required</div>
              ) : null}
            </article>
          );
        })}
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
