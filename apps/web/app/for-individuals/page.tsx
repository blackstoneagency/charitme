import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'For Individuals — Personal Fundraising',
  description: 'CharitMe makes personal fundraising for medical bills, emergencies, memorials, and family needs simple, trusted, and fast — with a free AI Copilot and 0% platform fee.',
  alternates: { canonical: 'https://www.charitme.com/for-individuals' },
};

const CATEGORIES = [
  { icon: '🏥', label: 'Medical', description: 'Surgery, treatment, recovery, caregiving expenses' },
  { icon: '🕊️', label: 'Memorial & Funeral', description: 'Final expenses, obituary costs, family support' },
  { icon: '🚨', label: 'Emergency', description: 'House fire, natural disaster, sudden job loss' },
  { icon: '🎓', label: 'Education', description: 'Tuition, study abroad, certification costs' },
  { icon: '🐾', label: 'Pet / Animal', description: 'Vet bills, rescue, animal rehabilitation' },
  { icon: '🏘️', label: 'Community', description: 'Neighborhood projects, local causes, community needs' },
];

const INDIVIDUAL_STEPS = [
  {
    step: '01',
    icon: '✏️',
    title: 'Create your campaign in minutes',
    body: 'Enter your title, goal, category, and story. Our AI Copilot turns rough notes into a polished, authentic fundraising story — or write it yourself. Takes under 5 minutes.',
  },
  {
    step: '02',
    icon: '🛡️',
    title: 'Build trust to raise more',
    body: 'Complete your identity verification via Stripe, add supporting evidence (photos, medical records, receipts), and watch your trust score rise automatically.',
  },
  {
    step: '03',
    icon: '📣',
    title: 'Share everywhere',
    body: 'Use AI-generated social captions, email appeals, and SMS messages to reach your network quickly. Track views and donation momentum in real time.',
  },
  {
    step: '04',
    icon: '💸',
    title: 'Receive payouts directly',
    body: 'Connect your bank via Stripe and receive donations on a 2-business-day schedule. Eligible verified users can choose same-day or instant payouts for urgent needs.',
  },
];

const INDIVIDUAL_FAQS = [
  {
    q: 'Is there a fee to start?',
    a: 'No. Creating and running a campaign is completely free. CharitMe charges 0% mandatory platform fee. Donors can optionally add a support tip at checkout.',
  },
  {
    q: 'How do I get my money?',
    a: 'Connect a Stripe account from your dashboard. After identity verification (usually 1–3 minutes), donations transfer to your bank on a 2-business-day schedule.',
  },
  {
    q: 'Can I fundraise for someone else?',
    a: 'Yes. You can create a campaign on behalf of a family member, friend, or community member. Add them as a beneficiary and verify the relationship to increase your trust score.',
  },
  {
    q: 'What if my campaign is flagged?',
    a: 'Flagged campaigns are reviewed within 24 hours. You will be notified and given 48 hours to respond before any action is taken. You can appeal any decision.',
  },
  {
    q: 'How do donors know my campaign is real?',
    a: 'Your AI trust score shows donors exactly which verification steps you have completed — identity, payout connection, story quality, evidence, and donor momentum.',
  },
];

export default function ForIndividualsPage() {
  return (
    <div className="mktg-page">
      {/* Hero */}
      <section className="hero-mesh border-b border-slate-200 py-16 sm:py-24">
        <div className="container">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-black text-emerald-700">
              For individuals
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
              A safer way to ask<br className="hidden sm:block" /> for help.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Personal fundraising for medical bills, emergencies, memorials, education, and family needs —
              with built-in trust signals so donors give with confidence and you get your money faster.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create" className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-soft">
                Start a free campaign
              </Link>
              <Link href="/how-it-works" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900">
                How it works
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
              { value: 'Free', label: 'AI Copilot included' },
              { value: '2 days', label: 'Standard payout speed' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <div className="text-3xl font-black text-emerald-700">{s.value}</div>
                <div className="mt-1 text-sm font-bold text-slate-600">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">Fundraise for anything that matters to you</h2>
            <p className="mt-3 text-slate-600">CharitMe supports personal, emergency, and community fundraisers across all major categories.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.label}
                href={`/campaigns?category=${cat.label.toLowerCase().replace(/\s/g, '-')}`}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="text-3xl">{cat.icon}</span>
                <div>
                  <div className="font-black text-slate-950">{cat.label}</div>
                  <div className="text-sm text-slate-500">{cat.description}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 py-16">
        <div className="container">
          <div className="mb-12">
            <h2 className="text-3xl font-black text-slate-950">From idea to funded in 4 steps</h2>
            <p className="mt-3 text-slate-600">No fundraising experience needed. CharitMe guides you through every step.</p>
          </div>
          <div className="space-y-5">
            {INDIVIDUAL_STEPS.map((step) => (
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
          <div className="mt-10 text-center">
            <Link href="/create" className="inline-block rounded-xl bg-emerald-600 px-8 py-4 text-sm font-black text-white shadow-soft">
              Start your campaign →
            </Link>
          </div>
        </div>
      </section>

      {/* Trust checklist */}
      <section className="py-16">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-black text-slate-950">How to maximize your trust score</h2>
              <p className="mt-4 leading-7 text-slate-600">
                Your trust score is not a judgment — it describes the evidence you have provided.
                Each completed step raises your score and gives donors more confidence to give.
                A higher score typically means more donations.
              </p>
              <Link href="/trust-safety" className="mt-6 inline-block text-sm font-black text-emerald-700">
                Learn how the trust score is calculated →
              </Link>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Verify your identity via Stripe', points: '+12 pts', done: true },
                { label: 'Connect a Stripe payout account', points: '+10 pts', done: true },
                { label: 'Verify beneficiary relationship', points: '+10 pts', done: false },
                { label: 'Write a detailed story (280+ characters)', points: '+8 pts', done: true },
                { label: 'Add supporting evidence (photos, docs)', points: '+8 pts', done: false },
                { label: 'Set a campaign deadline', points: '+4 pts', done: true },
              ].map((item) => (
                <div key={item.label} className={`flex items-center justify-between rounded-2xl border p-4 ${item.done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`shrink-0 text-lg font-black ${item.done ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {item.done ? '✓' : '○'}
                    </span>
                    <span className="text-sm font-bold text-slate-800">{item.label}</span>
                  </div>
                  <span className="shrink-0 text-xs font-black text-emerald-700">{item.points}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">Common questions</h2>
          </div>
          <div className="mx-auto max-w-3xl space-y-4">
            {INDIVIDUAL_FAQS.map((item) => (
              <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-black text-slate-950">{item.q}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/faq" className="text-sm font-black text-emerald-700">
              See all FAQ →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-emerald-600 py-16">
        <div className="container text-center">
          <h2 className="text-3xl font-black text-white">Start raising in under 5 minutes</h2>
          <p className="mx-auto mt-4 max-w-xl text-emerald-100">
            Free to create. Free to run. AI Copilot included. No credit card required.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/create" className="rounded-xl bg-white px-8 py-4 text-sm font-black text-emerald-700">
              Create a free campaign →
            </Link>
            <Link href="/how-it-works" className="rounded-xl border border-emerald-400 px-8 py-4 text-sm font-black text-white">
              How it works
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
