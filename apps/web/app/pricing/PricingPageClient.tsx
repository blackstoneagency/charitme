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
] as const;

const FAQS = [
  ['Is there a setup fee?', 'No setup fees ever. Start for free and upgrade only when you need more features.'],
  ['Can I change my plan later?', 'Yes, upgrade or downgrade at any time. Changes take effect on your next billing cycle.'],
  ['Does CharitMe charge a platform fee?', 'Never. Our platform is 100% free from mandatory platform fees — we only charge for premium plans.'],
  ['Is there a free trial for paid plans?', 'Yes! Starter and Pro both come with a 14-day free trial. No credit card required to start.'],
] as const;

export default function PricingPage() {
  // Yearly is the default: it is the better-value plan (20% off) and the one we
  // want to lead with, so the page opens on it rather than making the visitor
  // find the saving themselves.
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
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
                {price === 0 ? '$0' : `$${price}`}
                {price > 0 ? <span>/{yearly ? 'mo' : 'month'}</span> : null}
              </strong>
              <small>
                {price === 0
                  ? 'Forever free'
                  : yearly
                  ? `Billed annually at $${(price * 12).toLocaleString()}`
                  : `Billed monthly at $${price}/month`}
              </small>

              <button
                type="button"
                className={`price-cta-btn${plan.outline ? ' price-cta-outline' : ' price-cta-solid'}`}
                onClick={() => handleCTA(plan)}
                disabled={isLoading}
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
