import Link from 'next/link';
import { StatStrip, statValue, moneyValue } from '../../components/IndexHero';
import { getCausesIndexData } from '../../lib/causes-index';
import Image from 'next/image';
import type React from 'react';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { boundedQuery } from '../../lib/query-timeout';
import { campaignColumns, applyLiveFilters } from '../../lib/campaign-visibility';
import { getRecentDonations } from '../../lib/home-data';
import { getCoverForCategory } from '../../lib/photo-catalog';
import DonateForm, { type DonateTarget } from './DonateForm';

export const metadata: Metadata = {
  title: 'Donate',
  description:
    'Give once or monthly to a verified cause. Every gift shows exactly where it goes, and 0% platform fees mean more of it reaches the people it was meant for.',
  alternates: { canonical: 'https://www.charitme.com/donate' },
};

export const revalidate = 300;

// ─────────────────────────────────────────────────────────────────────────────
// Everything here that states a number reads it from Supabase, and a failed read
// says so. A donation page that renders "0 supporters" or an empty campaign
// picker because a query timed out is worse than one that admits it — this is
// the page where a confident wrong number costs the most.
// ─────────────────────────────────────────────────────────────────────────────

/** `null` distinguishes a failed read from a genuinely empty result. */
async function getTargets(): Promise<DonateTarget[] | null> {
  try {
    const cols = await campaignColumns();
    const { data, error } = await boundedQuery(() =>
      applyLiveFilters(
        supabaseAdmin.from('campaigns').select('id, title, category'),
        cols,
      )
        .order('raised_amount', { ascending: false })
        .limit(100),
    );
    if (error) return null;
    return (data ?? []) as DonateTarget[];
  } catch {
    return null;
  }
}

async function getDonationCount(): Promise<number | null> {
  try {
    const { count, error } = await boundedQuery(() =>
      supabaseAdmin
        .from('donations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed'),
    );
    return error ? null : count ?? null;
  } catch {
    return null;
  }
}

const TRUST_ROWS = [
  { icon: 'shield', title: 'Trusted & Secure', body: 'Your donation is safe with bank-level security.' },
  { icon: 'heart', title: 'Direct Impact', body: 'We connect you to real people and causes.' },
  { icon: 'eye', title: '100% Transparency', body: 'See where your money goes and the difference it makes.' },
] as const;

const IMPACT = [
  { category: 'Emergency', icon: 'bowl', title: 'Provide Food', body: 'Nutritious meals for children and families in need.', pill: '$25 feeds a family' },
  { category: 'Community', icon: 'home', title: 'Safe Shelter', body: 'Help provide safe homes and emergency shelter.', pill: '$50 provides shelter' },
  { category: 'Education', icon: 'book', title: 'Education', body: 'Give children access to school and brighter futures.', pill: '$100 supports education' },
  { category: 'Medical', icon: 'cross', title: 'Health & Care', body: 'Provide medical care and essential health services.', pill: '$250 saves lives' },
  { category: 'Environment', icon: 'leaf', title: 'Long-Term Change', body: 'Support sustainable solutions that create lasting impact.', pill: '$500 transforms communities' },
] as const;

const TRUST_PANEL = [
  { icon: 'check', title: 'Verified Causes', body: 'We carefully vet every nonprofit and campaign.' },
  { icon: 'eye', title: '100% Transparency', body: 'Track your impact and see how funds are used.' },
  { icon: 'lock', title: 'Secure Donations', body: 'Your information and payments are always protected.' },
  { icon: 'heart', title: 'Powered by People', body: 'Real people. Real stories. Real impact.' },
] as const;

/** Shown only when there are not yet three real donations to quote. */
const FALLBACK_QUOTES = [
  { quote: 'Every donation includes a receipt and stays visible in your giving history.', name: 'Secure giving' },
  { quote: 'Verified campaign updates keep supporters close to the progress they helped make.', name: 'Transparent impact' },
  { quote: 'The optional tip is reducible to zero, so a full gift can reach the cause.', name: '0% platform fee' },
] as const;

