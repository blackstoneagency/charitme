import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fast Payouts — Stripe Verified Payouts',
  description: 'CharitMe uses Stripe Connect Express to deliver donations to fundraisers. Standard payouts are free. Same-day and instant payouts are available for eligible verified users.',
  alternates: { canonical: 'https://www.charitme.com/fast-payouts' },
};

const VERIFICATION_STEPS = [
  {
    step: '01',
    icon: '🔗',
    title: 'Connect a Stripe account',
    body: 'Click "Connect payouts" from your dashboard. CharitMe opens the Stripe Express onboarding flow — takes 2–3 minutes for most users.',
  },
  {
    step: '02',
    icon: '🪪',
    title: 'Complete identity verification',
    body: 'Stripe verifies your name, address, and government ID. This is required by banking and anti-money-laundering regulations. Most verifications complete in under 5 minutes.',
  },
  {
    step: '03',
    icon: '🏦',
    title: 'Link your bank account',
    body: 'Add your bank account or debit card through Stripe. Stripe verifies the account instantly via micro-deposit or instant bank verification.',
  },
  {
    step: '04',
    icon: '💸',
    title: 'Receive payouts automatically',
    body: 'After your account is verified, donations transfer to your Stripe balance on the standard 2-business-day schedule. No manual withdrawal required.',
  },
];

const PAYOUT_FAQS = [
  {
    q: 'Why is there a 7-day hold for new accounts?',
    a: 'New fundraiser accounts have a 7-day payout hold on their first campaign to allow for fraud review and donor dispute resolution. This is standard practice across all major crowdfunding platforms. Established accounts with prior verified campaigns are not subject to this hold.',
  },
  {
    q: 'What countries support payouts?',
    a: 'CharitMe supports payouts in all countries where Stripe Connect Express is available — 40+ countries. Payout timing, currency, and method depend on your country and Stripe Connect rules.',
  },
  {
    q: 'Why would my payout be frozen?',
    a: 'Payouts are frozen if your campaign is under trust review, if Stripe flags unusual activity on your connected account, or if a donor dispute is filed. You will be notified and can respond within 48 hours.',
  },
  {
    q: 'What is the difference between same-day and instant payouts?',
    a: 'Standard payouts process in 2 business days. Same-day payouts (1% fee) process on the same business day. Instant payouts (1.5% fee) transfer to an eligible debit card or bank account in minutes. Instant payouts require low-risk verified accounts only.',
  },
  {
    q: 'Does CharitMe ever hold my money?',
    a: 'CharitMe is not a money transmitter and does not hold campaign funds. Donations are processed by Stripe and held in your Stripe Connect balance until payout. CharitMe instructs Stripe to transfer funds on the schedule you choose.',
  },
];

