'use client';

'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

const CATEGORIES = [
  { id: 'getting-started', label: 'Getting Started', icon: '🚀' },
  { id: 'donations',       label: 'Donations & Payments', icon: '💳' },
  { id: 'payouts',         label: 'Payouts & Bank', icon: '🏦' },
  { id: 'campaigns',       label: 'Campaign Management', icon: '📋' },
  { id: 'trust-safety',    label: 'Trust & Safety', icon: '🛡' },
  { id: 'account',         label: 'Account & Billing', icon: '⚙️' },
] as const;

type Category = typeof CATEGORIES[number]['id'];

type Article = {
  id: string;
  category: Category;
  question: string;
  answer: string;
};

const ARTICLES: Article[] = [
  // Getting Started
  { id: 'gs-1', category: 'getting-started', question: 'How do I start a fundraiser?', answer: 'Click "Get Started" on any page, sign in or create a free account, then follow the 5-step campaign wizard. You can save a draft at any time and publish when ready. AI Copilot can write your title and story automatically.' },
  { id: 'gs-2', category: 'getting-started', question: 'Is it free to create a campaign?', answer: 'Yes. Creating and running a campaign is completely free. CharitMe charges 0% mandatory platform fee. Donors can choose to add an optional support tip (default 8%, changeable to $0) at checkout.' },
  { id: 'gs-3', category: 'getting-started', question: 'How long does it take to set up?', answer: 'Most organizers publish their first campaign in under 10 minutes using the AI Copilot. You need a campaign title, story, goal amount, and at least one photo. Bank verification (for payouts) takes 2–5 minutes via Stripe.' },
  { id: 'gs-4', category: 'getting-started', question: 'Can I fundraise for someone else?', answer: 'Yes. During setup, select who you\'re raising funds for — yourself, a friend, family member, or a nonprofit. You\'ll identify the beneficiary by name and relationship. Payouts go to the bank account you connect via Stripe Connect.' },
  { id: 'gs-5', category: 'getting-started', question: 'What categories can I fundraise for?', answer: 'CharitMe supports Medical, Memorial/Funeral, Emergency, Disaster Relief, Education, Animal/Pet, Community, Nonprofit, Sports/Teams, and more. Choose the category that best fits your need during campaign creation.' },

  // Donations & Payments
  { id: 'don-1', category: 'donations', question: 'What payment methods are accepted?', answer: 'All major credit and debit cards (Visa, Mastercard, Amex, Discover), Apple Pay, Google Pay, and bank transfers in supported countries. All payments are processed by Stripe, a PCI DSS Level 1 certified provider.' },
  { id: 'don-2', category: 'donations', question: 'Can I donate anonymously?', answer: 'Yes. Check "Donate anonymously" at checkout. Your name will not appear in the public donation list, but your donation amount still counts toward the campaign goal.' },
  { id: 'don-3', category: 'donations', question: 'Can I set up recurring monthly donations?', answer: 'Yes. CharitMe supports monthly recurring donations with 0% platform fee — compared to GoFundMe\'s 5% recurring donor fee. Toggle "Give Monthly" on the campaign donate button, then cancel any time from your donor dashboard.' },
  { id: 'don-4', category: 'donations', question: 'What fees does Stripe charge?', answer: 'Stripe charges 2.9% + $0.30 per card transaction (standard US rate). You can optionally check "Cover processing fee" to absorb this so 100% of your stated donation reaches the campaign. CharitMe does not add any markup on top of Stripe fees.' },
  { id: 'don-5', category: 'donations', question: 'Will I get a receipt?', answer: 'Yes. An email receipt is sent automatically after every completed donation. The receipt includes the amount, campaign name, date, and a link to your donor dashboard. Contact support to resend a receipt.' },
  { id: 'don-6', category: 'donations', question: 'Can I cancel my monthly donation?', answer: 'Yes. Go to your donor dashboard → Recurring Donations → Cancel. Cancellation takes effect at the end of the current billing period so you\'re never double-charged.' },

  // Payouts
  { id: 'pay-1', category: 'payouts', question: 'How do I receive my donations?', answer: 'Connect a bank account via Stripe Connect from your campaign dashboard → Connect Bank. Once your identity is verified and payouts are enabled, you can request a payout at any time. Standard payouts arrive in 3–5 business days; same-day and instant payouts are available for eligible verified users.' },
  { id: 'pay-2', category: 'payouts', question: 'What is Stripe Connect verification?', answer: 'Stripe KYC (Know Your Customer) is an identity verification step required by financial regulations. You\'ll provide your legal name, date of birth, address, and last 4 digits of your SSN (US). For businesses, an EIN is required. Verification typically takes 2–5 minutes.' },
  { id: 'pay-3', category: 'payouts', question: 'Is there a payout fee?', answer: 'Standard payouts (3–5 business days) are free. Same-day payouts cost 1.5% of the payout amount (Stripe fee). Instant payouts cost 1.5% (minimum $0.50). CharitMe does not charge additional payout fees.' },
  { id: 'pay-4', category: 'payouts', question: 'Which countries can receive payouts?', answer: 'Payouts are supported in all countries where Stripe Connect Express is available — over 40 countries including the US, UK, Canada, Australia, and most of the EU. Visit stripe.com/global for the full list.' },
  { id: 'pay-5', category: 'payouts', question: 'Can someone else receive the funds?', answer: 'Yes. If you\'re raising funds for a beneficiary, you can set up a separate Stripe Connect account for them to receive funds directly. Contact support to initiate a beneficiary payout transfer.' },

  // Campaign Management
  { id: 'cam-1', category: 'campaigns', question: 'Can I edit my campaign after publishing?', answer: 'Yes. From your dashboard → Campaigns → Edit Campaign. You can update the title, story, goal, media, category, location, and beneficiary details at any time. Changes go live immediately.' },
  { id: 'cam-2', category: 'campaigns', question: 'How do I post an update?', answer: 'Go to Dashboard → Updates → Post Update. Select your campaign, write your update (AI can help draft it), and publish. Donors who\'ve opted in receive email notifications.' },
  { id: 'cam-3', category: 'campaigns', question: 'Can I pause or end my campaign?', answer: 'Yes. From Dashboard → Campaigns → Campaign Detail, use the status dropdown to pause or close your campaign. Paused campaigns stop accepting new donations. Closed campaigns remain visible but show "This campaign has ended."' },
  { id: 'cam-4', category: 'campaigns', question: 'How do I share my campaign?', answer: 'Use the share buttons on your campaign page (Facebook, X/Twitter, WhatsApp, Email) or download a printable QR poster from the campaign page. You can also copy the campaign link directly.' },
  { id: 'cam-5', category: 'campaigns', question: 'Can I add video to my campaign?', answer: 'Yes. When editing your campaign, paste a YouTube or Vimeo URL in the Video URL field. The video will be embedded on your public campaign page.' },

  // Trust & Safety
  { id: 'ts-1', category: 'trust-safety', question: 'What is the CharitMe Trust Score?', answer: 'The Trust Score (0–100) is computed automatically from identity verification, story quality, evidence uploads, fundraising activity, and donor signals. A higher score builds donor confidence. Scores are visible on every campaign page.' },
  { id: 'ts-2', category: 'trust-safety', question: 'How do I report a suspicious campaign?', answer: 'Every campaign page has a "Report Campaign" button. You can report anonymously. Our trust and safety team reviews all reports, typically within 24–48 hours. Verified fraud results in a campaign hold and donor notification.' },
  { id: 'ts-3', category: 'trust-safety', question: 'What is the CharitMe Protection Promise?', answer: 'CharitMe\'s Protection Promise means: (1) fees are always shown before checkout, (2) identity is verified via Stripe KYC before payouts, (3) suspicious campaigns are reviewed and held, (4) we work with Stripe on refunds for verified fraudulent campaigns.' },
  { id: 'ts-4', category: 'trust-safety', question: 'Can I request a refund?', answer: 'Donors can submit refund requests from Dashboard → Request a Refund within 60 days of the donation. Refund decisions depend on the organizer and our review. Verified fraudulent campaigns qualify for refunds regardless of organizer consent.' },

  // Account & Billing
  { id: 'acc-1', category: 'account', question: 'How do I upgrade to Pro?', answer: 'Go to Dashboard → Settings → Billing or visit the Pricing page. Choose Starter or Pro and complete the Stripe checkout. Your plan upgrades instantly. Monthly and annual billing are both available.' },
  { id: 'acc-2', category: 'account', question: 'Can I cancel my subscription?', answer: 'Yes. Dashboard → Settings → Billing → Cancel Subscription. You keep Pro features until the end of your billing period, then revert to Free.' },
  { id: 'acc-3', category: 'account', question: 'How do I change my password?', answer: 'Dashboard → Settings → Security → Change Password. Or use "Forgot Password" on the login page to reset via email.' },
  { id: 'acc-4', category: 'account', question: 'How do I delete my account?', answer: 'Dashboard → Settings → Privacy → Request Account Deletion. Send an email to support@charitme.com from your registered address. We\'ll confirm and process the deletion within 30 days per our privacy policy.' },
];