function Ic({ name, className = 'dn-ic' }: { name: string; className?: string }) {
  const common = {
    className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  const paths: Record<string, React.ReactNode> = {
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
    eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    bowl: <><path d="M3 11h18a9 9 0 0 1-18 0Z" /><path d="M8 7c0-1.5 1-2 1-3M12 7c0-1.5 1-2 1-3M16 7c0-1.5 1-2 1-3" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M10 20v-6h4v6" /></>,
    book: <><path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 0-2 2Z" /><path d="M8 7h7M8 11h7" /></>,
    cross: <><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M12 10v6M9 13h6M9 6V4h6v2" /></>,
    leaf: <><path d="M11 20A7 7 0 0 1 4 13c0-6 8-9 16-9 0 8-3 16-9 16Z" /><path d="M11 20c0-4 2-8 6-11" /></>,
  };
  return <svg {...common}>{paths[name] ?? paths.heart}</svg>;
}

/* The `Stars` component is gone with the rating it drew. Nobody has ever rated
   CharitMe: there is no reviews or ratings table in this schema. */

export default async function DonatePage() {
  const [targets, donationCount, recent, platform] = await Promise.all([
    getTargets(),
    getDonationCount(),
    getRecentDonations(3).catch(() => []),
    // The SAME loader /causes, every /causes/<slug> page and /campaigns use.
    // A separate query here would be a second answer to "how much has been
    // raised" on the page that asks for money — the worst place for two
    // figures to disagree. It returns EMPTY rather than throwing, so a failed
    // read renders em dashes and never takes the donation form with it.
    getCausesIndexData(),
  ]);

  const targetsFailed = targets === null;

  return (
    <div className="dn">
      <nav className="dn-crumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Donate Now</span>
      </nav>

      {/* ── Hero: copy + trust on the left, the live donation panel on the right ── */}
      <section className="dn-hero" aria-labelledby="dn-title">
        <div className="dn-hero-media" aria-hidden="true">
          <Image
            src="/images/charitme-community-hero.png"
            alt=""
            fill
            priority
            sizes="(max-width: 1020px) 100vw, 62vw"
            quality={82}
          />
          <span className="dn-hero-shade" />
        </div>

        <div className="dn-hero-copy">
          <h1 id="dn-title">
            Your generosity creates real change.
            <span className="dn-title-heart"><Ic name="heart" /></span>
          </h1>
          <p className="dn-lede">
            Every donation brings hope, helps a family, and builds a better future for
            communities around the world.
          </p>

          <ul className="dn-trust">
            {TRUST_ROWS.map((row) => (
              <li key={row.title}>
                <span className="dn-trust-ic"><Ic name={row.icon} /></span>
                <span className="dn-trust-txt">
                  <b>{row.title}</b>
                  <small>{row.body}</small>
                </span>
              </li>
            ))}
          </ul>

          {/* ⚠️ A five-star rating and a cluster of four anonymous "supporter"
              circles used to sit here. Neither is real: there is no reviews or
              ratings table in this schema, so nobody has ever rated CharitMe
              five stars, and the circles stood in for a crowd of faces the
              page does not have. The identical pair was removed from the
              homepage; leaving them on the page that ASKS FOR MONEY would be
              the worse of the two places to keep them.

              What remains is the measured count, which was already correct —
              and renders a neutral phrase rather than a confident zero when the
              read fails. */}
          <div className="dn-proof">
            <span className="dn-proof-copy">
              <small>
                {donationCount === null
                  ? 'Trusted by supporters across CharitMe'
                  : `Trusted by ${donationCount.toLocaleString()} donation${donationCount === 1 ? '' : 's'} and counting`}
              </small>
            </span>
          </div>
        </div>

        <div className="dn-hero-panel">
          <DonateForm targets={targets ?? []} loadFailed={targetsFailed} />
        </div>
      </section>

      {/* ── The measured figures ──────────────────────────────────────────────
          The SAME `StatStrip` /causes, /campaigns and all 20 /causes/<slug>
          pages render, from the same loader. Four numbers, stated once, so a
          visitor cannot be shown a different total one click away.

          `statValue`/`moneyValue` render an em dash for a figure that could not
          be measured — never a zero, which is a different claim entirely on a
          page asking someone to give. */}
      <StatStrip
        label="CharitMe at a glance"
        tiles={[
          { value: statValue(platform.activeCampaigns), label: 'Active campaigns' },
          { value: moneyValue(platform.raisedTotalCents), label: 'Raised on CharitMe' },
          { value: statValue(platform.gifts), label: 'Gifts given' },
          { value: statValue(platform.countries), label: 'Countries supported' },
        ]}
      />

      {/* ── Impact ── */}
      <section className="dn-section" aria-labelledby="dn-impact">
        <h2 id="dn-impact" className="dn-h2">Where Your Donation Makes an Impact</h2>
        <ul className="dn-impact">
          {IMPACT.map((item) => (
            <li key={item.title} className="dn-impact-card">
              <span className="dn-impact-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getCoverForCategory(item.category)} alt="" width={320} height={190} loading="lazy" decoding="async" />
              </span>
              <span className="dn-impact-ic"><Ic name={item.icon} /></span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <span className="dn-impact-pill">{item.pill}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Trust ── */}
      <section className="dn-section" aria-labelledby="dn-trust-h">
        <h2 id="dn-trust-h" className="dn-h2">You Can Trust CharitMe</h2>
        <ul className="dn-trustgrid">
          {TRUST_PANEL.map((item) => (
            <li key={item.title}>
              <span className="dn-trustgrid-ic"><Ic name={item.icon} /></span>
              <b>{item.title}</b>
              <small>{item.body}</small>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Supporters ──
          Real donations where we have them, honestly-labelled platform facts
          where we do not. The homepage uses the same pattern; the page that
          asks for money is the worst possible place to invent a testimonial. */}
      <section className="dn-section" aria-labelledby="dn-says">
        <h2 id="dn-says" className="dn-h2">What Our Supporters Say</h2>
        <ul className="dn-quotes">
          {recent.length >= 3
            ? recent.slice(0, 3).map((d) => (
                <li key={d.id}>
                  <span className="dn-quote-avatar" aria-hidden="true" />
                  <div>
                    <p>Supported <strong>{d.campaignTitle}</strong> — because it mattered.</p>
                    <b>{d.name}</b>
                  </div>
                </li>
              ))
            : FALLBACK_QUOTES.map((q) => (
                <li key={q.name}>
                  <span className="dn-quote-avatar" aria-hidden="true" />
                  <div>
                    <p>{q.quote}</p>
                    <b>{q.name}</b>
                  </div>
                </li>
              ))}
        </ul>
      </section>

      <p className="dn-thanks">
        <Ic name="heart" /> Thank you for being the reason hope exists.
      </p>
    </div>
  );
}
