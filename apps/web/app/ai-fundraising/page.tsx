import Link from 'next/link';
import type { Metadata } from 'next';
import { AI_MOAT_FEATURES, AI_COPILOT_ACTIONS, GROWTH_PLAYBOOK } from '../../lib/ai-platform';

export const metadata: Metadata = {
  title: 'AI Fundraising — Copilot, Growth Engine & Trust Score',
  description: 'GiveRise AI helps campaigns become clearer, stronger, and more trusted. Generate stories, social posts, email appeals, and donor FAQs — without losing authenticity.',
};

export default function AiFundraisingPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="hero-mesh border-b border-slate-200 py-16 sm:py-24">
        <div className="container">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-black text-emerald-700">
              AI fundraising
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
              AI that helps campaigns<br className="hidden sm:block" /> earn trust and raise more.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              GiveRise AI doesn't replace your story — it helps you tell it better.
              Generate campaigns, outreach, updates, and trust signals without losing the authenticity donors respond to.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create" className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-soft">
                Try AI Copilot free
              </Link>
              <Link href="/pricing" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900">
                See AI plans
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Four AI moats */}
      <section className="py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">Four AI systems working together</h2>
            <p className="mt-3 text-slate-600">Every GiveRise campaign benefits from four integrated AI engines that address the real reasons fundraisers fail.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {AI_MOAT_FEATURES.map((feature, i) => (
              <div key={feature.title} className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 font-black text-emerald-700">
                  {i + 1}
                </div>
                <h3 className="text-xl font-black text-slate-950">{feature.title}</h3>
                <div className="mt-3 rounded-xl bg-red-50 px-4 py-2">
                  <span className="text-xs font-black text-red-600 uppercase tracking-wide">The problem: </span>
                  <span className="text-xs text-red-700">{feature.complaint}</span>
                </div>
                <div className="mt-2 rounded-xl bg-emerald-50 px-4 py-2">
                  <span className="text-xs font-black text-emerald-700 uppercase tracking-wide">The solution: </span>
                  <span className="text-xs text-emerald-800">{feature.solution}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Copilot actions */}
      <section className="bg-slate-50 py-16">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <div className="mb-3 text-sm font-black uppercase tracking-wide text-emerald-700">AI Campaign Copilot</div>
              <h2 className="text-3xl font-black text-slate-950">Everything the Copilot can do</h2>
              <p className="mt-4 leading-7 text-slate-600">
                The AI Copilot is a conversational campaign builder.
                Start from a few rough notes or a voice memo — the Copilot turns it into a polished, authentic fundraising campaign optimized for trust and donation conversion.
              </p>
              <p className="mt-3 leading-7 text-slate-600">
                Every suggestion is yours to accept, edit, or reject. The Copilot helps you sound like yourself — just more clearly.
              </p>
              <Link href="/create" className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white">
                Try the Copilot →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {AI_COPILOT_ACTIONS.map((action) => (
                <div key={action} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <span className="shrink-0 font-black text-emerald-600">✓</span>
                  <span className="text-sm font-bold text-slate-700">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Growth Engine */}
      <section className="py-16">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-2">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8">
              <div className="mb-3 text-sm font-black uppercase tracking-wide text-emerald-700">AI Growth Engine</div>
              <h2 className="text-2xl font-black text-slate-950">Keep momentum alive after launch</h2>
              <p className="mt-3 leading-7 text-slate-600">
                Most campaigns peak in the first 48 hours and then stall.
                The Growth Engine monitors donation momentum and automatically recommends the right action at the right time.
              </p>
              <div className="mt-6 space-y-3">
                {GROWTH_PLAYBOOK.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3">
                    <span className="mt-0.5 shrink-0 font-black text-emerald-600">→</span>
                    <span className="text-sm text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-3 text-sm font-black uppercase tracking-wide text-blue-700">AI Trust Engine</div>
              <h2 className="text-2xl font-black text-slate-950">Build trust that donors can see</h2>
              <p className="mt-3 leading-7 text-slate-600">
                The AI Trust Engine evaluates every campaign across six dimensions and computes a public trust score (0–99).
                The score tells donors not "trust this" or "don't trust this" — but exactly which signals are verified.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  { label: 'Identity verification', desc: 'Government ID matched via Stripe KYC' },
                  { label: 'Beneficiary verification', desc: 'Relationship and need confirmed' },
                  { label: 'Payout destination', desc: 'Stripe account linked and verified' },
                  { label: 'Story quality', desc: 'Authenticity and completeness scored' },
                  { label: 'Evidence and proof', desc: 'Attached images, docs, and receipts' },
                  { label: 'Donor momentum', desc: 'Consistent giving over time' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <span className="mt-1 shrink-0 font-black text-blue-600">✓</span>
                    <div>
                      <div className="text-sm font-black text-slate-950">{item.label}</div>
                      <div className="text-xs text-slate-500">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/trust-safety" className="mt-6 inline-block text-sm font-black text-blue-700">
                Learn how the trust score is calculated →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Transparency Ledger */}
      <section className="bg-slate-50 py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <div className="mb-3 text-sm font-black uppercase tracking-wide text-slate-600">Transparency Ledger</div>
            <h2 className="text-3xl font-black text-slate-950">Show donors where every dollar went</h2>
            <p className="mt-3 text-slate-600">
              The Transparency Ledger is a public donation-to-impact trail. Fundraisers post milestones, receipts,
              payout records, and impact summaries. Donors see the full picture — not just the balance.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: '💰', title: 'Donation log', desc: 'Every donation recorded publicly (or anonymously)' },
              { icon: '🏁', title: 'Milestones', desc: 'Organizers post proof as goals are hit' },
              { icon: '🧾', title: 'Expense receipts', desc: 'Upload receipts to show how funds were spent' },
              { icon: '📊', title: 'Impact summaries', desc: 'AI-generated impact reports after campaign closes' },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 text-3xl">{item.icon}</div>
                <h3 className="font-black text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI plans */}
      <section className="py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">AI tools across every plan</h2>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-4 text-left font-black text-slate-700">Feature</th>
                  <th className="px-6 py-4 text-center font-black text-slate-700">Free</th>
                  <th className="px-6 py-4 text-center font-black text-emerald-700">Growth AI</th>
                  <th className="px-6 py-4 text-center font-black text-slate-700">Pro AI</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Campaign story generation', free: '✓', growth: '✓', pro: '✓' },
                  { feature: 'Title and tagline suggestions', free: '✓', growth: '✓', pro: '✓' },
                  { feature: 'Trust score and signals', free: '✓', growth: '✓', pro: '✓' },
                  { feature: 'Social media captions', free: 'Basic', growth: 'Unlimited', pro: 'Unlimited' },
                  { feature: 'Email and SMS outreach', free: '—', growth: '✓', pro: '✓' },
                  { feature: 'AI update writer', free: '—', growth: '✓', pro: '✓' },
                  { feature: 'Campaign health score', free: '—', growth: '✓', pro: '✓' },
                  { feature: 'Donor FAQ generator', free: '—', growth: '✓', pro: '✓' },
                  { feature: 'A/B copy testing', free: '—', growth: '—', pro: '✓' },
                  { feature: 'AI video scripts', free: '—', growth: '—', pro: '✓' },
                ].map((row, i) => (
                  <tr key={row.feature} className={i < 9 ? 'border-b border-slate-100' : ''}>
                    <td className="px-6 py-3 font-bold text-slate-700">{row.feature}</td>
                    <td className="px-6 py-3 text-center text-slate-500">{row.free}</td>
                    <td className="px-6 py-3 text-center font-bold text-emerald-700">{row.growth}</td>
                    <td className="px-6 py-3 text-center text-slate-600">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/create" className="rounded-xl bg-emerald-600 px-8 py-4 text-sm font-black text-white shadow-soft">
              Start free — AI included
            </Link>
            <Link href="/pricing" className="rounded-xl border border-slate-200 bg-white px-8 py-4 text-sm font-black text-slate-900">
              See all plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
