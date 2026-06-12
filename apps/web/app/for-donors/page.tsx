import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'For Donors — Give with Confidence',
  description: 'CharitMe gives every donor AI-computed trust scores, transparent fee breakdowns, anonymous giving, receipts, and impact updates — so you can give confidently.',
  alternates: { canonical: 'https://www.charitme.com/for-donors' },
};

const DONOR_FEATURES = [
  {
    icon: '🛡️',
    title: 'Trust scores before you give',
    body: 'Every campaign has a 0–99 AI trust score computed from identity verification, story quality, evidence, payout verification, and donor momentum — visible before checkout.',
  },
  {
    icon: '🔍',
    title: 'Verified identities',
    body: 'Organizers who complete Stripe KYC verification get a Verified badge. You can see exactly which trust signals each campaign has completed.',
  },
  {
    icon: '👁️',
    title: 'Transparent fee breakdown',
    body: 'See exactly where every dollar goes before you pay — how much reaches the campaign, what Stripe charges, and the optional CharitMe tip you control.',
  },
  {
    icon: '🕶️',
    title: 'Donate anonymously',
    body: 'Check "Give anonymously" at checkout. Your name is hidden from the campaign page and from the organizer — only the donation amount and timestamp are recorded.',
  },
  {
    icon: '📧',
    title: 'Automatic receipt',
    body: 'Stripe emails you a payment receipt after every donation. For verified nonprofits, a formal tax receipt is also sent where applicable.',
  },
  {
    icon: '📊',
    title: 'Impact updates from organizers',
    body: 'Get notified when organizers post milestone updates, expense receipts, and impact summaries. See where your donation was used.',
  },
];

const TRUST_INDICATORS = [
  { icon: '🪪', label: 'Identity verified', description: 'Government ID matched via Stripe KYC' },
  { icon: '👥', label: 'Beneficiary confirmed', description: 'Relationship and need verified' },
  { icon: '🏦', label: 'Payout connected', description: 'Stripe account linked before payouts' },
  { icon: '📝', label: 'Story quality scored', description: 'AI evaluates context and authenticity' },
  { icon: '📎', label: 'Evidence attached', description: 'Documents, photos, and receipts attached' },
  { icon: '📈', label: 'Donor momentum', description: 'Consistent giving from multiple donors' },
];

export default function ForDonorsPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="hero-mesh border-b border-slate-200 py-16 sm:py-24">
        <div className="container">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-blue-200 bg-white px-3 py-1 text-sm font-black text-blue-700">
              For donors
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
              Give with confidence.<br className="hidden sm:block" /> Not just hope.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              CharitMe shows you trust scores, verification badges, transparent fee breakdowns, and impact updates —
              so every donation is backed by evidence, not just emotion.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/campaigns" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-soft">
                Browse trusted campaigns
              </Link>
              <Link href="/trust-safety" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900">
                How trust works
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Key stats */}
      <section className="border-b border-slate-100 py-10">
        <div className="container">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: 'Public', label: 'Trust score on every campaign' },
              { value: '0%', label: 'Mandatory platform fee' },
              { value: '$0', label: 'Minimum tip — fully optional' },
              { value: '24 hrs', label: 'Report review turnaround' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <div className="text-3xl font-black text-blue-700">{s.value}</div>
                <div className="mt-1 text-sm font-bold text-slate-600">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Donor features */}
      <section className="py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">What donors get on every campaign</h2>
            <p className="mt-3 text-slate-600">CharitMe was built to protect donors first. Every feature below is available on every campaign — free, public, and automatic.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {DONOR_FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 text-3xl">{feature.icon}</div>
                <h3 className="font-black text-slate-950">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust indicators explained */}
      <section className="bg-slate-50 py-16">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-black text-slate-950">What the trust signals mean</h2>
              <p className="mt-4 leading-7 text-slate-600">
                Every CharitMe campaign displays a set of trust indicators on its public page.
                These are objective verification signals — not subjective ratings.
                No campaign is labeled &ldquo;fraudulent&rdquo; publicly — instead, you see exactly which evidence is present.
              </p>
              <Link href="/trust-safety" className="mt-6 inline-block text-sm font-black text-blue-700">
                Read our full trust & safety policy →
              </Link>
            </div>
            <div className="space-y-3">
              {TRUST_INDICATORS.map((item) => (
                <div key={item.label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <div className="font-black text-slate-950">{item.label}</div>
                    <div className="text-sm text-slate-500">{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Fee transparency */}
      <section className="py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">Transparent checkout — always</h2>
            <p className="mt-3 text-slate-600">
              Before you confirm payment, CharitMe shows you a complete fee breakdown. No hidden charges.
            </p>
          </div>
          <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 text-center">
              <div className="text-sm font-black uppercase tracking-widest text-slate-500">Example: $100 donation</div>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Campaign receives', value: '$94.00', color: 'text-emerald-700', note: '' },
                { label: 'Stripe processing fee', value: '$3.20', color: 'text-slate-600', note: '2.9% + $0.30' },
                { label: 'Optional CharitMe tip', value: '$8.00', color: 'text-slate-600', note: 'Default 8% — change to $0' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <div>
                    <span className="text-sm font-bold text-slate-700">{row.label}</span>
                    {row.note && <span className="ml-2 text-xs text-slate-400">{row.note}</span>}
                  </div>
                  <span className={`font-black ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-slate-400">
              Donors can cover the Stripe fee so 100% reaches the campaign. Tip is always editable to $0.
            </p>
          </div>
        </div>
      </section>

      {/* How to report */}
      <section className="bg-blue-50 py-16">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-black text-slate-950">Something feel wrong? Report it.</h2>
              <p className="mt-4 leading-7 text-slate-600">
                Every campaign has a Report button visible to all users — no account required.
                Reports are anonymous and reviewed within 24 hours by our trust and safety team.
                If fraud is confirmed, payouts are frozen and affected donors are notified.
              </p>
              <Link href="/trust-safety#report" className="mt-6 inline-block text-sm font-black text-blue-700">
                Learn how reporting works →
              </Link>
            </div>
            <div className="space-y-4">
              {[
                { step: '1', text: 'Click Report on any campaign page' },
                { step: '2', text: 'Select a reason (suspected fraud, misleading info, duplicate, etc.)' },
                { step: '3', text: 'Our team reviews anonymously within 24 hours' },
                { step: '4', text: 'Confirmed fraud triggers payout freeze and donor notification' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 font-black text-white text-sm">
                    {item.step}
                  </div>
                  <p className="mt-1.5 text-sm text-slate-700">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container text-center">
          <h2 className="text-3xl font-black text-slate-950">Find a campaign to support</h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-600">
            Browse campaigns with trust scores, evidence, and verification badges — sorted by trust, category, or momentum.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/campaigns" className="rounded-xl bg-blue-600 px-8 py-4 text-sm font-black text-white shadow-soft">
              Browse trusted campaigns
            </Link>
            <Link href="/faq#donors" className="rounded-xl border border-slate-200 bg-white px-8 py-4 text-sm font-black text-slate-900">
              Donor FAQ
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
