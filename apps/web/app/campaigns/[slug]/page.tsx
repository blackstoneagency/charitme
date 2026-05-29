/* eslint-disable @next/next/no-img-element */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { formatCents } from '../../../lib/stripe';
import { calculateTrustScore, getTrustSignals } from '../../../lib/ai-platform';
import DonateButton from './DonateButton';
import ReportButton from './ReportButton';

export const dynamic = 'force-dynamic';

const RENDER_TIME = Date.now();

interface Props {
  params: Promise<{ slug: string }>;
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

function asProfile(value: unknown): Profile {
  if (Array.isArray(value)) return (value[0] ?? {}) as Profile;
  return (value ?? {}) as Profile;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getCampaign(slug);
  if (!campaign) return { title: 'Campaign not found' };
  return {
    title: campaign.title,
    description: campaign.tagline ?? campaign.description?.slice(0, 160),
  };
}

export default async function CampaignPage({ params }: Props) {
  const { slug } = await params;
  const campaign = await getCampaign(slug);
  if (!campaign) notFound();

  const [donations, updates, ledger] = await Promise.all([
    getRecentDonations(campaign.id),
    getUpdates(campaign.id),
    getLedger(campaign.id),
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

  // Real uploaded images: use image_urls array if present, else fall back to cover only
  const rawImageUrls = (campaign as CampaignWithImages).image_urls ?? [];
  const galleryImages: string[] =
    rawImageUrls.length > 0
      ? rawImageUrls
      : campaign.cover_image_url
      ? [campaign.cover_image_url]
      : [];

  return (
    <main className="public-campaign">
      <section className="pc-grid">
        <div className="pc-title">
          <div className="pc-breadcrumb">Home / {campaign.category ?? 'Campaign'} / {campaign.title}</div>
          <span className="pc-verified">Verified Campaign</span>
          <h1>{campaign.title}</h1>
          <p>Organized by {organizer.full_name ?? 'KindFund Organizer'} <b>Verified</b> · {campaign.location ?? 'New York, USA'}</p>
          <div className="pc-trust">
            <div><strong>{trustScore}</strong><span>/100</span><small>KindFund Trust Score</small></div>
            {trustSignals.map((signal) => (
              <article key={signal.label}>
                <span>✓</span>
                <b>{signal.label}</b>
                <small>{signal.state}</small>
              </article>
            ))}
          </div>
        </div>

        <div className="pc-media">
          <img src={cover} alt={campaign.title} />
          {galleryImages.length > 1 && (
            <div>
              {galleryImages.map((src, index) => (
                <img key={`${src}-${index}`} src={src} alt="" />
              ))}
            </div>
          )}
        </div>

        <aside className="pc-donate">
          <div className="pc-total">
            <strong>{formatCents(raised)}</strong>
            <span>raised of {formatCents(goal)} goal</span>
            <em>{pct}%</em>
          </div>
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
          <div className="pc-guarantee"><b>KindFund Giving Guarantee</b><span>Your donation is protected and funds go where they are needed most.</span></div>
        </aside>
      </section>

      <section className="pc-body" id="story">
        <article className="pc-story">
          <nav>
            <a href="#story" className="active">Story</a>
            <a href="#updates">Updates ({updates.length})</a>
            <a href="#donations">Donors ({campaign.backer_count ?? donations.length})</a>
            <a href="#impact">Impact</a>
          </nav>
          <h2>{organizer.full_name ? `${organizer.full_name.split(' ')[0]}'s Story` : 'Campaign Story'}</h2>
          <div className="pc-text">{campaign.description}</div>
          <div className="pc-tags">
            <span>{campaign.category ?? 'Campaign'}</span>
            {campaign.trust_status === 'Verified' && <span>Verified</span>}
            {(campaign as { nonprofit_verified?: boolean }).nonprofit_verified && <span>Tax Deductible</span>}
          </div>
          {/* Share bar */}
          <div className="pc-share" style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', marginRight: 4 }}>Share:</span>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://www.eli54u.com/campaigns/${campaign.slug}`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: '#1877f2', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
            >
              Facebook
            </a>
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(`https://www.eli54u.com/campaigns/${campaign.slug}`)}&text=${encodeURIComponent(campaign.title)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: '#000', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
            >
              X / Twitter
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${campaign.title} https://www.eli54u.com/campaigns/${campaign.slug}`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: '#25d366', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
            >
              WhatsApp
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent(campaign.title)}&body=${encodeURIComponent(`Please support: https://www.eli54u.com/campaigns/${campaign.slug}`)}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: 'var(--s3)', color: 'var(--t1)', fontSize: 12, fontWeight: 700, textDecoration: 'none', border: '1px solid var(--b2)' }}
            >
              Email
            </a>
          </div>
        </article>

        <aside className="pc-impact" id="impact">
          <h2>Impact Tracker</h2>
          {updates.length > 0 ? updates.map((update) => (
            <article key={update.id}>
              <span />
              <div><b>{update.title}</b><small>{new Date(update.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small></div>
            </article>
          )) : (
            <p style={{ fontSize: 13, color: 'var(--t3)', padding: '12px 0' }}>
              Supporters will receive transparent updates as milestones happen.
            </p>
          )}
        </aside>
      </section>

      <section className="pc-cards" id="updates">
        <article className="pc-ai">
          <h2>Campaign created with AI</h2>
          <p>KindFund helps organizers tell their story, reach more people, and maximize impact while keeping trust and transparency visible.</p>
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
              <p key={donation.id}><span>{donation.anonymous ? 'Anonymous' : profile.full_name ?? 'Kind supporter'}</span><b>{formatCents(donation.amount_cents)}</b></p>
            );
          })}
          {donations.length === 0 ? <p><span>Be the first supporter</span><b>{formatCents(0)}</b></p> : null}
        </article>

        <article className="pc-card">
          <h2>Transparency Ledger</h2>
          {ledger.map((item) => <p key={item.id}><span>{item.title}</span><b>{item.amount_cents ? formatCents(item.amount_cents) : item.status}</b></p>)}
          {ledger.length === 0 ? <p><span>Receipts and milestones will appear here.</span><b>Live</b></p> : null}
        </article>
      </section>

      <section className="pc-safe">
        <div><b>Secure donations</b><span>SSL encrypted checkout through Stripe.</span></div>
        <div><b>No mandatory platform fee</b><span>Optional tips keep KindFund running.</span></div>
        <div><b>24/7 Support</b><span>Trust and safety tools protect every campaign.</span></div>
      </section>
    </main>
  );
}
