import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Supported Countries',
  description: 'See which countries can create campaigns and receive donations on CharitMe. Fundraise from 20+ countries and accept donations from 70+ countries worldwide.',
  alternates: { canonical: 'https://www.charitme.com/supported-countries' },
};

type Country = {
  id: string;
  name: string;
  flag_emoji: string;
  iso_code: string;
  can_fundraise: boolean;
  can_donate: boolean;
  currency_code: string;
  notes: string | null;
};

async function getCountries() {
  const { data } = await supabaseAdmin
    .from('supported_countries')
    .select('id,name,flag_emoji,iso_code,can_fundraise,can_donate,currency_code,notes')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  return (data ?? []) as Country[];
}

export default async function SupportedCountriesPage() {
  const all = await getCountries();
  const fundraisers = all.filter(c => c.can_fundraise);
  const donorsOnly  = all.filter(c => c.can_donate && !c.can_fundraise);

  return (
    <div className="sc-page">

      {/* ── Hero ── */}
      <section className="sc-hero">
        <div className="sc-hero-glow" />
        <div className="sc-hero-inner">
          <div className="sc-breadcrumb">
            <Link href="/">Home</Link>
            <span>›</span>
            <b>Supported Countries</b>
          </div>
          <div className="sc-hero-badge">🌍 Global Reach</div>
          <h1>Where CharitMe Works</h1>
          <p>
            CharitMe supports fundraisers in <strong>{fundraisers.length} countries</strong> and
            accepts donations from <strong>{all.length} countries</strong> worldwide.
            Whether you&apos;re launching a campaign or supporting a cause, CharitMe connects you globally.
          </p>
          <div className="sc-hero-stats">
            <div className="sc-stat">
              <span>{fundraisers.length}</span>
              <span className="sc-stat-cap">Countries can fundraise</span>
            </div>
            <div className="sc-stat-div" />
            <div className="sc-stat">
              <span>{all.length}</span>
              <span className="sc-stat-cap">Countries can donate</span>
            </div>
            <div className="sc-stat-div" />
            <div className="sc-stat">
              <span>0%</span>
              <span className="sc-stat-cap">Platform fee</span>
            </div>
          </div>
          <div className="sc-hero-actions">
            <Link href="/create/choose-path" className="sc-btn-primary">Start Fundraising →</Link>
            <Link href="/campaigns" className="sc-btn-secondary">Browse Campaigns</Link>
          </div>
        </div>
      </section>

      <div className="sc-content">

        {/* ── Can Fundraise ── */}
        <section className="sc-section">
          <div className="sc-section-header">
            <div className="sc-section-icon sc-icon-green">✦</div>
            <div>
              <h2>Countries That Can Organize Campaigns</h2>
              <p>Residents of these {fundraisers.length} countries can create campaigns, collect donations, and receive payouts directly to their bank account.</p>
            </div>
          </div>
          <div className="sc-country-grid">
            {fundraisers.map(c => (
              <div key={c.id} className="sc-country-card sc-can-fundraise">
                <span className="sc-flag">{c.flag_emoji}</span>
                <div className="sc-country-info">
                  <strong>{c.name}</strong>
                  <span>{c.currency_code}</span>
                </div>
                <span className="sc-badge sc-badge-green">Fundraise + Donate</span>
                {c.notes && <p className="sc-notes">{c.notes}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* ── Donate Only ── */}
        <section className="sc-section">
          <div className="sc-section-header">
            <div className="sc-section-icon sc-icon-blue">♦</div>
            <div>
              <h2>Countries That Can Donate</h2>
              <p>Residents of these {donorsOnly.length} countries can discover and donate to any active campaign. Campaign organization is not yet available in these regions.</p>
            </div>
          </div>
          <div className="sc-country-grid sc-donors-grid">
            {donorsOnly.map(c => (
              <div key={c.id} className="sc-country-card sc-donate-only">
                <span className="sc-flag">{c.flag_emoji}</span>
                <div className="sc-country-info">
                  <strong>{c.name}</strong>
                  <span>{c.currency_code}</span>
                </div>
                <span className="sc-badge sc-badge-blue">Donate only</span>
                {c.notes && <p className="sc-notes">{c.notes}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* ── Info boxes ── */}
        <section className="sc-info-grid">
          <div className="sc-info-card">
            <div className="sc-info-icon">💳</div>
            <h3>Accepted Payment Methods</h3>
            <p>CharitMe accepts Visa, Mastercard, American Express, and Apple Pay. Available payment methods may vary by country.</p>
          </div>
          <div className="sc-info-card">
            <div className="sc-info-icon">🏦</div>
            <h3>Receiving Payouts</h3>
            <p>Fundraisers in supported countries can connect their bank account via Stripe Connect for direct deposits within 2–5 business days.</p>
          </div>
          <div className="sc-info-card">
            <div className="sc-info-icon">🔒</div>
            <h3>Secure &amp; Trusted</h3>
            <p>All donations are processed with bank-level encryption. CharitMe charges 0% platform fee — only standard Stripe processing fees apply.</p>
          </div>
          <div className="sc-info-card">
            <div className="sc-info-icon">📧</div>
            <h3>Not Seeing Your Country?</h3>
            <p>We&apos;re expanding regularly. Contact us and we&apos;ll notify you as soon as your country is supported for fundraising.</p>
            <Link href="mailto:support@charitme.com" className="sc-info-link">Contact Support →</Link>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="sc-cta">
          <div className="sc-cta-glow" />
          <div className="sc-cta-inner">
            <h2>Ready to make a difference?</h2>
            <p>Join thousands of fundraisers using CharitMe to raise money for causes that matter.</p>
            <Link href="/create/choose-path" className="sc-btn-primary sc-btn-lg">Start Your Campaign →</Link>
          </div>
        </section>

      </div>
    </div>
  );
}
