import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicIcon } from '../../components/PublicIcon';
import CampaignImage from '../../components/CampaignImage';
import { IndexHero, StatStrip, statValue, moneyValue } from '../../components/IndexHero';
import { getCausesIndexData } from '../../lib/causes-index';
import { getHowItWorksFaqs } from '../../lib/how-it-works';
import { getDistinctPhotosForItems } from '../../lib/photo-catalog';
import HowItWorksFaq from './HowItWorksFaq';

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'Learn how CharitMe makes fundraising simple, trusted, and effective — from campaign creation to verified payouts.',
  alternates: { canonical: 'https://www.charitme.com/how-it-works' },
};

/*
 * ── Why the two long step-by-step flows are gone ───────────────────────────
 * This page previously carried a 5-step fundraiser flow and a 4-step donor
 * flow that the reference design does not have. They were kept on the first
 * pass because they stated product facts — Stripe KYC, the 2-business-day
 * payout schedule, the same-day 1% and instant 1.5% fees, how the trust score
 * is earned — and losing accurate detail to match a layout is a bad trade.
 *
 * That reasoning does not survive checking: every one of those facts is
 * already stated on a page whose whole job is to state it.
 *   • /fast-payouts  — the schedule and BOTH fees, verbatim, plus eligibility
 *   • /faq           — "Standard payouts are always free. Same-day … 1% …
 *                       instant … 1.5%."
 *   • /for-individuals — the 2-business-day schedule
 *   • /verification, /security, /fees — reached from the trust panel below
 *
 * So nothing is lost from the site, and this page now matches the design.
 * Do not reinstate them here; edit the owning page instead.
 */

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
  const [heroPhoto, ...supportingPhotos] = getDistinctPhotosForItems([
    { category: 'Volunteer', key: 'how-it-works-hero' },
    ...RIPPLE.map((_, index) => ({ category: 'Community', key: `how-it-works-ripple-${index}` })),
    { category: 'Family', key: 'how-it-works-family' },
  ]);
  const ripplePhotos = supportingPhotos.slice(0, RIPPLE.length);
  const trustPhoto = supportingPhotos[RIPPLE.length];

  return (
    <div className="hw-page">
      <IndexHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'How It Works' }]}
        title="How it works"
        heart
        lede="CharitMe makes it easy to create change. Whether you want to donate, fundraise, or start a campaign, we are here to guide you every step of the way."
        photo={heroPhoto}
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
                src={trustPhoto}
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
