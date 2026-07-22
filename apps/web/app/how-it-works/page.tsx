import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicIcon } from '../../components/PublicIcon';
import { seoMetadata } from '../../lib/seo';
import AeoContent from '../../components/AeoContent';
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('/how-it-works', {
    title: 'How It Works',
    description: 'Learn how CharitMe makes fundraising simple, trusted, and effective — from campaign creation to verified payouts.',
    alternates: { canonical: 'https://www.charitme.com/how-it-works' },
  });
}

const STATS = [
  { value: '< 5 min', label: 'To launch a campaign' },
  { value: '0%', label: 'Mandatory platform fee' },
  { value: '2 days', label: 'Standard payout speed' },
  { value: '99 pt', label: 'Max AI trust score' },
];

const FUNDRAISER_STEPS = [
  {
    num: '01',
    title: 'Create your campaign in minutes',
    body: 'Enter a title, category, goal amount, and deadline. Our AI Copilot turns your rough notes into a polished, authentic story — or write it yourself. Add a cover photo to boost trust signals.',
    icon: 'edit',
    tone: 'violet',
  },
  {
    num: '02',
    title: 'Build trust before you share',
    body: 'Connect your Stripe account to verify your identity and enable payouts. Add evidence like medical documents, receipts, or photos. Your AI trust score rises automatically as you complete each signal.',
    icon: 'shield',
    tone: 'green',
  },
  {
    num: '03',
    title: 'Share and grow your campaign',
    body: 'Use our AI Growth Engine to generate social captions, email appeals, SMS messages, and donor FAQs. Share links directly to your campaign page. Track donation momentum in real time.',
    icon: 'share',
    tone: 'blue',
  },
  {
    num: '04',
    title: 'Receive verified payouts',
    body: "Donations transfer to your connected Stripe account on a 2-business-day standard schedule. Choose same-day (1% fee) or instant payouts (1.5% fee) if eligible. All payouts are tracked in your transparency ledger.",
    icon: 'dollar',
    tone: 'orange',
  },
  {
    num: '05',
    title: 'Post updates and show impact',
    body: 'Keep donors engaged with campaign updates, receipts, milestone reports, and impact summaries. The AI Update Writer helps you write these in seconds. Transparent reporting builds long-term donor trust.',
    icon: 'chart',
    tone: 'pink',
  },
];

const DONOR_STEPS = [
  {
    num: '01',
    title: 'Find campaigns you trust',
    body: 'Browse by category, search by keyword, or sort by trust score. Every campaign displays a CharitMe AI trust signal, fundraiser verification status, and live donation momentum.',
    icon: 'search',
  },
  {
    num: '02',
    title: 'Read the trust signals',
    body: "Each campaign shows identity verification, story quality, evidence, payout verification, and donor momentum as clear visual indicators — so you can give with full confidence.",
    icon: 'check',
  },
  {
    num: '03',
    title: 'Donate transparently',
    body: "Choose your amount, optionally add a message, and decide whether to give anonymously. See the exact fee breakdown before you pay — including the optional CharitMe tip you can set to $0.",
    icon: 'heart',
  },
  {
    num: '04',
    title: 'Get a receipt and follow updates',
    body: 'Receive an automated payment receipt from Stripe. Create an account to follow campaign updates, see where your money was used, and get notified when organizers post impact reports.',
    icon: 'mail',
  },
];

const TRUST_SIGNALS = [
  { label: 'Identity verified', detail: 'Organizer identity confirmed via Stripe KYC', done: true },
  { label: 'Beneficiary verified', detail: 'Beneficiary relationship and need confirmed', done: true },
  { label: 'Payout connected', detail: 'Stripe Connect account linked and verified', done: true },
  { label: 'Story completeness', detail: 'Full story with context, urgency, and outcome', done: true },
  { label: 'Evidence attached', detail: 'Images, medical docs, receipts, or proof', done: false },
];

const TONE_MAP: Record<string, string> = {
  violet: 'kind-icon',
  green: 'kind-icon kind-icon-green',
  blue: 'kind-icon kind-icon-blue',
  orange: 'kind-icon kind-icon-orange',
  pink: 'kind-icon kind-icon-pink',
};

