import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicIcon } from '../../components/PublicIcon';
import { IndexHero, StatStrip } from '../../components/IndexHero';
import { getCoverForCategory } from '../../lib/photo-catalog';
import { getRouteFaqs } from '../../lib/route-faqs';
import { getContactStats, getContactDetails, formatContactCount } from '../../lib/contact-page';
import ContactForm from './ContactForm';
import ContactFaq from './ContactFaq';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: "Reach the CharitMe team — we're here to help with campaigns, donations, AI fundraising, billing, and more.",
  alternates: { canonical: 'https://www.charitme.com/contact' },
};

/**
 * Dynamic on purpose. Every loader is failure-safe — figures fall back to
 * `null` (an em dash, never a zero) and the contact details to their defaults —
 * so a database problem degrades this page rather than failing the build.
 */
export const dynamic = 'force-dynamic';

/**
 * Other ways to reach us.
 *
 * ⚠️ Two entries were removed rather than restyled, because both were labelled
 * as something they did not do:
 *   • "Live Chat / Start Chat" opened a `mailto:` — there is no chat widget on
 *     this site, and a control that names a channel it cannot open is the dead
 *     affordance this repo keeps finding.
 *   • "Community / Join Community" pointed at /success-stories, which is a
 *     read-only story index, not a community to join.
 * What is left goes where it says it goes.
 */
const CHANNELS = [
  {
    icon: 'search',
    title: 'Help Center',
    body: 'Browse articles and guides for quick answers.',
    action: 'Visit the Help Center',
    href: '/help',
  },
  {
    icon: 'check',
    title: 'Trust & Safety',
    body: 'Report a campaign, or read how verification works.',
    action: 'See how we verify',
    href: '/trust-safety',
  },
  {
    icon: 'dollar',
    title: 'Fees & payouts',
    body: 'What reaches the cause, and when it lands.',
    action: 'See the breakdown',
    href: '/fees',
  },
] as const;

export default async function ContactPage() {
  // Independent reads, so they run together rather than in series.
  const [stats, details, faqs] = await Promise.all([
    getContactStats(),
    getContactDetails(),
    getRouteFaqs('/contact', 5),
  ]);

  return (
    <div className="ct-page">
      <IndexHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Contact' }]}
        title="Contact us"
        lede="Whether you are launching a campaign, supporting one, or just have a question — a real person reads every message, and every message becomes a tracked ticket."
        photo={getCoverForCategory('Community', 'contact-hero')}
        photoCategory="Community"
        photoKey="contact"
        actions={
          <a href="#contact-form" className="cx-btn-secondary">Send us a message</a>
        }
      />

      <div className="container ct-main">
        {/* Measured, from support_cases / campaigns / donations. Every tile is
            `number | null` and renders an em dash when it could not be read —
            "0 campaigns" and "we could not count them" are opposite claims. */}
        <section className="ct-stats" aria-labelledby="ct-stats-h">
          <h2 id="ct-stats-h" className="ct-h2">Support, measured</h2>
          <StatStrip
            label="Support at a glance"
            tiles={[
              { value: formatContactCount(stats.totalCases), label: 'Conversations handled' },
              { value: formatContactCount(stats.resolvedCases), label: 'Cases resolved' },
              { value: formatContactCount(stats.activeCampaigns), label: 'Campaigns we support' },
              { value: formatContactCount(stats.donorsHelped), label: 'Donors supported' },
            ]}
          />
        </section>

        {/* ── Details + form ───────────────────────────────────────────────── */}
        <section className="ct-grid" id="contact-form" aria-labelledby="ct-grid-h">
          <div className="ct-info">
            <h2 id="ct-grid-h" className="ct-h2 ct-h2--left">Get in touch</h2>

            <ul className="ct-info-list">
              <li className="ct-info-card">
                <span className="ct-info-ic ct-info-ic--0" aria-hidden="true"><PublicIcon name="mail" /></span>
                <div>
                  <h3>Email us</h3>
                  <a href={`mailto:${details.email}`}>{details.email}</a>
                  {/* No "we reply within X" claim: there is no first-response
                      timestamp in the schema to measure one from, and the
                      previous page's proxy produced 250 days off seeded rows.
                      See lib/contact-page.ts. */}
                  <span>A real person reads every message.</span>
                </div>
              </li>

              {/* Phone and address render ONLY when configured. Both were
                  hard-coded inventions before — a made-up statistic is bad, a
                  made-up phone number and postal address on a contact page send
                  a visitor to call a stranger. See lib/contact-page.ts. */}
              {details.phone && (
                <li className="ct-info-card">
                  <span className="ct-info-ic ct-info-ic--1" aria-hidden="true"><PublicIcon name="users" /></span>
                  <div>
                    <h3>Call us</h3>
                    <a href={`tel:${details.phone.replace(/[^+\d]/g, '')}`}>{details.phone}</a>
                  </div>
                </li>
              )}

              {details.address && (
                <li className="ct-info-card">
                  <span className="ct-info-ic ct-info-ic--2" aria-hidden="true"><PublicIcon name="globe" /></span>
                  <div>
                    <h3>Our office</h3>
                    <p>{details.address}</p>
                  </div>
                </li>
              )}

              <li className="ct-info-card">
                <span className="ct-info-ic ct-info-ic--3" aria-hidden="true"><PublicIcon name="shield" /></span>
                <div>
                  <h3>Every message is tracked</h3>
                  <p>Your note opens a real support ticket, not an inbox rule.</p>
                  <span>Nothing falls through the cracks.</span>
                </div>
              </li>
            </ul>
          </div>

          <ContactForm />
        </section>

        {/* ── Other ways to reach us ───────────────────────────────────────── */}
        <section className="ct-channels" aria-labelledby="ct-channels-h">
          <h2 id="ct-channels-h" className="ct-h2">Other ways to get an answer</h2>
          <ul className="ct-channel-grid">
            {CHANNELS.map((channel, i) => (
              <li key={channel.title}>
                <Link href={channel.href} className="ct-channel">
                  <span className={`ct-channel-ic ct-channel-ic--${i}`} aria-hidden="true">
                    <PublicIcon name={channel.icon} />
                  </span>
                  <strong>{channel.title}</strong>
                  <span>{channel.body}</span>
                  <em>{channel.action} →</em>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Real `aeo_entries` rows, the same table /faq renders — so an answer
            edited in the admin console changes both surfaces rather than the
            two drifting apart. Renders nothing at all when there is nothing to
            show. */}
        <ContactFaq faqs={faqs} />

        <section className="ct-cta" aria-labelledby="ct-cta-h">
          <span className="ct-cta-ic" aria-hidden="true"><PublicIcon name="heart" /></span>
          <div>
            <h2 id="ct-cta-h">Still have questions?</h2>
            <p>No bots and no runaround — just a team that cares about your cause as much as you do.</p>
          </div>
          <div className="ct-cta-actions">
            <Link href="/help" className="cx-btn-secondary ct-cta-secondary">Visit the Help Center</Link>
            <a href="#contact-form" className="cta-primary" style={{ display: 'inline-flex' }}>
              Message our team
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