export default function FastPayoutsPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="hero-mesh border-b border-slate-200 py-16 sm:py-24">
        <div className="container">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-black text-emerald-700">
              Fast verified payouts
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
              Get donations to your<br className="hidden sm:block" /> bank when you need them.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              CharitMe uses Stripe Connect Express to deliver funds directly to your bank.
              Standard payouts are always free. Same-day and instant options are available for eligible verified users.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create" className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-soft">
                Start a campaign
              </Link>
              <Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900">
                Connect payouts
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-slate-100 py-10">
        <div className="container">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: 'Free', label: 'Standard payout' },
              { value: '2 days', label: 'Standard payout speed' },
              { value: '1%', label: 'Same-day payout fee' },
              { value: '40+', label: 'Countries supported' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <div className="text-3xl font-black text-emerald-700">{s.value}</div>
                <div className="mt-1 text-sm font-bold text-slate-600">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How payouts work */}
      <section className="py-16">
        <div className="container">
          <div className="mb-12">
            <h2 className="text-3xl font-black text-slate-950">How to set up payouts</h2>
            <p className="mt-3 text-slate-600">Connect your Stripe account once — all future campaigns pay out automatically.</p>
          </div>
          <div className="space-y-5">
            {VERIFICATION_STEPS.map((step) => (
              <div key={step.step} className="flex gap-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
                  {step.icon}
                </div>
                <div>
                  <div className="mb-1 text-xs font-black uppercase tracking-widest text-emerald-700">Step {step.step}</div>
                  <h3 className="text-lg font-black text-slate-950">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Payout options */}
      <section className="bg-slate-50 py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">Payout speed options</h2>
            <p className="mt-3 text-slate-600">Standard payouts are free for everyone. Faster options are available for eligible verified accounts through Stripe Connect.</p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="px-6 py-4 text-left font-black text-slate-700">Payout type</th>
                  <th className="px-6 py-4 text-left font-black text-slate-700">Speed</th>
                  <th className="px-6 py-4 text-left font-black text-slate-700">Fee</th>
                  <th className="px-6 py-4 text-left font-black text-slate-700">Eligibility</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    name: 'Standard payout',
                    speed: '2 business days',
                    fee: 'Free',
                    eligibility: 'All verified campaigns',
                    highlight: false,
                  },
                  {
                    name: 'Same-day payout',
                    speed: 'Same business day',
                    fee: '1%',
                    eligibility: 'Eligible verified users',
                    highlight: false,
                  },
                  {
                    name: 'Instant payout',
                    speed: '< 30 minutes',
                    fee: '1.5%',
                    eligibility: 'Low-risk verified accounts only',
                    highlight: false,
                  },
                ].map((opt, i) => (
                  <tr key={opt.name} className={i < 2 ? 'border-b border-slate-100' : ''}>
                    <td className="px-6 py-4 font-black text-slate-950">{opt.name}</td>
                    <td className="px-6 py-4 text-slate-600">{opt.speed}</td>
                    <td className="px-6 py-4 font-black text-emerald-700">{opt.fee}</td>
                    <td className="px-6 py-4 text-slate-600">{opt.eligibility}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Payout eligibility is determined by Stripe verification status, account age, and risk score.
            Instant payouts require a low-risk verified account and eligible bank or debit card.
          </p>
        </div>
      </section>

      {/* Stripe Trust section */}
      <section className="py-16">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-black text-slate-950">Powered by Stripe — trusted by millions</h2>
              <p className="mt-4 leading-7 text-slate-600">
                CharitMe uses Stripe Connect Express to process and deliver all donations.
                Stripe is a PCI DSS Level 1 certified payment processor used by Amazon, Google, and Shopify.
                CharitMe never sees, stores, or handles your bank account or card details.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  'PCI DSS Level 1 certified payment processing',
                  'Bank-level encryption for all financial data',
                  'Automated fraud detection and risk scoring',
                  'Secure identity verification and KYC compliance',
                  'Support for 40+ countries and all major currencies',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <span className="font-black text-emerald-600">✓</span>
                    <span className="text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8">
              <h3 className="text-2xl font-black text-slate-950">Payout holds — explained</h3>
              <div className="mt-4 space-y-4">
                {[
                  {
                    title: 'New account hold (7 days)',
                    desc: 'First-campaign accounts have a 7-day payout hold to allow for fraud review and any donor disputes.',
                    color: 'border-amber-200 bg-amber-50',
                  },
                  {
                    title: 'Under review hold',
                    desc: 'Campaigns flagged for trust review have payouts frozen until the review is complete. You are notified and have 48 hours to respond.',
                    color: 'border-red-200 bg-red-50',
                  },
                  {
                    title: 'No hold (verified accounts)',
                    desc: 'Established accounts with clean history receive payouts on the standard schedule with no hold period.',
                    color: 'border-emerald-200 bg-emerald-50',
                  },
                ].map((item) => (
                  <div key={item.title} className={`rounded-2xl border p-4 ${item.color}`}>
                    <div className="font-black text-slate-950">{item.title}</div>
                    <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">Payout FAQ</h2>
          </div>
          <div className="mx-auto max-w-3xl space-y-4">
            {PAYOUT_FAQS.map((item) => (
              <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-black text-slate-950">{item.q}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container">
          <div className="rounded-3xl bg-emerald-600 px-8 py-14 text-center">
            <h2 className="text-3xl font-black text-white">Ready to get paid?</h2>
            <p className="mx-auto mt-4 max-w-xl text-emerald-100">
              Connect your Stripe account from your dashboard in under 5 minutes.
              Donations start transferring automatically once your campaign goes live.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/create" className="rounded-xl bg-white px-8 py-4 text-sm font-black text-emerald-700">
                Start a campaign →
              </Link>
              <Link href="/faq#payouts" className="rounded-xl border border-emerald-400 px-8 py-4 text-sm font-black text-white">
                Payout FAQ
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
