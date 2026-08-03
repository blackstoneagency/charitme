import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicIcon } from '../../components/PublicIcon';
import CampaignImage from '../../components/CampaignImage';
import { IndexHero, StatStrip, statValue, moneyValue } from '../../components/IndexHero';
import { getCausesIndexData } from '../../lib/causes-index';
import { getHowItWorksFaqs } from '../../lib/how-it-works';
import { getCoverForCategory, getPhotosForCategory } from '../../lib/photo-catalog';
import HowItWorksFaq from './HowItWorksFaq';

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'Learn how CharitMe makes fundraising simple, trusted, and effective — from campaign creation to verified payouts.',
  alternates: { canonical: 'https://www.charitme.com/how-it-works' },
};

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

const _TRUST_SIGNALS = [
  { label: 'Identity verified', detail: 'Organizer identity confirmed via Stripe KYC', done: true },
  { label: 'Beneficiary verified', detail: 'Beneficiary relationship and need confirmed', done: true },
  { label: 'Payout connected', detail: 'Stripe Connect account linked and verified', done: true },
  { label: 'Story completeness', detail: 'Full story with context, urgency, and outcome', done: true },
  { label: 'Evidence attached', detail: 'Images, medical docs, receipts, or proof', done: false },
];

const _TONE_MAP: Record<string, string> = {
  violet: 'kind-icon',
  green: 'kind-icon kind-icon-green',
  blue: 'kind-icon kind-icon-blue',
  orange: 'kind-icon kind-icon-orange',
  pink: 'kind-icon kind-icon-pink',
};


/**
 * The reference's four steps. Authored copy — a step list is editorial, and
 * there is no table of "steps" to read it from. Each one links somewhere real:
 * a step that describes an action the visitor cannot then take is the "dead
 * button" failure in prose form.
 */
const IMPACT_STEPS = [
  { n: 1, title: 'Choose a cause', body: 'Explore causes that matter to you and find the one you want to support.', href: '/causes' },
  { n: 2, title: 'Take action', body: 'Donate, start a fundraiser, or share a campaign with your community.', href: '/campaigns' },
  { n: 3, title: 'Create impact', body: 'Your support goes directly to verified organisers and people in need.', href: '/verification' },
  { n: 4, title: 'See the change', body: 'Track progress, receive updates, and see the real difference you are making.', href: '/impact' },
] as const;

/** The "every action creates a ripple" row. */
const RIPPLE = [
  { title: 'Your support', body: 'You give with compassion and trust.' },
  { title: 'Stronger communities', body: 'Communities gain resources and opportunity.' },
  { title: 'Better lives', body: 'Families and individuals thrive with means.' },
  { title: 'A better world', body: 'Together, we build a kinder, more equitable world.' },
] as const;

/** The trust panel beside the FAQ. Every line links to the page that proves it. */
const TRUST_POINTS = [
  { text: 'All campaigns are reviewed and verified', href: '/verification' },
  { text: 'Secure transactions and data protection', href: '/security' },
  { text: 'Funds go directly to the cause', href: '/fees' },
  { text: 'Real stories and real impact', href: '/success-stories' },
] as const;