export default async function HowItWorksPage() {
  return (
    <div className="pub-page hiw-page">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="pricing-hero hiw-hero">
        <div className="pub-breadcrumb">
          <Link href="/">Home</Link> <span>&gt;</span> <b>How It Works</b>
        </div>
        <span className="pub-badge"><PublicIcon name="ai" /><span>Powered by AI</span></span>
        <h1>Create, verify, share,<br /><em>receive support.</em></h1>
        <p>
          CharitMe keeps campaign creation simple while adding trust checks, AI optimisation,
          and payout transparency behind the scenes — so every campaign can reach its potential.
        </p>
        <div className="pub-actions hiw-hero-actions">
          <Link href="/create" className="pub-btn primary">Start a Campaign</Link>
          <Link href="/campaigns" className="pub-btn secondary">Browse Campaigns</Link>
        </div>
      </section>

      {/* ── Quick stats ──────────────────────────────────────── */}
      <div className="hiw-stats">
        {STATS.map((s) => (
          <div key={s.label}>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Fundraiser steps ─────────────────────────────────── */}
      <section className="pub-section hiw-section">
        <div className="hiw-label violet">For Fundraisers</div>
        <h2>From idea to funded campaign in 5 steps</h2>
        <div className="hiw-steps">
          {FUNDRAISER_STEPS.map((step) => (
            <article key={step.num} className="hiw-step">
              <div className="hiw-step-num">{step.num}</div>
              <div className={TONE_MAP[step.tone]}><PublicIcon name={step.icon} /></div>
              <div className="hiw-step-copy">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="hiw-cta-row">
          <Link href="/create" className="pub-btn primary">Start your campaign →</Link>
        </div>
      </section>

      {/* ── Donor steps ──────────────────────────────────────── */}
      <section className="pub-section hiw-section hiw-donor-section">
        <div className="hiw-label blue">For Donors</div>
        <h2>Give with confidence in 4 steps</h2>
        <div className="hiw-donors">
          {DONOR_STEPS.map((step) => (
            <article key={step.num} className="hiw-donor-step">
              <div className="hiw-donor-head">
                <div className="kind-icon kind-icon-blue"><PublicIcon name={step.icon} /></div>
                <span className="hiw-label blue" style={{ textTransform: 'none', fontSize: 12, fontWeight: 950 }}>Step {step.num}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
        <div className="hiw-cta-row">
          <Link href="/campaigns" className="pub-btn secondary">Browse trusted campaigns →</Link>
        </div>
      </section>

      {/* ── Trust section ────────────────────────────────────── */}
      <section className="pub-section hiw-trust-section">
        <div className="hiw-trust-grid">
          <div>
            <h2>Why trust matters on every campaign</h2>
            <p>
              Most crowdfunding platforms tell donors to trust campaigns based on writing quality alone.
              CharitMe computes a public trust score from identity verification, beneficiary verification,
              payout verification, story quality, evidence, donor momentum, and admin review — giving
              every donor a clear, objective signal before they give.
            </p>
            <Link href="/trust-safety" className="hiw-trust-link">
              Learn about our trust system <PublicIcon name="arrow" />
            </Link>
          </div>
          <div className="hiw-signals">
            {TRUST_SIGNALS.map((signal) => (
              <div key={signal.label} className={`hiw-signal ${signal.done ? 'done' : ''}`}>
                <span>{signal.done ? '✓' : '○'}</span>
                <div>
                  <strong>{signal.label}</strong>
                  <small>{signal.detail}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ─────────────────────────────────────────── */}
      <section className="hiw-cta-band">
        <h2>Ready to start raising?</h2>
        <p>Launch your campaign in under 5 minutes. 0% platform fee. AI Copilot included free.</p>
        <div className="hiw-cta-band-actions">
          <Link href="/create" className="pub-btn primary">Start free campaign</Link>
          <Link href="/pricing" className="pub-btn secondary">See pricing</Link>
        </div>
      </section>
      <AeoContent route="/how-it-works" title="How CharitMe works: answers" />

    </div>
  );
}
