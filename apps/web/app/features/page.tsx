import Link from 'next/link';
import { getFeatureCoverage, PLATFORM_MODULES } from '../../lib/feature-catalog';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Platform Features — CharitMe',
  description: 'Every table-stakes fundraising feature plus an AI trust layer competitors do not have. Campaigns, memberships, nonprofits, events, creator commerce and more.',
};

const MODULE_ICONS: Record<string, string> = {
  'fundraising-core':     '💜',
  'projects-perks':       '🚀',
  'memberships':          '♻️',
  'nonprofit-crm':        '🏛️',
  'events-ticketing':     '🎟️',
  'creator-commerce':     '🎨',
  'ai-trust-growth':      '🤖',
  'analytics-reporting':  '📊',
  'auctions':             '🔨',
};

const COMPETITOR_COLORS: Record<string, string> = {
  GoFundMe:   '#19b86a',
  Kickstarter:'#2bde73',
  Indiegogo:  '#eb1478',
  Patreon:    '#ff424d',
  Eventbrite: '#f05537',
  Shopify:    '#96bf48',
};

export default function FeaturesPage() {
  const coverage = getFeatureCoverage();

  return (
    <div style={{ background: '#f8f7ff', minHeight: '100vh' }}>

      {/* ── Hero ── */}
      <section style={{
        background: 'linear-gradient(135deg, #0e0520 0%, #1a0640 50%, #0e0520 100%)',
        padding: '80px 0 72px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: -120, left: '10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,53,255,.35) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, right: '5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(180,59,239,.25) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(108,53,255,.25)', border: '1px solid rgba(108,53,255,.4)', borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 800, color: '#b89eff', letterSpacing: '.1em', textTransform: 'uppercase' }}>
              ✦ Platform Coverage
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(32px, 5vw, 58px)', fontWeight: 950, color: '#fff', lineHeight: 1.12, maxWidth: 760, margin: '0 0 20px' }}>
            Every feature your donors expect,<br />
            <span style={{ background: 'linear-gradient(90deg, #a78bfa, #e879f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>plus AI trust no one else has.</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 18, lineHeight: 1.7, maxWidth: 620, margin: '0 0 40px' }}>
            CharitMe combines campaign fundraising, recurring memberships, nonprofit CRM, creator commerce,
            events, auctions, and AI-powered trust in one production-ready platform — with 0% mandatory platform fees.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 56 }}>
            <Link href="/create" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 52, padding: '0 28px', borderRadius: 14, background: 'linear-gradient(135deg,#6736ff,#d63ae7)', color: '#fff', fontWeight: 900, fontSize: 15, textDecoration: 'none', boxShadow: '0 16px 32px rgba(103,54,255,.4)' }}>
              Start Free →
            </Link>
            <Link href="/campaigns" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 52, padding: '0 28px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,.2)', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none', background: 'rgba(255,255,255,.07)' }}>
              Browse Campaigns
            </Link>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {[
              { value: coverage.moduleCount, label: 'Product modules' },
              { value: coverage.featureCount, label: 'Mapped features' },
              { value: '0%', label: 'Mandatory platform fee' },
              { value: coverage.competitors.length, label: 'Competitors mapped' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: '18px 24px', minWidth: 130 }}>
                <div style={{ fontSize: 32, fontWeight: 950, color: '#fff', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.5)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why CharitMe Wins section ── */}
      <section style={{ background: '#fff', borderBottom: '1px solid #ede9fe', padding: '64px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#6c35ff', textTransform: 'uppercase', letterSpacing: '.12em' }}>Why CharitMe</span>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,40px)', fontWeight: 950, color: '#0e0520', margin: '10px 0 14px' }}>Built different from the ground up</h2>
            <p style={{ color: '#64748b', fontSize: 16, maxWidth: 540, margin: '0 auto' }}>Not a clone. A rethink — AI trust scores, 0% fees, beneficiary routing, and real-time fraud detection baked in.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {[
              { icon: '🛡️', title: 'AI Trust Score', desc: 'Every campaign gets a live CharitScore — risk signals, identity checks, and evidence reviewed by AI.' },
              { icon: '💸', title: '0% Platform Fee', desc: 'Donors cover optional tips. We never take a cut of what was raised.' },
              { icon: '⚡', title: 'Instant Payouts', desc: 'Connected Stripe accounts receive funds directly via destination charges.' },
              { icon: '🌍', title: '18 Categories', desc: 'Medical, emergency, education, animal, environment, faith, and 12 more — all fully supported.' },
              { icon: '🤖', title: 'AI Fundraising Suite', desc: 'AI writes your story, optimises your ask, and suggests next actions in real time.' },
              { icon: '🔒', title: 'Built-in Compliance', desc: 'GDPR-ready, RLS on every table, fraud queues, dispute handling, and immutable ledger.' },
            ].map(f => (
              <div key={f.title} style={{ background: 'linear-gradient(145deg,#faf8ff,#f3f0ff)', border: '1px solid #ede9fe', borderRadius: 18, padding: '28px 24px' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0e0520', marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Module grid ── */}
      <section style={{ padding: '72px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#6c35ff', textTransform: 'uppercase', letterSpacing: '.12em' }}>Platform Modules</span>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,40px)', fontWeight: 950, color: '#0e0520', margin: '10px 0 14px' }}>Everything in one platform</h2>
            <p style={{ color: '#64748b', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>Each module is production-ready and connected to a shared ledger, donor graph, and trust layer.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {PLATFORM_MODULES.map((module) => (
              <Link
                key={module.slug}
                href={`/features/${module.slug}`}
                style={{ textDecoration: 'none' }}
              >
                <div className="feat-card">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#f3f0ff,#ede9fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                      {MODULE_ICONS[module.slug] ?? '✦'}
                    </div>
                    <span style={{ background: module.status === 'Live' ? '#dcfce7' : '#f3f0ff', color: module.status === 'Live' ? '#15803d' : '#6c35ff', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {module.status}
                    </span>
                  </div>

                  <p style={{ fontSize: 11, fontWeight: 800, color: '#6c35ff', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>{module.eyebrow}</p>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0e0520', margin: '0 0 10px', lineHeight: 1.3 }}>{module.title}</h3>
                  <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65, margin: '0 0 18px', flex: 1 }}>{module.summary}</p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                    {module.features.slice(0, 5).map((feature) => (
                      <span key={`${module.slug}-${feature.name}`} style={{ background: '#f8f7ff', border: '1px solid #ede9fe', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#5b21b6' }}>
                        {feature.name}
                      </span>
                    ))}
                    {module.features.length > 5 && (
                      <span style={{ background: '#f8f7ff', border: '1px solid #ede9fe', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
                        +{module.features.length - 5} more
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: '#6c35ff' }}>
                    Open module
                    <span style={{ fontSize: 16 }}>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Competitor coverage ── */}
      <section style={{ background: '#fff', borderTop: '1px solid #ede9fe', padding: '72px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#6c35ff', textTransform: 'uppercase', letterSpacing: '.12em' }}>Competitive Coverage</span>
            <h2 style={{ fontSize: 'clamp(24px,3.5vw,40px)', fontWeight: 950, color: '#0e0520', margin: '10px 0 14px' }}>We mapped every competitor</h2>
            <p style={{ color: '#64748b', fontSize: 16, maxWidth: 480, margin: '0 auto' }}>CharitMe has feature parity with all major platforms — and beats them on trust and transparency.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, maxWidth: 900, margin: '0 auto' }}>
            {coverage.competitors.map((competitor) => {
              const accent = COMPETITOR_COLORS[competitor.name] ?? '#6c35ff';
              return (
                <div key={competitor.name} style={{ background: '#fafafa', border: '1.5px solid #f1f5f9', borderRadius: 16, padding: '20px 20px 18px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: '16px 16px 0 0' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: 900, color: '#0e0520' }}>{competitor.name}</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 950, color: '#0e0520', lineHeight: 1 }}>{competitor.count}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 600 }}>required features covered</div>
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#19b86a' }}>
                    <span>✓</span> Full parity
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section style={{
        background: 'linear-gradient(135deg, #0e0520 0%, #1a0640 100%)',
        padding: '80px 0',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(108,53,255,.3) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(26px,4vw,46px)', fontWeight: 950, color: '#fff', margin: '0 0 16px' }}>
            Ready to raise more, faster?
          </h2>
          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 17, margin: '0 0 36px' }}>
            Join thousands of fundraisers who trust CharitMe&apos;s AI-powered platform.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 14 }}>
            <Link href="/create" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 54, padding: '0 32px', borderRadius: 15, background: 'linear-gradient(135deg,#6736ff,#d63ae7)', color: '#fff', fontWeight: 900, fontSize: 16, textDecoration: 'none', boxShadow: '0 16px 40px rgba(103,54,255,.45)' }}>
              Start Your Fundraiser Free →
            </Link>
            <Link href="/campaigns" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 54, padding: '0 32px', borderRadius: 15, border: '1.5px solid rgba(255,255,255,.2)', color: '#fff', fontWeight: 800, fontSize: 16, textDecoration: 'none', background: 'rgba(255,255,255,.07)' }}>
              Browse Campaigns
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
