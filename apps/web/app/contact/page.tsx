import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import type { Metadata } from 'next';
import type React from 'react';
import { supabaseAdmin } from '../../lib/supabase';
import ContactForm from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: "Reach the CharitMe team — we're here to help with campaigns, donations, AI fundraising, billing, and more.",
  alternates: { canonical: 'https://www.charitme.com/contact' },
};

export const dynamic = 'force-dynamic';

const FAQS = [
  { q: 'How does CharitMe work?', a: 'Create a campaign in minutes, share it with your network, and our AI Growth Engine helps you reach the right donors — all with zero mandatory platform fees.' },
  { q: 'Is there a platform fee?', a: 'No. CharitMe charges $0 mandatory platform fees. We’re sustained by donors who choose to leave an optional tip at checkout.' },
  { q: 'How long does it take to receive donations?', a: 'Funds typically reach your connected Stripe account within 2–7 business days of a completed donation, depending on your bank.' },
  { q: 'Can I track my campaign performance?', a: 'Yes — your dashboard shows live donations, donor messages, trust score, and AI-powered insights to help you grow.' },
  { q: 'Is my data secure?', a: 'Absolutely. We use bank-level encryption, never sell your data, and run every campaign through our AI fraud and trust verification.' },
] as const;

const CONTACT_METHODS = [
  {
    icon: 'chat',
    title: 'Live Chat',
    body: 'Chat with our support team in real-time.',
    action: 'Start Chat',
    href: 'mailto:hello@charitme.com?subject=Live%20chat%20request',
  },
  {
    icon: 'book',
    title: 'Help Center',
    body: 'Browse articles and guides for quick answers.',
    action: 'Visit Help Center',
    href: '/faq',
  },
  {
    icon: 'community',
    title: 'Community',
    body: 'Connect with other fundraisers and experts.',
    action: 'Join Community',
    href: '/success-stories',
  },
  {
    icon: 'megaphone',
    title: 'Press Inquiries',
    body: 'For media and partnership opportunities.',
    action: 'Contact Press Team',
    href: 'mailto:press@charitme.com?subject=Press%20inquiry',
  },
] as const;

