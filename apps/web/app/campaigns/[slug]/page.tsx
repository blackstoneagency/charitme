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
import { getPhotosForCategory, getCoverForCategory } from '../../../lib/photo-catalog';

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

async function getDonorMessages(campaignId: string) {
  const { data } = await supabaseAdmin
    .from('donor_messages')
    .select('id, message, anonymous, created_at, profiles:donor_id(full_name, avatar_url)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(8);
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

  const [donations, updates, ledger, faqs, donorMessages] = await Promise.all([
    getRecentDonations(campaign.id),
    getUpdates(campaign.id),
    getLedger(campaign.id),
    getFAQs(campaign.id),
    getDonorMessages(campaign.id),
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
  const cover = campaign.cover_image_url || getCoverForCategory(campaign.category);
  const videoUrl: string | null = (campaign as { video_url?: string | null }).video_url ?? null;
  const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';
  const campaignUrl = `${ORIGIN}/campaigns/${campaign.slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(campaignUrl)}&color=6c35ff&bgcolor=ffffff&margin=10`;

  const rawImageUrls = (campaign as CampaignWithImages).image_urls ?? [];
  const galleryImages: string[] =
    rawImageUrls.length >= 4
      ? rawImageUrls
      : getPhotosForCategory(campaign.category, 4);

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

      {/* ── TOP HEADER ── */}
      <section className="pc-header">
        <nav className="pc-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/campaigns?category=${encodeURIComponent(campaign.category ?? '')}`}>
            {campaign.category ?? 'Campaign'}
          </Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom' }}>
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

      {/* ── MAIN GRID: story content (left) | sticky donate sidebar (right) ── */}
      <section className="pc-grid">

        {/* LEFT column: carousel → story → co-organizers → comments → share */}
        <div className="pc-left" id="story">

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
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 14, background: '#000' }}>
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

          {/* Story card with tabs */}
          <article className="pc-story">
            <nav>
              <a href="#story" className="active">Story</a>
              <a href="#updates">Updates ({updates.length})</a>
              <a href="#donations">Donors ({campaign.backer_count ?? donations.length})</a>
              <a href="#impact">Impact</a>
            </nav>

            <h2>{organizer.full_name ? `${organizer.full_name.split(' ')[0]}’s Story` : 'Campaign Story'}</h2>
            <div className="pc-text">{campaign.description}</div>

            {/* Tags */}
            <div className="pc-tags" style={{ marginTop: 22 }}>
              <span>{campaign.category ?? 'Campaign'}</span>
              {campaign.trust_status === 'Verified' && <span>Verified</span>}
              {(campaign as { nonprofit_verified?: boolean }).nonprofit_verified && <span>Tax Deductible</span>}
            </div>

            {/* Donate + Share buttons inline */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <a href="#donate-section" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 12, background: 'linear-gradient(135deg,var(--violet),var(--violet-2))', color: '#fff', fontWeight: 900, fontSize: 15, textDecoration: 'none' }}>
                Donate
              </a>
              <a
                href="#quick-share"
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 12, border: '1.5px solid var(--b2)', color: 'var(--t1)', fontWeight: 800, fontSize: 15, textDecoration: 'none', background: '#fff', gap: 6 }}
              >
                Share
              </a>
            </div>
          </article>

          {/* Co-organizers */}
          <div className="pc-organizers" id="updates">
            <h3 className="pc-section-h3">
              Co-organizers
              <span className="pc-section-count">{1}</span>
            </h3>
            <div className="pc-org-card">
              <div className="pc-org-avatar" style={{ backgroundImage: organizer.avatar_url ? `url(${organizer.avatar_url})` : undefined }}>
                {!organizer.avatar_url && (organizer.full_name?.[0] ?? 'C')}
              </div>
              <div className="pc-org-info">
                <b>{organizer.full_name ?? 'CharitMe Organizer'}</b>
                <small>Organizer · {campaign.location ?? 'New York, USA'}</small>
              </div>
              <Link href="/login" className="pc-org-message">Message</Link>
            </div>
          </div>

          {/* Comments / donor messages */}
          <div className="pc-comments" id="donations">
            <h3 className="pc-section-h3">
              Comments
              <span className="pc-section-count">{donorMessages.length}</span>
            </h3>
            {donorMessages.length > 0 ? (
              <div className="pc-comment-list">
                {donorMessages.map((msg) => {
                  const msgProfile = asProfile(msg.profiles);
                  const initials = (msg.anonymous ? 'A' : (msgProfile.full_name?.[0] ?? 'D'));
                  return (
                    <div key={msg.id} className="pc-comment">
                      <div className="pc-comment-avatar" style={{ backgroundImage: (!msg.anonymous && msgProfile.avatar_url) ? `url(${msgProfile.avatar_url})` : undefined }}>
                        {(msg.anonymous || !msgProfile.avatar_url) && initials}
                      </div>
                      <div className="pc-comment-body">
                        <div className="pc-comment-name">
                          {msg.anonymous ? 'Anonymous' : (msgProfile.full_name ?? 'Kind supporter')}
                          <span className="pc-comment-date">
                            {new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <div className="pc-comment-text">&#x2665;&nbsp;1 &nbsp;&middot;&nbsp; {msg.message}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--t3)', margin: 0 }}>
                Please sign in and donate to comment.
              </p>
            )}
          </div>

          {/* Quick Share */}
          <div id="quick-share" className="pc-quick-share">
            <div className="pc-quick-share-header">
              <strong style={{ fontSize: 16, fontWeight: 900, color: 'var(--t1)' }}>Quick share</strong>
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>📱 Share this campaign</span>
            </div>
            <div className="pc-quick-share-qr">
              <div className="pc-quick-share-platforms">
                <div className="pc-share-copy">
                  <input type="text" readOnly value={campaignUrl} aria-label="Campaign URL" />
                  <button type="button">Copy</button>
                </div>
                <div className="pc-share-grid">
                  <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(campaignUrl)}`} target="_blank" rel="noopener noreferrer" className="pc-share-tile">
                    <span className="pc-share-tile-icon" style={{ background: '#e7f0ff', color: '#1877f2' }}>f</span>Facebook
                  </a>
                  <a href={`https://www.facebook.com/dialog/send?link=${encodeURIComponent(campaignUrl)}&app_id=181477038500745`} target="_blank" rel="noopener noreferrer" className="pc-share-tile">
                    <span className="pc-share-tile-icon" style={{ background: '#e6f3ff', color: '#0084ff' }}>m</span>Messenger
                  </a>
                  <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(campaignUrl)}`} target="_blank" rel="noopener noreferrer" className="pc-share-tile">
                    <span className="pc-share-tile-icon" style={{ background: '#e8f3fb', color: '#0a66c2' }}>in</span>LinkedIn
                  </a>
                  <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(campaignUrl)}&text=${encodeURIComponent(campaign.title)}`} target="_blank" rel="noopener noreferrer" className="pc-share-tile">
                    <span className="pc-share-tile-icon" style={{ background: '#f0f0f0', color: '#000' }}>&#120143;</span>X / Twitter
                  </a>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`${campaign.title} ${campaignUrl}`)}`} target="_blank" rel="noopener noreferrer" className="pc-share-tile">
                    <span className="pc-share-tile-icon" style={{ background: '#e9fbe9', color: '#25d366' }}>&#10003;</span>WhatsApp
                  </a>
                  <a href={`mailto:?subject=${encodeURIComponent(campaign.title)}&body=${encodeURIComponent(`Please support: ${campaignUrl}`)}`} className="pc-share-tile">
                    <span className="pc-share-tile-icon" style={{ background: 'var(--s2)', color: 'var(--violet)' }}>@</span>Email
                  </a>
                </div>
                <div style={{ marginTop: 14 }}>
                  <a href={`/api/campaigns/${campaign.id}/qr-poster`} target="_blank" style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', textDecoration: 'none' }}>
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

        </div>{/* end pc-left */}

        {/* RIGHT column: sticky donation form */}
        <div className="pc-right">
          <div className="pc-donate" id="donate-section">

            {/* "Boost by giving monthly" nudge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--t2)' }}>Boost your impact by giving monthly 🌱</span>
            </div>

            <strong className="pc-raised">{formatCents(raised)}</strong>
            <span className="pc-raised-label">raised of {formatCents(goal)} goal</span>
            <div className="pc-progress"><span style={{ width: `${pct}%` }} /></div>
            <div className="pc-statline">
              <span><b style={{ color: 'var(--t1)' }}>{campaign.backer_count ?? donations.length}</b> donations</span>
              <span>{daysLeft !== null ? `${daysLeft} days left` : 'No deadline'}</span>
            </div>

            {isActive ? (
              <DonateButton campaignId={campaign.id} campaignTitle={campaign.title} />
            ) : (
              <div className="pc-ended">This campaign has ended.</div>
            )}

            <ReportButton campaignId={campaign.id} />

            {/* Protection guarantee */}
            <div className="pc-guarantee">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>🛡️</span>
                <div>
                  <b>CharitMe protects your donation</b>
                  <span>We guarantee a full refund for up to a year in the rare case that fraud occurs. See the CharitMe Giving Guarantee.</span>
                </div>
              </div>
            </div>

          </div>
        </div>{/* end pc-right */}

      </section>{/* end pc-grid */}

      {/* ── BOTTOM: AI card + Impact Tracker + Donations + Ledger ── */}
      <section className="pc-cards" id="impact">

        <article className="pc-ai">
          <h2>Campaign created with AI</h2>
          <p>CharitMe helps organizers tell their story, reach more people, and maximize impact while keeping trust and transparency visible.</p>
          <ul>
            <li><Link href="/features" style={{ color: '#4d31c9', textDecoration: 'none', fontWeight: 850 }}>AI story assistant</Link></li>
            <li><Link href="/features" style={{ color: '#4d31c9', textDecoration: 'none', fontWeight: 850 }}>AI outreach plan</Link></li>
            <li><Link href="/features" style={{ color: '#4d31c9', textDecoration: 'none', fontWeight: 850 }}>AI growth strategy</Link></li>
          </ul>
        </article>

        {/* Impact Tracker */}
        <div className="pc-impact-card">
          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 900, letterSpacing: '-.02em' }}>Impact Tracker</h2>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--t3)', lineHeight: 1.5 }}>Your generosity is making a difference</p>
          <div className="pc-impact-donut">
            <svg width="130" height="130" viewBox="0 0 130 130" aria-hidden="true">
              <circle cx="65" cy="65" r={r} fill="none" stroke="#ede8ff" strokeWidth="14" />
              <circle cx="65" cy="65" r={r} fill="none" stroke="var(--violet)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ * 0.25} style={{ transition: 'stroke-dasharray .6s ease' }} />
              <text x="65" y="60" textAnchor="middle" fontSize="20" fontWeight="900" fill="var(--t1)">{pct}%</text>
              <text x="65" y="76" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--t3)">funded</text>
            </svg>
            <p style={{ margin: 0, fontSize: 13, textAlign: 'center', color: 'var(--t2)', fontWeight: 700 }}>
              {formatCents(raised)} raised of {formatCents(goal)}
            </p>
          </div>
          {updates.length > 0 ? (
            <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
              {updates.slice(0, 3).map((update) => (
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
              We are almost there! Keep sharing.
            </p>
          )}
        </div>

        <article className="pc-card">
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
