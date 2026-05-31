/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { formatCents } from '../../../lib/stripe';
import { calculateTrustScore, getTrustSignals } from '../../../lib/ai-platform';
import DonateButton from './DonateButton';
import ReportButton from './ReportButton';
import DonationSuccess from './DonationSuccess';
import MobileDonateCTA from './MobileDonateCTA';
import CampaignCarousel from './CampaignCarousel';

export const dynamic = 'force-dynamic';

const RENDER_TIME = Date.now();

interface Props {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ donated?: string }>;
}

type Profile = { full_name?: string | null; avatar_url?: string | null };
type CampaignWithImages = { image_urls?: string[] | null };

async function getCampaign(slug: string) {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('*, profiles:user_id (full_name, avatar_url)')
    .eq('slug', slug)
    .single();
  return data;
}

async function getRecentDonations(campaignId: string) {
  const { data } = await supabaseAdmin
    .from('donations')
    .select('id, amount_cents, message, anonymous, created_at, profiles:donor_id(full_name, avatar_url)')
    .eq('campaign_id', campaignId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(6);
  return data ?? [];
}

async function getUpdates(campaignId: string) {
  const { data } = await supabaseAdmin
    .from('campaign_updates')
    .select('id, title, body, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(4);
  return data ?? [];
}

async function getLedger(campaignId: string) {
  const { data } = await supabaseAdmin
    .from('transparency_ledger_items')
    .select('id, item_type, title, amount_cents, category, status, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(4);
  return data ?? [];
}

async function getFAQs(campaignId: string) {
  const { data } = await supabaseAdmin
    .from('campaign_faqs')
    .select('id, question, answer, sort_order')
    .eq('campaign_id', campaignId)
    .eq('is_public', true)
    .order('sort_order', { ascending: true })
    .limit(10);
  return (data ?? []) as { id: string; question: string; answer: string; sort_order: number }[];
}

function asProfile(value: unknown): Profile {
  if (Array.isArray(value)) return (value[0] ?? {}) as Profile;
  return (value ?? {}) as Profile;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getCampaign(slug);
  if (!campaign) return { title: 'Campaign not found' };

  const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';
  const campaignUrl = `${ORIGIN}/campaigns/${slug}`;
  const description = campaign.tagline ?? campaign.description?.slice(0, 160) ?? '';
  const image = campaign.cover_image_url ?? `${ORIGIN}/og-default.png`;

  return {
    title: campaign.title,
    description,
    openGraph: {
      title: campaign.title,
      description,
      url: campaignUrl,
      siteName: 'CharitMe',
      images: [{ url: image, width: 1200, height: 630, alt: campaign.title }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: campaign.title,
      description,
      images: [image],
    },
    alternates: { canonical: campaignUrl },
  };
}

export default async function CampaignPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams ?? Promise.resolve({} as { donated?: string })]);
  const justDonated = sp.donated === '1';
  const campaign = await getCampaign(slug);
  if (!campaign) notFound();

  const [donations, updates, ledger, faqs] = await Promise.all([
    getRecentDonations(campaign.id),
    getUpdates(campaign.id),
    getLedger(campaign.id),
    getFAQs(campaign.id),
  ]);

  const raised = campaign.raised_amount ?? 0;
  const goal = campaign.goal_amount || 1;
  const pct = Math.min(100, Math.round((raised / goal) * 100));
  const trustScore = calculateTrustScore(campaign);
  const trustSignals = getTrustSignals(campaign).slice(0, 5);
  const organizer = asProfile(campaign.profiles);
  const daysLeft: number | null = campaign.deadline
    ? Math.max(0, Math.ceil((new Date(campaign.deadline).getTime() - RENDER_TIME) / 86_400_000))
    : null;
  const isActive = campaign.status === 'active' && (daysLeft === null || daysLeft > 0);
  const cover = campaign.cover_image_url || '/hero-child-crop.png';
  const videoUrl: string | null = (campaign as { video_url?: string | null }).video_url ?? null;
  const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';
  const campaignUrl = `${ORIGIN}/campaigns/${campaign.slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(campaignUrl)}&color=6c35ff&bgcolor=ffffff&margin=10`;

  const rawImageUrls = (campaign as CampaignWithImages).image_urls ?? [];
  const galleryImages: string[] =
    rawImageUrls.length > 0
      ? rawImageUrls
      : campaign.cover_image_url
      ? [campaign.cover_image_url]
      : [];

  // Arc SVG for Impact Tracker donut
  const arcPct = Math.max(5, pct);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (arcPct / 100) * circ;

  return (
    <main className="public-campaign">
      {justDonated && <DonationSuccess />}
      <MobileDonateCTA
        campaignTitle={campaign.title}
        raised={raised}
        goal={goal}
        pct={pct}
        isActive={isActive}
        campaignId={campaign.id}
      />

      {/* ── TOP: title info row ── */}
      <section className="pc-header">
        <nav className="pc-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/campaigns?category=${encodeURIComponent(campaign.category ?? '')}`}>
            {campaign.category ?? 'Campaign'}
          </Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom' }}>
            {campaign.title}
          </span>
        </nav>
        <span className="pc-verified">✓ Verified Campaign</span>
        <h1 className="pc-title-h1">{campaign.title}</h1>
        <p className="pc-organizer">
          Organized by {organizer.full_name ?? 'CharitMe Organizer'}{' '}
          <b>Verified</b> · {campaign.location ?? 'New York, USA'}
        </p>
        <div className="pc-trust">
          <div>
            <strong>{trustScore}</strong><span>/100</span>
            <small>CharitMe Score</small>
          </div>
          {trustSignals.map((signal) => (
            <article key={signal.label}>
              <span>✓</span>
              <b>{signal.label}</b>
              <small>{signal.state}</small>
            </article>
          ))}
        </div>
      </section>

      {/* ── MAIN GRID: carousel+donate (left) | story+impact (right) ── */}
      <section className="pc-grid">
        {/* LEFT column: carousel → donate form */}
        <div className="pc-left">
          {/* Image carousel */}
          <CampaignCarousel images={galleryImages.length > 0 ? galleryImages : [cover]} title={campaign.title} />

          {/* Video embed (if present) */}
          {videoUrl && (() => {
            let embedUrl = videoUrl;
            const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
            if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
            const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
            if (vimeoMatch) embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
            return (
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 14, background: '#000', marginTop: 8 }}>
                <iframe
                  src={embedUrl}
                  title="Campaign video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                />
              </div>
            );
          })()}

          {/* Donate form — right below carousel */}
          <div className="pc-donate">
            <strong className="pc-raised">{formatCents(raised)}</strong>
            <span className="pc-raised-label">raised of {formatCents(goal)} goal</span>
            <div className="pc-progress"><span style={{ width: `${pct}%` }} /></div>
            <div className="pc-statline">
              <span>{campaign.backer_count ?? donations.length} donations</span>
              <span>{daysLeft !== null ? `${daysLeft} days left` : 'No deadline'}</span>
            </div>
            {isActive ? (
              <DonateButton campaignId={campaign.id} campaignTitle={campaign.title} />
            ) : (
              <div className="pc-ended">This campaign has ended.</div>
            )}
            <ReportButton campaignId={campaign.id} />
            <div className="pc-guarantee">
              <b>CharitMe Giving Guarantee</b>
              <span>Your donation is protected and funds go where they are needed most.</span>
            </div>
          </div>
        </div>{/* end pc-left */}

        {/* RIGHT column: story + impact tracker */}
        <div className="pc-right" id="story">
        <article className="pc-story">
          <nav>
            <a href="#story" className="active">Story</a>
            <a href="#updates">Updates ({updates.length})</a>
            <a href="#donations">Donors ({campaign.backer_count ?? donations.length})</a>
            <a href="#impact">Impact</a>
          </nav>

          <h2>{organizer.full_name ? `${organizer.full_name.split(' ')[0]}'s Story` : 'Campaign Story'}</h2>
          <div className="pc-text">{campaign.description}</div>

          {/* Quick Share card */}
          <div className="pc-quick-share">
            <div className="pc-quick-share-header">
              <strong style={{ fontSize: 16, fontWeight: 900, color: 'var(--t1)' }}>Quick share</strong>
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>📱 Share this campaign</span>
            </div>
            <div className="pc-quick-share-qr">
              <div className="pc-quick-share-platforms">
                <div className="pc-share-copy">
                  <input type="text" readOnly value={campaignUrl} aria-label="Campaign URL" />
                  <button
                    type="button"
                    onClick={undefined}
                    style={{}}
                  >
                    Copy
                  </button>
                </div>
                <div className="pc-share-grid">
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(campaignUrl)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="pc-share-tile"
                  >
                    <span className="pc-share-tile-icon" style={{ background: '#e7f0ff', color: '#1877f2' }}>f</span>
                    Facebook
                  </a>
                  <a
                    href={`https://www.facebook.com/dialog/send?link=${encodeURIComponent(campaignUrl)}&app_id=181477038500745`}
                    target="_blank" rel="noopener noreferrer"
                    className="pc-share-tile"
                  >
                    <span className="pc-share-tile-icon" style={{ background: '#e6f3ff', color: '#0084ff' }}>m</span>
                    Messenger
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(campaignUrl)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="pc-share-tile"
                  >
                    <span className="pc-share-tile-icon" style={{ background: '#e8f3fb', color: '#0a66c2' }}>in</span>
                    LinkedIn
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(campaignUrl)}&text=${encodeURIComponent(campaign.title)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="pc-share-tile"
                  >
                    <span className="pc-share-tile-icon" style={{ background: '#f0f0f0', color: '#000' }}>𝕏</span>
                    X / Twitter
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${campaign.title} ${campaignUrl}`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="pc-share-tile"
                  >
                    <span className="pc-share-tile-icon" style={{ background: '#e9fbe9', color: '#25d366' }}>✉</span>
                    WhatsApp
                  </a>
                  <a
                    href={`mailto:?subject=${encodeURIComponent(campaign.title)}&body=${encodeURIComponent(`Please support: ${campaignUrl}`)}`}
                    className="pc-share-tile"
                  >
                    <span className="pc-share-tile-icon" style={{ background: 'var(--s2)', color: 'var(--violet)' }}>@</span>
                    Email
                  </a>
                </div>
                <div style={{ marginTop: 14 }}>
                  <a href={`/api/campaigns/${campaign.id}/qr-poster`} target="_blank"
                    style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', textDecoration: 'none' }}>
                    🖨 Download printable poster →
                  </a>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <img src={qrUrl} alt={`QR code for ${campaign.title}`} width={120} height={120} style={{ borderRadius: 10, border: '1px solid var(--b2)' }} />
                <span style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center' }}>Scan to donate</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="pc-tags">
            <span>{campaign.category ?? 'Campaign'}</span>
            {campaign.trust_status === 'Verified' && <span>Verified</span>}
            {(campaign as { nonprofit_verified?: boolean }).nonprofit_verified && <span>Tax Deductible</span>}
          </div>

          {/* Share bar */}
          <div className="pc-share" style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', marginRight: 4 }}>Share:</span>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(campaignUrl)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: '#1877f2', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
            >Facebook</a>
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(campaignUrl)}&text=${encodeURIComponent(campaign.title)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: '#000', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
            >X / Twitter</a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${campaign.title} ${campaignUrl}`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: '#25d366', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
            >WhatsApp</a>
            <a
              href={`mailto:?subject=${encodeURIComponent(campaign.title)}&body=${encodeURIComponent(`Please support: ${campaignUrl}`)}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: 'var(--s3)', color: 'var(--t1)', fontSize: 12, fontWeight: 700, textDecoration: 'none', border: '1px solid var(--b2)' }}
            >Email</a>
          </div>
        </article>

        {/* RIGHT: Impact Tracker */}
        <aside className="pc-sidebar-right" id="impact">
          <div className="pc-impact-card">
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 900, letterSpacing: '-.02em' }}>Impact Tracker</h2>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--t3)', lineHeight: 1.5 }}>Your generosity is making a difference</p>

            {/* Donut arc SVG */}
            <div className="pc-impact-donut">
              <svg width="130" height="130" viewBox="0 0 130 130" aria-hidden="true">
                <circle cx="65" cy="65" r={r} fill="none" stroke="#ede8ff" strokeWidth="14" />
                <circle
                  cx="65" cy="65" r={r}
                  fill="none"
                  stroke="var(--violet)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ}`}
                  strokeDashoffset={circ * 0.25}
                  style={{ transition: 'stroke-dasharray .6s ease' }}
                />
                <text x="65" y="60" textAnchor="middle" fontSize="20" fontWeight="900" fill="var(--t1)">{pct}%</text>
                <text x="65" y="76" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--t3)">funded</text>
              </svg>
              <p style={{ margin: 0, fontSize: 13, textAlign: 'center', color: 'var(--t2)', fontWeight: 700 }}>
                {formatCents(raised)} raised of {formatCents(goal)}
              </p>
            </div>

            {/* Updates timeline */}
            {updates.length > 0 ? (
              <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
                {updates.map((update) => (
                  <article key={update.id} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 12, alignItems: 'start' }}>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--violet)', boxShadow: '0 0 0 5px #eee8ff', display: 'block', marginTop: 3 }} />
                    <div>
                      <b style={{ fontSize: 14, display: 'block' }}>{update.title}</b>
                      <small style={{ color: 'var(--t3)', fontSize: 12 }}>
                        {new Date(update.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--t3)', padding: '12px 0 0', margin: 0 }}>
                Supporters will receive transparent updates as milestones happen.
              </p>
            )}
          </div>
        </aside>
        </div>{/* end pc-right */}
      </section>{/* end pc-grid */}

      {/* ── BOTTOM CARDS: AI | Donations | Ledger ── */}
      <section className="pc-cards" id="updates">
        <article className="pc-ai">
          <h2>Campaign created with AI</h2>
          <p>CharitMe helps organizers tell their story, reach more people, and maximize impact while keeping trust and transparency visible.</p>
          <ul>
            <li>AI story assistant</li>
            <li>AI outreach plan</li>
            <li>AI growth strategy</li>
          </ul>
        </article>

        <article className="pc-card" id="donations">
          <h2>Recent Donations</h2>
          {donations.map((donation) => {
            const profile = asProfile(donation.profiles);
            return (
              <p key={donation.id}>
                <span>{donation.anonymous ? 'Anonymous' : profile.full_name ?? 'Kind supporter'}</span>
                <b>{formatCents(donation.amount_cents)}</b>
              </p>
            );
          })}
          {donations.length === 0 ? <p><span>Be the first supporter</span><b>{formatCents(0)}</b></p> : null}
        </article>

        <article className="pc-card">
          <h2>Transparency Ledger</h2>
          {ledger.map((item) => (
            <p key={item.id}>
              <span>{item.title}</span>
              <b>{item.amount_cents ? formatCents(item.amount_cents) : item.status}</b>
            </p>
          ))}
          {ledger.length === 0 ? <p><span>Receipts and milestones will appear here.</span><b>Live</b></p> : null}
        </article>
      </section>

      {/* ── FAQ ── */}
      {faqs.length > 0 && (
        <section style={{ maxWidth: 800, margin: '0 auto 40px', padding: '0 24px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 16, color: '#1a1a2e' }}>
            Frequently Asked Questions
          </h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {faqs.map(faq => (
              <details key={faq.id} style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 12, overflow: 'hidden' }}>
                <summary style={{ padding: '16px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer', color: '#1a1a2e', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {faq.question}
                  <span style={{ fontSize: 20, color: '#6c35ff', flexShrink: 0, marginLeft: 12 }}>+</span>
                </summary>
                <div style={{ padding: '4px 20px 18px', fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* ── Trust bar ── */}
      <section className="pc-safe">
        <div><b>Secure donations</b><span>SSL encrypted checkout through Stripe.</span></div>
        <div><b>No mandatory platform fee</b><span>Optional tips keep CharitMe running.</span></div>
        <div><b>24/7 Support</b><span>Trust and safety tools protect every campaign.</span></div>
      </section>
    </main>
  );
}