function Icon({ name, className = '' }: { name: string; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const paths: Record<string, React.ReactNode> = {
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5Z" /></>,
    community: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>,
    megaphone: <><path d="m3 11 18-5v12L3 14v-3Z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>,
    calendar: <><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="2" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    chevron: <path d="m6 9 6 6 6-6" />,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

async function getContactStatsUncached() {
  // ⚠️ Two reads here were UNBOUNDED, on a public page that anyone can load.
  //
  // `__tests__/unbounded-reads.test.ts` passed them because it treats any
  // filter as bounding the query — its stated reasoning is that a filter makes
  // a read "proportional to one user's data rather than the whole table". That
  // is true of `.eq('user_id', …)`. It is NOT true of a STATUS filter:
  // `.eq('status','completed')` on `donations` selects nearly every row that
  // exists, and `.in('status',['resolved','closed'])` selects most support
  // cases. Proportional to the platform, not to a user.
  //
  // Left alone they are wrong either way: unbounded and slow, or silently
  // capped by PostgREST's default row ceiling and quietly under-counting. So
  // both are explicitly capped and the derived figures are labelled for what
  // they now are — a sample, and a floor.
  const RESPONSE_SAMPLE = 500;
  const DONOR_SAMPLE = 5000;
  try {
    const [casesCountRes, resolvedRes, activeCampRes, donationsRes] = await Promise.all([
      supabaseAdmin.from('support_cases').select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('support_cases')
        .select('created_at,updated_at')
        .in('status', ['resolved', 'closed'])
        .order('updated_at', { ascending: false })
        .limit(RESPONSE_SAMPLE),
      supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin
        .from('donations')
        .select('donor_id')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(DONOR_SAMPLE),
    ]);

    // A failed read is NOT zero. Rendering "0 Active Campaigns" on a public
    // page because a query timed out states something false about the platform.
    if (casesCountRes.error || resolvedRes.error || activeCampRes.error || donationsRes.error) {
      return null;
    }

    const resolvedRows = (resolvedRes.data ?? []) as { created_at: string; updated_at: string }[];
    const avgResponseHours = resolvedRows.length > 0
      ? resolvedRows.reduce((sum, row) => sum + (new Date(row.updated_at).getTime() - new Date(row.created_at).getTime()), 0)
        / resolvedRows.length / 3_600_000
      : null;
    const donorsHelped = new Set(((donationsRes.data ?? []) as { donor_id: string | null }[]).map((d) => d.donor_id).filter(Boolean)).size;

    return {
      totalCases: casesCountRes.count,
      resolvedCases: resolvedRows.length,
      avgResponseHours,
      activeCampaigns: activeCampRes.count,
      // A floor, not a total: distinct donors across the most recent
      // DONOR_SAMPLE completed donations. Counting every distinct donor needs a
      // database-side aggregate we do not have, and reading the whole donations
      // table on a public page to fake one is the trade this cap exists to
      // refuse.
      donorsHelped,
    };
  } catch {
    return null;
  }
}

/**
 * Cached: this is public, non-personalised aggregate data, and it was costing a
 * Supabase round-trip on every request. `npm run audit:web-vitals` measured these
 * data-backed pages at 120-600ms TTFB against ~20ms for static ones. 60s matches
 * the homepage and impact layers; the tag allows an explicit bust.
 */
const getContactStats = unstable_cache(getContactStatsUncached, ['public-contact-stats'], { revalidate: 60, tags: ['contact-stats'] });

/** `null` = could not measure. An em-dash, never a confident 0. */
function fmtResponseTime(hours: number | null): string {
  if (hours === null) return '—';
  if (hours <= 0) return '< 24 hrs';
  if (hours < 1) return '< 1 hr';
  if (hours < 24) return `${Math.round(hours)} hrs`;
  return `${Math.round(hours / 24)} days`;
}

/** `null` = could not measure. An em-dash, never a confident 0. */
function fmtCount(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M+`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K+`;
  if (value > 0) return `${value.toLocaleString()}+`;
  return '24/7';
}

export default async function ContactPage() {
  const stats = await getContactStats();

  return (
    <div className="contact-page-v2">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="about-hero contact-hero-v2">
        <div className="about-hero-bg" aria-hidden="true">
          <div className="about-orb about-orb-1" />
          <div className="about-orb about-orb-2" />
          <div className="about-orb about-orb-3" />
          <div className="about-grid-overlay" />
        </div>
        <div className="about-hero-inner">
          <div className="about-hero-badge"><span>✦</span> We&apos;re here to help</div>
          <h1 className="about-hero-h1">
            Let&apos;s start a<br /><em>conversation.</em>
          </h1>
          <p className="about-hero-sub">
            Whether you&apos;re launching a campaign, supporting one, or just have a question — our real, human support
            team (backed by live data) is ready to help you make an impact.
          </p>
          <div className="about-hero-actions">
            <a href="#contact-form" className="about-cta-primary">Send Us a Message ↓</a>
            <Link href="/faq" className="about-cta-ghost">Browse Help Center</Link>
          </div>

          {/* Live stat pills — pulled straight from Supabase */}
          <div className="about-hero-stats">
            <div className="about-stat-pill">
              <span className="about-stat-num">{fmtResponseTime(stats?.avgResponseHours ?? null)}</span>
              <span className="about-stat-label">Avg. Response Time</span>
            </div>
            <div className="about-stat-divider" />
            <div className="about-stat-pill">
              <span className="about-stat-num">{fmtCount(stats?.resolvedCases ?? null)}</span>
              <span className="about-stat-label">Cases Resolved</span>
            </div>
            <div className="about-stat-divider" />
            <div className="about-stat-pill">
              <span className="about-stat-num">{fmtCount(stats?.activeCampaigns ?? null)}</span>
              <span className="about-stat-label">Active Campaigns</span>
            </div>
            <div className="about-stat-divider" />
            <div className="about-stat-pill">
              <span className="about-stat-num">{fmtCount(stats?.donorsHelped ?? null)}</span>
              <span className="about-stat-label">Donors Supported</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT GRID: info + form ────────────────────────────────── */}
      <section className="contact-main-section" id="contact-form">
        <div className="container contact-main-grid">
          <div className="contact-info-col">
            <div className="about-section-label">Get in touch</div>
            <h2 className="about-section-h2" style={{ marginBottom: 28 }}>Real humans. Real answers. <em className="contact-grad-text">Real fast.</em></h2>

            <div className="contact-info-card-v2">
              <div className="contact-info-icon-v2"><Icon name="mail" /></div>
              <div>
                <h3>Email Us</h3>
                <p>hello@charitme.com</p>
                <span>We typically reply within {fmtResponseTime(stats?.avgResponseHours ?? null)}</span>
              </div>
            </div>
            <div className="contact-info-card-v2">
              <div className="contact-info-icon-v2"><Icon name="phone" /></div>
              <div>
                <h3>Call Us</h3>
                <p>+1 (888) 123-4567</p>
                <span>Mon – Fri, 9:00 AM – 6:00 PM (EST)</span>
              </div>
            </div>
            <div className="contact-info-card-v2">
              <div className="contact-info-icon-v2"><Icon name="pin" /></div>
              <div>
                <h3>Our Office</h3>
                <p>123 Impact Way, Suite 400</p>
                <span>San Francisco, CA 94107, USA</span>
              </div>
            </div>
            <div className="contact-info-card-v2">
              <div className="contact-info-icon-v2"><Icon name="clock" /></div>
              <div>
                <h3>Live Support Queue</h3>
                <p>{stats?.totalCases ? `${stats.totalCases.toLocaleString()} conversations handled` : 'Always-on support team'}</p>
                <span>Every message becomes a tracked ticket — nothing falls through the cracks.</span>
              </div>
            </div>
          </div>

          <ContactForm />
        </div>
      </section>

      {/* ── OTHER WAYS TO REACH US ───────────────────────────────────── */}
      <section className="about-section">
        <div className="about-section-inner">
          <div className="about-section-label">More ways to connect</div>
          <h2 className="about-section-h2">However you like to reach out, we&apos;re there.</h2>
          <div className="contact-method-grid-v2">
            {CONTACT_METHODS.map((method) => (
              <Link href={method.href} className="contact-method-v2" key={method.title}>
                <span className="contact-method-icon-v2"><Icon name={method.icon} /></span>
                <strong>{method.title}</strong>
                <p>{method.body}</p>
                <em>{method.action} <Icon name="arrow" /></em>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE IMPACT STRIP ────────────────────────────────────────── */}
      <section className="about-impact-strip">
        <div className="about-impact-inner">
          {[
            { num: fmtResponseTime(stats?.avgResponseHours ?? null), label: 'Average first response',  icon: '⚡' },
            { num: fmtCount(stats?.resolvedCases ?? null),           label: 'Support cases resolved',  icon: '✅' },
            { num: fmtCount(stats?.activeCampaigns ?? null),         label: 'Campaigns we support',    icon: '📣' },
            { num: '0%',                                    label: 'Mandatory platform fee',  icon: '💚' },
          ].map((item) => (
            <div key={item.label} className="about-impact-item">
              <div className="about-impact-icon">{item.icon}</div>
              <div className="about-impact-num">{item.num}</div>
              <div className="about-impact-label">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="about-section about-values-section">
        <div className="about-section-inner">
          <div className="about-section-label">Frequently asked</div>
          <h2 className="about-section-h2">Quick answers before you reach out</h2>
          <div className="contact-faq-grid-v2">
            {FAQS.map(({ q, a }) => (
              <details key={q} className="contact-faq-item-v2">
                <summary>{q}<Icon name="chevron" /></summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
          <Link href="/faq" className="about-cta-primary about-cta-sm" style={{ marginTop: 32 }}>View All FAQs <Icon name="arrow" /></Link>
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────────────────────────── */}
      <section className="about-cta-section">
        <div className="about-cta-bg" aria-hidden="true">
          <div className="about-orb about-orb-cta-1" />
          <div className="about-orb about-orb-cta-2" />
        </div>
        <div className="about-cta-inner">
          <div className="about-hero-badge" style={{ marginBottom: 24 }}><span>✦</span> Still have questions?</div>
          <h2 className="about-cta-h2">We&apos;d love to<br />hear from you.</h2>
          <p className="about-cta-p">No bots, no runaround — just a real team that cares about your cause as much as you do.</p>
          <div className="about-hero-actions" style={{ justifyContent: 'center' }}>
            <a href="#contact-form" className="about-cta-primary about-cta-large">Message Our Team ↓</a>
            <Link href="/help" className="about-cta-ghost about-cta-large">Visit Help Center</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
