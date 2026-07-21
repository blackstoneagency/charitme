import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'CharitMe combines compassionate design, AI-powered guidance, and radical transparency to help every cause reach its full potential.',
  alternates: { canonical: 'https://www.charitme.com/about-us' },
};

export const dynamic = 'force-dynamic';

async function getLiveStats() {
  try {
    const [donRes, campRes, donorRes] = await Promise.all([
      supabaseAdmin.from('donations').select('amount_cents').eq('status', 'completed'),
      supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('donations').select('donor_id').eq('status', 'completed'),
    ]);
    const totalRaised  = ((donRes.data ?? []) as { amount_cents: number }[]).reduce((s, d) => s + d.amount_cents, 0);
    const activeCamps  = campRes.count ?? 0;
    const uniqueDonors = new Set(((donorRes.data ?? []) as { donor_id: string }[]).map(d => d.donor_id)).size;
    return { totalRaised, activeCamps, uniqueDonors };
  } catch {
    return { totalRaised: 0, activeCamps: 0, uniqueDonors: 0 };
  }
}

function fmtBig(cents: number) {
  const d = cents / 100;
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M+`;
  if (d >= 1_000)     return `$${Math.round(d / 1_000)}K+`;
  return `$${Math.round(d).toLocaleString()}`;
}

export default async function AboutUsPage() {
  const stats = await getLiveStats();

  const coreValues = [
    {
      emoji: '🔒',
      title: 'Radical Transparency',
      body: 'Every fee, every transaction, every dollar is visible — donors and organizers see exactly where money goes.',
      color: '#7c3aed',
      bg: '#f5f3ff',
    },
    {
      emoji: '🤖',
      title: 'AI with Empathy',
      body: 'Our AI doesn\'t replace human connection — it amplifies it. Better stories, smarter reach, deeper impact.',
      color: '#0ea5e9',
      bg: '#f0f9ff',
    },
    {
      emoji: '💚',
      title: 'Zero Mandatory Fees',
      body: 'We charge $0 platform fees. We\'re sustained by donors who choose to tip — proving giving can be generous all the way down.',
      color: '#059669',
      bg: '#ecfdf5',
    },
    {
      emoji: '🛡️',
      title: 'Trust by Design',
      body: 'AI-powered verification, real-time trust scores, and fraud prevention built into every campaign from day one.',
      color: '#dc2626',
      bg: '#fef2f2',
    },
    {
      emoji: '🌍',
      title: 'Built for Everyone',
      body: 'From a family facing a medical crisis to a nonprofit scaling globally — one platform built for every kind of cause.',
      color: '#d97706',
      bg: '#fffbeb',
    },
    {
      emoji: '⚡',
      title: 'Speed to Impact',
      body: 'Create a campaign in minutes. Get paid in days. No waiting, no bureaucracy — just real results for real people.',
      color: '#6c35ff',
      bg: '#f5f0ff',
    },
  ];

  const milestones = [
    { year: '2022', title: 'The Idea', body: 'Founded by fundraising veterans who saw donors losing trust in opaque platforms charging hidden fees.' },
    { year: '2023', title: 'Built in Public', body: 'Launched in beta with radical transparency. Every feature shipped openly, every dollar tracked live.' },
    { year: '2024', title: 'AI Fundraising', body: 'Became the first fundraising platform with an AI coach built for emotional storytelling and donor re-engagement.' },
    { year: '2025', title: 'Scale', body: 'Thousands of campaigns, millions raised, zero mandatory platform fees — proving the model works for everyone.' },
    { year: '2026', title: 'The Future', body: 'Expanding globally, deepening AI capabilities, and building the most trusted giving ecosystem on earth.' },
  ];

  const teamValues = [
    { icon: '🧠', label: 'Move with intention' },
    { icon: '❤️', label: 'Care deeply' },
    { icon: '🔍', label: 'Default to transparency' },
    { icon: '🚀', label: 'Ship, then improve' },
    { icon: '🤝', label: 'Earn every dollar' },
    { icon: '🌱', label: 'Long-term thinking' },
  ];

  return (
    <div className="about-page">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="about-hero">
        <div className="about-hero-bg" aria-hidden="true">
          <div className="about-orb about-orb-1" />
          <div className="about-orb about-orb-2" />
          <div className="about-orb about-orb-3" />
          <div className="about-grid-overlay" />
        </div>
        <div className="about-hero-inner">
          <div className="about-hero-badge">
            <span>✦</span> Our Mission
          </div>
          <h1 className="about-hero-h1">
            Fundraising that<br />
            <em>thinks for you.</em>
          </h1>
          <p className="about-hero-sub">
            We built CharitMe because every cause deserves world-class tools — not just the ones with the biggest budgets.
            <br />AI-powered. Radically transparent. Zero mandatory fees.
          </p>
          <div className="about-hero-actions">
            <Link href="/create/choose-path" className="about-cta-primary">Start Your Campaign →</Link>
            <Link href="/success-stories" className="about-cta-ghost">See Real Stories</Link>
          </div>

          {/* Live stat pills */}
          <div className="about-hero-stats">
            <div className="about-stat-pill">
              <span className="about-stat-num">{stats.activeCamps.toLocaleString()}</span>
              <span className="about-stat-label">Active Campaigns</span>
            </div>
            <div className="about-stat-divider" />
            <div className="about-stat-pill">
              <span className="about-stat-num">{fmtBig(stats.totalRaised)}</span>
              <span className="about-stat-label">Total Raised</span>
            </div>
            <div className="about-stat-divider" />
            <div className="about-stat-pill">
              <span className="about-stat-num">{stats.uniqueDonors.toLocaleString()}</span>
              <span className="about-stat-label">Donors Worldwide</span>
            </div>
            <div className="about-stat-divider" />
            <div className="about-stat-pill">
              <span className="about-stat-num">0%</span>
              <span className="about-stat-label">Platform Fee</span>
            </div>
          </div>
        </div>
        <div className="about-hero-scroll-hint" aria-hidden="true">↓ scroll</div>
      </section>

      {/* ── MANIFESTO ────────────────────────────────────────────────── */}
      <section className="about-manifesto">
        <div className="about-manifesto-inner">
          <div className="about-manifesto-label">Why we exist</div>
          <blockquote className="about-manifesto-quote">
            &ldquo;Giving should feel good — not complicated. We believe every family, every nonprofit, every dreamer deserves the same powerful tools that used to be reserved for the privileged few.&rdquo;
          </blockquote>
          <div className="about-manifesto-attr">
            <div className="about-manifesto-avatar">C</div>
            <div>
              <strong>CharitMe Founding Team</strong>
              <span>Built by fundraisers, for fundraisers</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORE VALUES ──────────────────────────────────────────────── */}
      <section className="about-section about-values-section">
        <div className="about-section-inner">
          <div className="about-section-label">What we stand for</div>
          <h2 className="about-section-h2">Six principles that drive everything we build</h2>
          <div className="about-values-grid">
            {coreValues.map((v) => (
              <div key={v.title} className="about-value-card" style={{ '--accent': v.color, '--accent-bg': v.bg } as React.CSSProperties}>
                <div className="about-value-emoji">{v.emoji}</div>
                <h3 className="about-value-title">{v.title}</h3>
                <p className="about-value-body">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SPLIT FEATURE ────────────────────────────────────────────── */}
      <section className="about-split">
        <div className="about-split-inner">
          <div className="about-split-visual">
            <div className="about-visual-card about-visual-card-1">
              <div className="about-visual-icon">🤖</div>
              <div>
                <strong>AI Growth Engine</strong>
                <span>Working 24/7 on your campaign</span>
              </div>
            </div>
            <div className="about-visual-card about-visual-card-2">
              <div className="about-visual-icon">📈</div>
              <div>
                <strong>+47% avg. reach increase</strong>
                <span>vs. campaigns without AI assist</span>
              </div>
            </div>
            <div className="about-visual-card about-visual-card-3">
              <div className="about-visual-icon">✅</div>
              <div>
                <strong>Trust Score: 94</strong>
                <span>Identity verified · Story verified</span>
              </div>
            </div>
            <div className="about-visual-ring" />
          </div>
          <div className="about-split-copy">
            <div className="about-section-label">AI + Humanity</div>
            <h2 className="about-split-h2">The first platform where AI works <em>for</em> the fundraiser, not against them</h2>
            <p className="about-split-p">
              Our AI coach writes with your voice, not instead of it. It analyzes your story, suggests improvements based on thousands of successful campaigns, and helps donors feel the urgency behind every cause.
            </p>
            <ul className="about-split-list">
              <li><span>✓</span> AI-generated story drafts that you own and edit</li>
              <li><span>✓</span> Donor re-engagement suggestions based on behavior</li>
              <li><span>✓</span> Real-time trust scoring to build donor confidence</li>
              <li><span>✓</span> Smart social sharing with campaign-specific messaging</li>
            </ul>
            <Link href="/ai-fundraising" className="about-cta-primary about-cta-sm">Explore AI Fundraising →</Link>
          </div>
        </div>
      </section>

      {/* ── TIMELINE ─────────────────────────────────────────────────── */}
      <section className="about-section about-timeline-section">
        <div className="about-section-inner">
          <div className="about-section-label">Our journey</div>
          <h2 className="about-section-h2">From idea to impact</h2>
          <div className="about-timeline">
            {milestones.map((m, i) => (
              <div key={m.year} className={`about-timeline-item ${i % 2 === 0 ? 'left' : 'right'}`}>
                <div className="about-timeline-year">{m.year}</div>
                <div className="about-timeline-dot" />
                <div className="about-timeline-content">
                  <h3>{m.title}</h3>
                  <p>{m.body}</p>
                </div>
              </div>
            ))}
            <div className="about-timeline-line" />
          </div>
        </div>
      </section>

      {/* ── IMPACT STRIP ─────────────────────────────────────────────── */}
      <section className="about-impact-strip">
        <div className="about-impact-inner">
          {[
            { num: fmtBig(stats.totalRaised), label: 'Raised for real causes', icon: '💰' },
            { num: '0%',   label: 'Mandatory platform fee',      icon: '🎯' },
            { num: '< 5m', label: 'To launch a campaign',        icon: '⚡' },
            { num: '99%',  label: 'Uptime SLA',                  icon: '🔒' },
          ].map((item) => (
            <div key={item.label} className="about-impact-item">
              <div className="about-impact-icon">{item.icon}</div>
              <div className="about-impact-num">{item.num}</div>
              <div className="about-impact-label">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW WE WORK ──────────────────────────────────────────────── */}
      <section className="about-section">
        <div className="about-section-inner">
          <div className="about-section-label">Our culture</div>
          <h2 className="about-section-h2">How we work every day</h2>
          <p className="about-section-sub">
            We&apos;re a small, focused team obsessed with one goal: make giving easier, smarter, and more trustworthy than it&apos;s ever been.
          </p>
          <div className="about-culture-grid">
            {teamValues.map((t) => (
              <div key={t.label} className="about-culture-item">
                <span className="about-culture-icon">{t.icon}</span>
                <span className="about-culture-label">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL ──────────────────────────────────────────────── */}
      <section className="about-testimonial-section">
        <div className="about-testimonial-inner">
          <div className="about-testimonial-stars">★★★★★</div>
          <blockquote className="about-testimonial-quote">
            &ldquo;CharitMe helped us raise more in 30 days than we had in the entire previous year — and every donor could see exactly where their money was going. The trust score alone doubled our conversion rate.&rdquo;
          </blockquote>
          <div className="about-testimonial-attr">
            <div className="about-testimonial-avatar">M</div>
            <div>
              <strong>Maria T.</strong>
              <span>Nonprofit Director, Community Health Fund</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────────────────────────── */}
      <section className="about-cta-section">
        <div className="about-cta-bg" aria-hidden="true">
          <div className="about-orb about-orb-cta-1" />
          <div className="about-orb about-orb-cta-2" />
        </div>
        <div className="about-cta-inner">
          <div className="about-hero-badge" style={{ marginBottom: 24 }}>
            <span>✦</span> Join the movement
          </div>
          <h2 className="about-cta-h2">
            Every great cause<br />starts with one step.
          </h2>
          <p className="about-cta-p">
            Start your campaign in minutes. No fees. No friction. Just tools that work as hard as you do.
          </p>
          <div className="about-hero-actions" style={{ justifyContent: 'center' }}>
            <Link href="/create/choose-path" className="about-cta-primary about-cta-large">Create Your Campaign →</Link>
            <Link href="/contact" className="about-cta-ghost about-cta-large">Talk to Us</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
