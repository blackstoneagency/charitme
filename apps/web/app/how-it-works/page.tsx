import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'Learn how GiveRise makes fundraising simple, trusted, and effective — from campaign creation to verified payouts.',
};

const FUNDRAISER_STEPS = [
  {
    step: '01',
    title: 'Create your campaign in minutes',
    body: 'Enter a title, category, goal amount, and deadline. Our AI Copilot turns your rough notes into a polished, authentic story — or you can write it yourself. Add a cover photo to boost trust signals.',
    icon: '✏️',
  },
  {
    step: '02',
    title: 'Build trust before you share',
    body: 'Connect your Stripe account to verify your identity and enable payouts. Add evidence like medical documents, receipts, or photos. Your AI trust score rises automatically as you complete each signal.',
    icon: '🛡️',
  },
  {
    step: '03',
    title: 'Share and grow your campaign',
    body: 'Use our AI Growth Engine to generate social captions, email appeals, SMS messages, and donor FAQs. Share links directly to your campaign page. Track donation momentum in real time.',
    icon: '📣',
  },
  {
    step: '04',
    title: 'Receive verified payouts',
    body: 'Donations transfer to your connected Stripe account on a 2-business-day standard schedule. Choose same-day (1% fee) or instant payouts (1.5% fee) if you\'re eligible. All payouts are tracked in your transparency ledger.',
    icon: '💸',
  },
  {
    step: '05',
    title: 'Post updates and show impact',
    body: 'Keep donors engaged with campaign updates, receipts, milestone reports, and impact summaries. The AI Update Writer helps you write these in seconds. Transparent reporting builds long-term donor trust.',
    icon: '📊',
  },
];

const DONOR_STEPS = [
  {
    step: '01',
    title: 'Find campaigns you trust',
    body: 'Browse by category, search by keyword, or sort by trust score. Every campaign displays an AI-computed trust signal, fundraiser verification status, and donation momentum.',
    icon: '🔍',
  },
  {
    step: '02',
    title: 'Read the trust signals',
    body: 'Each campaign shows identity verification, story quality, evidence (images, documents), payout verification, and donor momentum as clear visual trust indicators — so you can give with confidence.',
    icon: '✅',
  },
  {
    step: '03',
    title: 'Donate transparently',
    body: 'Choose your amount, optionally add a message, and choose whether to give anonymously. See the exact fee breakdown before you pay — including the optional GiveRise tip you can set to $0.',
    icon: '❤️',
  },
  {
    step: '04',
    title: 'Get a receipt and follow updates',
    body: 'Receive an automated payment receipt from Stripe. Create an account to follow campaign updates, see where your money was used, and get notified when organizers post impact reports.',
    icon: '📧',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="hero-mesh border-b border-slate-200 py-16 sm:py-24">
        <div className="container">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-black text-emerald-700">
              How it works
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
              Create, verify, share,<br className="hidden sm:block" /> receive support.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              GiveRise keeps campaign creation simple while adding trust checks, AI optimization, and payout transparency behind the scenes — so every campaign can reach its potential.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create" className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-soft">
                Start a campaign
              </Link>
              <Link href="/campaigns" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900">
                Browse campaigns
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick stats */}
      <section className="border-b border-slate-100 py-10">
        <div className="container">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: '< 5 min', label: 'To launch a campaign' },
              { value: '0%', label: 'Mandatory platform fee' },
              { value: '2 days', label: 'Standard payout speed' },
              { value: '99 pt', label: 'Max AI trust score' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <div className="text-3xl font-black text-emerald-700">{s.value}</div>
                <div className="mt-1 text-sm font-bold text-slate-600">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fundraiser steps */}
      <section className="py-16">
        <div className="container">
          <div className="mb-12">
            <div className="mb-3 text-sm font-black uppercase tracking-wide text-emerald-700">For fundraisers</div>
            <h2 className="text-3xl font-black text-slate-950">From idea to funded campaign in 5 steps</h2>
          </div>
          <div className="space-y-6">
            {FUNDRAISER_STEPS.map((step) => (
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
          <div className="mt-8 text-center">
            <Link href="/create" className="inline-block rounded-xl bg-emerald-600 px-8 py-4 text-sm font-black text-white shadow-soft">
              Start your campaign →
            </Link>
          </div>
        </div>
      </section>

      {/* Donor steps */}
      <section className="bg-slate-50 py-16">
        <div className="container">
          <div className="mb-12">
            <div className="mb-3 text-sm font-black uppercase tracking-wide text-blue-700">For donors</div>
            <h2 className="text-3xl font-black text-slate-950">Give with confidence in 4 steps</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {DONOR_STEPS.map((step) => (
              <div key={step.step} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
                    {step.icon}
                  </div>
                  <div className="text-xs font-black uppercase tracking-widest text-blue-700">Step {step.step}</div>
                </div>
                <h3 className="text-lg font-black text-slate-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/campaigns" className="inline-block rounded-xl bg-blue-600 px-8 py-4 text-sm font-black text-white shadow-soft">
              Browse trusted campaigns →
            </Link>
          </div>
        </div>
      </section>

      {/* Trust section */}
      <section className="py-16">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-black text-slate-950">Why trust matters on every campaign</h2>
              <p className="mt-4 text-slate-600 leading-7">
                Most crowdfunding platforms tell donors to trust campaigns based on writing quality alone.
                GiveRise computes a public trust score from identity verification, beneficiary verification,
                payout verification, story quality, evidence, donor momentum, and admin review — giving
                every donor a clear, objective signal before they give.
              </p>
              <Link href="/trust-safety" className="mt-6 inline-block text-sm font-black text-emerald-700">
                Learn about our trust system →
              </Link>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Identity verified', detail: 'Organizer identity confirmed via Stripe KYC', done: true },
                { label: 'Beneficiary verified', detail: 'Beneficiary relationship and need confirmed', done: true },
                { label: 'Payout connected', detail: 'Stripe Connect account linked and verified', done: true },
                { label: 'Story completeness', detail: 'Full story with context, urgency, and outcome', done: true },
                { label: 'Evidence attached', detail: 'Images, medical docs, receipts, or proof', done: false },
              ].map((signal) => (
                <div key={signal.label} className={`flex items-start gap-3 rounded-2xl border p-4 ${signal.done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                  <span className={`mt-0.5 shrink-0 text-lg ${signal.done ? 'text-emerald-600' : 'text-slate-300'}`}>
                    {signal.done ? '✓' : '○'}
                  </span>
                  <div>
                    <div className="text-sm font-black text-slate-950">{signal.label}</div>
                    <div className="text-xs text-slate-500">{signal.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-emerald-600 py-16">
        <div className="container text-center">
          <h2 className="text-3xl font-black text-white">Ready to start raising?</h2>
          <p className="mx-auto mt-4 max-w-xl text-emerald-100">
            Launch your campaign in under 5 minutes. 0% platform fee. AI Copilot included free.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/create" className="rounded-xl bg-white px-8 py-4 text-sm font-black text-emerald-700">
              Start free campaign
            </Link>
            <Link href="/pricing" className="rounded-xl border border-emerald-400 px-8 py-4 text-sm font-black text-white">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