export default async function HowItWorksPage() {
  // Independent reads, so they run together rather than in series.
  const [platform, faqs] = await Promise.all([getCausesIndexData(), getHowItWorksFaqs(5)]);
  const ripplePhotos = getPhotosForCategory('Community', RIPPLE.length);

  return (
    <div className="hw-page">
      <IndexHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'How It Works' }]}
        title="How it works"
        heart
        lede="CharitMe makes it easy to create change. Whether you want to donate, fundraise, or start a campaign, we are here to guide you every step of the way."
        photo={getCoverForCategory('Volunteer')}
        photoCategory="Volunteer"
        photoKey="how-it-works"
      />

      <div className="container hw-main">
        <section className="hw-steps-band" aria-labelledby="hw-steps">
          <h2 id="hw-steps" className="hw-h2">Make an impact in 4 simple steps</h2>
          {/* The connector is drawn on the LIST, not between items, so it cannot
              trail off the last step or appear when the row wraps. */}
          <ol className="hw-steps">
            {IMPACT_STEPS.map((step) => (
              <li key={step.n}>
                <Link href={step.href} className="hw-step">
                  <span className={`hw-step-ic hw-step-ic--${step.n}`} aria-hidden="true">
                    {/* Names taken from PublicIcon's actual map. It falls back
                        to the sparkle for an unknown name WITHOUT erroring, so a
                        typo here ships the wrong glyph silently — 'community'
                        and 'gift' both did exactly that on the first pass. */}
                    <PublicIcon name={step.n === 1 ? 'users' : step.n === 2 ? 'heart' : step.n === 3 ? 'tag' : 'chart'} />
                    <span className="hw-step-n">{step.n}</span>
                  </span>
                  <strong>{step.title}</strong>
                  <span>{step.body}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {/* Measured. The reference asserts a seven-figure "people helped", a
            five-figure "lives transformed", a four-figure programme count and a
            three-figure country count; none is an entity in this schema. */}
        <section className="hw-impact" aria-labelledby="hw-impact-h">
          <h2 id="hw-impact-h" className="hw-h2">More than donations. Real impact.</h2>
          <StatStrip
            label="CharitMe at a glance"
            tiles={[
              { value: statValue(platform.activeCampaigns), label: 'Active campaigns' },
              { value: moneyValue(platform.raisedTotalCents), label: 'Raised on CharitMe' },
              { value: statValue(platform.gifts), label: 'Gifts given' },
              { value: statValue(platform.countries), label: 'Countries supported' },
            ]}
          />
        </section>

        <section className="hw-ripple-band" aria-labelledby="hw-ripple">
          <h2 id="hw-ripple" className="hw-h2">Every action creates a ripple</h2>
          <ul className="hw-ripple">
            {RIPPLE.map((r, i) => (
              <li key={r.title} className="hw-ripple-card">
                <span className="hw-ripple-media" aria-hidden="true">
                  <CampaignImage
                    src={ripplePhotos[i] ?? null}
                    category="Community"
                    campaignKey={`ripple-${i}`}
                    alt=""
                    width={320}
                    height={200}
                  />
                </span>
                <span className={`hw-ripple-ic hw-ripple-ic--${i}`} aria-hidden="true">
                  <PublicIcon name={i === 0 ? 'heart' : i === 1 ? 'users' : i === 2 ? 'shield' : 'globe'} />
                </span>
                <strong>{r.title}</strong>
                <span>{r.body}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── The detailed flows ────────────────────────────────────────────
            NOT in the reference, and kept deliberately. The reference's four
            steps are a donor-facing summary; these two lists are the page's
            actual product explanation — Stripe verification, the 2-day payout
            schedule and the same-day/instant fees, how the trust score is
            earned. None of that is answered by the four steps or by the FAQ
            rows, and /how-it-works is the page a visitor opens to find it.
            Deleting accurate product detail to match a layout is a loss the
            layout does not pay for. */}
        <section className="hw-flow" aria-labelledby="hw-flow-fund">
          <h2 id="hw-flow-fund" className="hw-h2">For fundraisers, step by step</h2>
          <ol className="hw-flow-list">
            {FUNDRAISER_STEPS.map((step) => (
              <li key={step.num} className="hw-flow-item">
                <span className="hw-flow-num" aria-hidden="true">{step.num}</span>
                <span className="hw-flow-ic" aria-hidden="true"><PublicIcon name={step.icon} /></span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="hw-flow" aria-labelledby="hw-flow-donor">
          <h2 id="hw-flow-donor" className="hw-h2">For donors, step by step</h2>
          <ol className="hw-flow-list">
            {DONOR_STEPS.map((step) => (
              <li key={step.num} className="hw-flow-item">
                <span className="hw-flow-num" aria-hidden="true">{step.num}</span>
                <span className="hw-flow-ic" aria-hidden="true"><PublicIcon name={step.icon} /></span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="hw-faq-band" aria-labelledby="hw-faq-h">
          <div className="hw-faq-col">
            <h2 id="hw-faq-h" className="hw-h2 hw-h2--left">Frequently asked questions</h2>
            <HowItWorksFaq faqs={faqs} />
          </div>

          <aside className="hw-trust" aria-labelledby="hw-trust-h">
            <span className="hw-trust-ic" aria-hidden="true"><PublicIcon name="shield" /></span>
            <h2 id="hw-trust-h">
              At CharitMe, trust and transparency are at the heart of everything we do.
            </h2>
            <ul>
              {TRUST_POINTS.map((point) => (
                <li key={point.text}>
                  <Link href={point.href}>
                    <span className="hw-trust-check" aria-hidden="true">✓</span>
                    {point.text}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/trust-safety" className="hw-trust-more">
              Learn more about our commitment to trust →
            </Link>
            <span className="hw-trust-media" aria-hidden="true">
              <CampaignImage
                src={getCoverForCategory('Family')}
                category="Family"
                campaignKey="hiw-trust"
                alt=""
                width={340}
                height={260}
              />
            </span>
          </aside>
        </section>

        <section className="hw-cta" aria-labelledby="hw-cta-h">
          <span className="hw-cta-ic" aria-hidden="true"><PublicIcon name="heart" /></span>
          <div>
            <h2 id="hw-cta-h">Ready to make a difference?</h2>
            <p>Join millions of changemakers creating a better tomorrow.</p>
          </div>
          <div className="hw-cta-actions">
            <Link href="/campaigns" className="cta-primary" style={{ display: 'inline-flex' }}>
              Donate now
            </Link>
            <Link href="/create/choose-path" className="cx-btn-secondary hw-cta-secondary">
              Start a fundraiser →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