export default function HelpPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return ARTICLES.filter(a => {
      const matchCat = activeCategory === 'all' || a.category === activeCategory;
      const matchQ = !q || a.question.toLowerCase().includes(q) || a.answer.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [search, activeCategory]);

  return (
    <div className="pub-page simple-public" style={{ maxWidth: 860, margin: '0 auto' }}>
      <section style={{ marginBottom: 40 }}>
        <div className="pub-breadcrumb">Home <span>&gt;</span> <b>Help Center</b></div>
        <h1>Help Center</h1>
        <p>Find answers to common questions about campaigns, donations, payouts, and trust & safety.</p>

        {/* Search */}
        <div style={{ marginTop: 24, position: 'relative', maxWidth: 520 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={18} height={18}
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder="Search help articles…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', paddingLeft: 44, paddingRight: 16, height: 48,
              border: '1.5px solid var(--b2)', borderRadius: 12, fontSize: 15,
              outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>
      </section>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
        <button onClick={() => setActiveCategory('all')}
          style={{
            padding: '7px 16px', borderRadius: 20, border: '1.5px solid',
            borderColor: activeCategory === 'all' ? '#6c35ff' : 'var(--b2)',
            background: activeCategory === 'all' ? '#f0eaff' : '#fff',
            color: activeCategory === 'all' ? '#551cf2' : 'var(--t2)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
          All ({ARTICLES.length})
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
            style={{
              padding: '7px 16px', borderRadius: 20, border: '1.5px solid',
              borderColor: activeCategory === cat.id ? '#6c35ff' : 'var(--b2)',
              background: activeCategory === cat.id ? '#f0eaff' : '#fff',
              color: activeCategory === cat.id ? '#551cf2' : 'var(--t2)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Articles */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--t3)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <p style={{ fontWeight: 700 }}>No articles match your search.</p>
          <p style={{ fontSize: 13, marginTop: 6 }}>Try different keywords or <a href="/contact" style={{ color: '#6c35ff', fontWeight: 700 }}>contact support</a>.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 4 }}>
          {filtered.map(article => (
            <div key={article.id}
              style={{ border: '1px solid var(--b2)', borderRadius: 12, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setOpenId(openId === article.id ? null : article.id)}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 20px', background: openId === article.id ? '#faf8ff' : '#fff',
                  border: 0, cursor: 'pointer', fontSize: 15, fontWeight: 700, textAlign: 'left', color: 'var(--t1)',
                  gap: 16,
                }}>
                <span>{article.question}</span>
                <span style={{ fontSize: 20, flexShrink: 0, color: '#6c35ff', transform: openId === article.id ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }}>+</span>
              </button>
              {openId === article.id && (
                <div style={{ padding: '4px 20px 20px', fontSize: 14, color: 'var(--t2)', lineHeight: 1.7, background: '#faf8ff' }}>
                  {article.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Contact support CTA */}
      <div style={{ marginTop: 48, padding: 28, background: 'linear-gradient(135deg,#f0eaff,#fff)', borderRadius: 16, border: '1px solid #e0d5ff', textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>Still need help?</h2>
        <p style={{ color: 'var(--t3)', fontSize: 14, margin: '0 0 20px' }}>Our support team typically replies within 24 hours.</p>
        <Link href="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: '#6c35ff', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Contact Support →
        </Link>
      </div>
    </div>
  );
}
