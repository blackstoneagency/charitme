import Link from 'next/link';
import type { Metadata } from 'next';
import { TRUST_PILLARS } from '../../lib/ai-platform';

export const metadata: Metadata = {
  title: 'Trust & Safety',
  description: 'How GiveRise uses AI trust scores, identity verification, fraud screening, and transparent moderation to protect donors and fundraisers.',
};

const TRUST_SIGNALS = [
  { label: 'Identity verification', detail: 'Organizer identity confirmed via Stripe KYC — name, address, and government ID matched.', icon: '🪪' },
  { label: 'Beneficiary verification', detail: 'Beneficiary relationship and need confirmed to reduce misrepresentation risk.', icon: '👥' },
  { label: 'Payout destination', detail: 'Stripe Connect account linked and verified before any payouts can be issued.', icon: '🏦' },
  { label: 'Story quality', detail: 'AI evaluates context, urgency, specificity, and authenticity. Generic or copied stories are flagged.', icon: '📝' },
  { label: 'Evidence and proof', detail: 'Supporting images, medical records, receipts, or documents increase the trust score significantly.', icon: '📎' },
  { label: 'Donor momentum', detail: 'Consistent giving from multiple donors over time is a strong positive signal.', icon: '📈' },
];

const FRAUD_PREVENTION = [
  { title: 'Duplicate story detection', body: 'AI compares every new campaign story against our database to detect recycled or copied fundraising narratives.' },
  { title: 'Image reverse search', body: 'Cover images and attached media are screened for prior use across the platform and known fraudulent campaigns.' },
  { title: 'Velocity monitoring', body: 'Unusual account creation patterns, rapid campaign launches, and abnormal payout requests trigger automatic review flags.' },
  { title: 'Risk scoring', body: 'Every campaign has a private risk score computed by our AI. High-risk campaigns are reviewed before payouts are released.' },
  { title: 'Admin moderation queue', body: 'Trust and safety staff review flagged campaigns, donor reports, and payout disputes within 24 hours.' },
  { title: 'Payout holds', body: 'New accounts have a 7-day payout hold on their first campaign. Campaigns under review have payouts frozen until resolved.' },
];

const REPORT_STEPS = [
  { step: '1', title: 'Click "Report" on the campaign page', body: 'Every campaign has a Report button visible to all users — signed in or not.' },
  { step: '2', title: 'Choose the reason', body: 'Select from: Suspected fraud, Misleading information, Duplicate campaign, Privacy violation, or Other.' },
  { step: '3', title: 'Our team reviews within 24 hours', body: 'Reports are anonymous. Campaigns under review display a notice to donors while the investigation is active.' },
  { step: '4', title: 'Resolution', body: 'If fraud is confirmed, the campaign is removed, payouts are frozen, and affected donors are notified. Organizers can appeal decisions.' },
];

export default function TrustSafetyPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="hero-mesh border-b border-slate-200 py-16 sm:py-24">
        <div className="container">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-black text-emerald-700">
              Trust & Safety
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
              Built-in trust signals<br className="hidden sm:block" /> before donors give.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              GiveRise computes a public AI trust score for every campaign from identity, story, evidence, and donor signals —
              so donors can give with confidence, and fundraisers earn the trust they deserve.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create" className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-soft">
                Start a verified campaign
              </Link>
              <Link href="/campaigns" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900">
                Browse trusted campaigns
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust pillars */}
      <section className="py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">Six pillars of trust</h2>
            <p className="mt-3 text-slate-600">Every GiveRise campaign is evaluated across six evidence-based dimensions. Donors see the score and the signals publicly.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TRUST_PILLARS.map((pillar, i) => (
              <div key={pillar} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 font-black text-emerald-700">
                  {i + 1}
                </div>
                <p className="text-sm font-bold leading-6 text-slate-800">{pillar}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust score explained */}
      <section className="bg-slate-50 py-16">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-black text-slate-950">How the AI trust score works</h2>
              <p className="mt-4 leading-7 text-slate-600">
                The trust score is a 0–99 number computed automatically from objective signals — not subjective impressions.
                It never publicly labels a campaign as &ldquo;fraudulent&rdquo; — it describes the strength of evidence available for donors to evaluate.
              </p>
              <div className="mt-6 space-y-4">
                {[
                  { range: '88–99', label: 'Verified', color: 'bg-emerald-100 text-emerald-800', detail: 'Identity, beneficiary, payout, and story all verified. Strong evidence. Admin-approved.' },
                  { range: '70–87', label: 'Strong Trust', color: 'bg-blue-100 text-blue-800', detail: 'Most key signals verified. Good story. Some evidence present.' },
                  { range: '0–69', label: 'Needs More Info', color: 'bg-slate-100 text-slate-700', detail: 'Campaign is new or missing key verification steps. Not a fraud indicator — just less evidence.' },
                ].map((tier) => (
                  <div key={tier.label} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${tier.color}`}>{tier.label}</span>
                    <div>
                      <div className="text-xs font-black text-slate-500">Score {tier.range}</div>
                      <p className="mt-1 text-sm text-slate-600">{tier.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-950">What affects your score</h2>
              <div className="mt-6 space-y-3">
                {TRUST_SIGNALS.map((signal) => (
                  <div key={signal.label} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <span className="text-2xl">{signal.icon}</span>
                    <div>
                      <div className="font-black text-slate-950">{signal.label}</div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{signal.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fraud prevention */}
      <section className="py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">How we prevent fraud</h2>
            <p className="mt-3 text-slate-600">Six layers of protection work automatically in the background — before campaigns go live and before payouts are released.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FRAUD_PREVENTION.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 h-1.5 w-10 rounded-full bg-emerald-500" />
                <h3 className="font-black text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to report */}
      <section className="bg-slate-50 py-16">
        <div className="container">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-black text-slate-950">How to report a campaign</h2>
            <p className="mt-3 text-slate-600">Reporting is anonymous and takes under 60 seconds. Every report is reviewed by a human within 24 hours.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {REPORT_STEPS.map((step) => (
              <div key={step.step} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 font-black text-red-600">
                  {step.step}
                </div>
                <h3 className="font-black text-slate-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fundraiser rights */}
      <section className="py-16">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-2">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8">
              <h2 className="text-2xl font-black text-slate-950">For fundraisers</h2>
              <p className="mt-3 text-slate-600 leading-7">
                Your trust score is not a public judgment — it is a description of the evidence you have provided.
                Complete your verification steps, add supporting evidence, and your score rises automatically.
                If your campaign is reviewed or suspended, you will be notified and can appeal within 48 hours.
              </p>
              <Link href="/create" className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white">
                Build your trust score →
              </Link>
            </div>
            <div className="rounded-3xl border border-blue-200 bg-blue-50 p-8">
              <h2 className="text-2xl font-black text-slate-950">For donors</h2>
              <p className="mt-3 text-slate-600 leading-7">
                You should never feel pressured to donate to a campaign you are uncertain about.
                Use trust scores, verification badges, and donor comments to make informed decisions.
                If something feels wrong, report it — even if you are unsure.
                Your payment information is never stored by GiveRise.
              </p>
              <Link href="/campaigns" className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white">
                Browse verified campaigns →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
