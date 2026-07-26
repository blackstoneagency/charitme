import Link from 'next/link';
import { safeJsonLd } from "../../../lib/json-ld";
import { buildCampaignJsonLd } from "../../../lib/campaign-jsonld";
import { notFound } from 'next/navigation';
import { getCampaign } from './get-campaign';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { formatMoneyShort, normalizeCurrency } from '@shared/currencies';
import { resolvePayoutDestination } from '../../../lib/payout-destination';
import { attachCampaignCurrencies } from '../../../lib/home-data';
import { calculateTrustScore, getTrustSignals } from '../../../lib/ai-platform';
import { buildCampaignTrustInput } from '../../../lib/trust-signals';
import DonateButton from './DonateButton';
import JsonLd from '../../../components/JsonLd';
import ReportButton from './ReportButton';
import ShareButtons from './ShareButtons';
import DonationSuccess from './DonationSuccess';
import MobileDonateCTA from './MobileDonateCTA';
import CampaignCarousel from './CampaignCarousel';
import DonorWall, { type WallDonation } from './DonorWall';
import DonationTicker from './DonationTicker';
import Milestones from './Milestones';
import CommentForm from './CommentForm';
import CommentsList, { type WallComment } from './CommentsList';
import SaveCampaignButton from './SaveCampaignButton';
import CampaignAssistant from './CampaignAssistant';
import { getPhotosForCategory, getCoverForCampaign } from '../../../lib/photo-catalog';
import { optimizedCoverUrl } from '../../../lib/img-optimize';
import { optimizeAsks, computeImpact } from '../../../lib/donation-optimizer';

export const dynamic = 'force-dynamic';

const RENDER_TIME = Date.now();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    donated?: string;
    amount?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    share_event_id?: string;
    ref?: string;
  }>;
}

type Profile = { full_name?: string | null; avatar_url?: string | null; show_public_profile?: boolean | null };
type CampaignWithImages = { image_urls?: string[] | null };


async function getRecentDonations(campaignId: string) {
  const { data } = await supabaseAdmin
    .from('donations')
    .select('id, donor_id, amount_cents, message, anonymous, created_at, offline_donor_name, profiles:donor_id(full_name, avatar_url, show_public_profile)')
    .eq('campaign_id', campaignId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(6);
  return data ?? [];
}

async function getUpdates(campaignId: string) {
  // Exclude updates still waiting on their "schedule for later" time —
  // they become visible once published_at is set or scheduled_at has passed.
  const { data } = await supabaseAdmin
    .from('campaign_updates')
    .select('id, title, body, created_at')
    .eq('campaign_id', campaignId)
    .or(`published_at.not.is.null,scheduled_at.lte.${new Date().toISOString()}`)
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

async function getMilestones(campaignId: string) {
  const { data } = await supabaseAdmin
    .from('campaign_milestones')
    .select('id, title, description, target_amount, reached_at, sort_order')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: true });
  return (data ?? []) as { id: string; title: string; description: string | null; target_amount: number | null; reached_at: string | null; sort_order: number }[];
}

async function getRewards(campaignId: string) {
  const { data } = await supabaseAdmin
    .from('campaign_rewards')
    .select('id, title, description, amount_cents, estimated_delivery, item_limit, claimed_count, sort_order')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: true })
    .order('amount_cents', { ascending: true });
  return (data ?? []) as { id: string; title: string; description: string | null; amount_cents: number; estimated_delivery: string | null; item_limit: number | null; claimed_count: number; sort_order: number }[];
}

type SimilarCampaign = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  category: string | null;
  cover_image_url: string | null;
  goal_amount: number;
  raised_amount: number;
  backer_count: number | null;
  currency?: string | null;
};

async function getSimilarCampaigns(campaignId: string, category: string | null): Promise<SimilarCampaign[]> {
  if (!category) return [];
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, tagline, category, cover_image_url, goal_amount, raised_amount, backer_count')
    .eq('category', category)
    .eq('status', 'active')
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .neq('id', campaignId)
    .order('raised_amount', { ascending: false })
    .limit(4);
  return attachCampaignCurrencies((data ?? []) as SimilarCampaign[]);
}

async function getCampaignCurrency(campaignId: string) {
  const { data } = await supabaseAdmin
    .from('campaign_launch_settings')
    .select('currency')
    .eq('campaign_id', campaignId)
    .maybeSingle();
  return normalizeCurrency(data?.currency);
}

function asProfile(value: unknown): Profile {
  if (Array.isArray(value)) return (value[0] ?? {}) as Profile;
  return (value ?? {}) as Profile;
}

type DonationRow = {
  id: string;
  donor_id?: string | null;
  amount_cents: number;
  message: string | null;
  anonymous: boolean;
  created_at: string;
  offline_donor_name?: string | null;
  profiles?: unknown;
};

function toWallDonation(d: DonationRow): WallDonation {
  const profile = asProfile(d.profiles);
  return {
    id: d.id,
    name: d.anonymous ? 'Anonymous' : (profile.full_name || d.offline_donor_name || 'Kind supporter'),
    avatarUrl: d.anonymous ? null : (profile.avatar_url ?? null),
    amountCents: d.amount_cents,
    message: d.message,
    createdAt: d.created_at,
    anonymous: d.anonymous,
    donorId: d.anonymous ? null : (d.donor_id ?? null),
    showPublicProfile: profile.show_public_profile ?? true,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getCampaign(slug);
  if (!campaign) return { title: 'Campaign not found' };

  const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';
  const campaignUrl = `${ORIGIN}/campaigns/${slug}`;
  const description = campaign.tagline ?? campaign.description?.slice(0, 160) ?? '';
  const image = campaign.cover_image_url ?? getCoverForCampaign(campaign.category, campaign.slug);

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
  type SP = NonNullable<Awaited<Props['searchParams']>>;
  const [{ slug }, sp] = await Promise.all([params, searchParams ?? Promise.resolve({} as SP)]);
  const justDonated = sp.donated === '1';
  const donatedAmountCents = sp.amount ? Number.parseInt(sp.amount, 10) : NaN;
  const campaign = await getCampaign(slug);
  if (!campaign) notFound();

  // Logged-in user (used for private-campaign visibility + referral links)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Private campaigns are only visible to the owner and admins
  const visibility = (campaign as { visibility?: string }).visibility ?? 'public';
  if (visibility === 'private') {
    if (!user || user.id !== campaign.user_id) notFound();
  }

  // Personal referral link attribution (?ref=<userId>) — ignore self-referrals
  const referrerId = sp.ref && UUID_RE.test(sp.ref) && sp.ref !== user?.id ? sp.ref : undefined;

  const utm = {
    utmSource:    sp.utm_source,
    utmMedium:    sp.utm_medium,
    utmCampaign:  sp.utm_campaign,
    utmContent:   sp.utm_content,
    shareEventId: sp.share_event_id,
    referrerId,
  };

  const [donations, updates, faqs, donorMessages, milestones, rewards, currency, payoutDestination, trustInput, similarCampaigns] = await Promise.all([
    getRecentDonations(campaign.id),
    getUpdates(campaign.id),
    getFAQs(campaign.id),
    getDonorMessages(campaign.id),
    getMilestones(campaign.id),
    getRewards(campaign.id),
    getCampaignCurrency(campaign.id),
    resolvePayoutDestination(campaign),
    buildCampaignTrustInput(campaign),
    getSimilarCampaigns(campaign.id, campaign.category),
  ]);
  const payoutReady = !!payoutDestination;

  const raised = campaign.raised_amount ?? 0;
  const goal = campaign.goal_amount || 1;
  const pct = Math.min(100, Math.round((raised / goal) * 100));
  const trustScore = calculateTrustScore(trustInput);
  const trustSignals = getTrustSignals(trustInput).slice(0, 5);
  const organizer = asProfile(campaign.profiles);
  const daysLeft: number | null = campaign.deadline
    ? Math.max(0, Math.ceil((new Date(campaign.deadline).getTime() - RENDER_TIME) / 86_400_000))
    : null;
  const acceptDonations = (campaign as { accept_donations?: boolean }).accept_donations !== false;
  const isActive = campaign.status === 'active' && (daysLeft === null || daysLeft > 0) && acceptDonations;
  const cover = campaign.cover_image_url || getCoverForCampaign(campaign.category, campaign.slug);
  const videoUrl: string | null = (campaign as { video_url?: string | null }).video_url ?? null;
  const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';
  const campaignUrl = `${ORIGIN}/campaigns/${campaign.slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(campaignUrl)}&color=6c35ff&bgcolor=ffffff&margin=10`;

  const campaignJsonLd = buildCampaignJsonLd({
    title: campaign.title,
    description: campaign.tagline ?? campaign.description?.slice(0, 200) ?? '',
    url: campaignUrl,
    image: cover,
    organizerName: organizer?.full_name ?? null,
    category: campaign.category ?? null,
    createdAt: (campaign as { created_at?: string | null }).created_at ?? null,
    isActive,
    siteOrigin: ORIGIN,
    nonprofitVerified: (campaign as { nonprofit_verified?: boolean }).nonprofit_verified === true,
  });

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN },
      { '@type': 'ListItem', position: 2, name: campaign.category ?? 'Campaign', item: `${ORIGIN}/campaigns?category=${encodeURIComponent(campaign.category ?? '')}` },
      { '@type': 'ListItem', position: 3, name: campaign.title, item: campaignUrl },
    ],
  };

  const faqJsonLd = faqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  } : null;

  const wallDonations = donations.map(toWallDonation);

  let isSaved = false;
  if (user) {
    const { data: savedRow } = await supabaseAdmin
      .from('saved_campaigns')
      .select('id')
      .eq('user_id', user.id)
      .eq('campaign_id', campaign.id)
      .maybeSingle();
    isSaved = !!savedRow;
  }

  const messageLikeCounts = new Map<string, number>();
  const messageLikedByUser = new Set<string>();
  const messageIds = donorMessages.map((m) => m.id);
  if (messageIds.length > 0) {
    const { data: likes } = await supabaseAdmin
      .from('donor_message_likes')
      .select('donor_message_id, user_id')
      .in('donor_message_id', messageIds);
    for (const like of (likes ?? []) as { donor_message_id: string; user_id: string }[]) {
      messageLikeCounts.set(like.donor_message_id, (messageLikeCounts.get(like.donor_message_id) ?? 0) + 1);
      if (user && like.user_id === user.id) messageLikedByUser.add(like.donor_message_id);
    }
  }

  const repliesByMessage = new Map<string, { id: string; message: string; created_at: string }[]>();
  if (messageIds.length > 0) {
    const { data: replies } = await supabaseAdmin
      .from('campaign_owner_replies')
      .select('id, donor_message_id, message, created_at')
      .in('donor_message_id', messageIds)
      .order('created_at', { ascending: true });
    for (const r of (replies ?? []) as { id: string; donor_message_id: string | null; message: string; created_at: string }[]) {
      if (!r.donor_message_id) continue;
      const bucket = repliesByMessage.get(r.donor_message_id) ?? [];
      bucket.push({ id: r.id, message: r.message, created_at: r.created_at });
      repliesByMessage.set(r.donor_message_id, bucket);
    }
  }

  const initialComments: WallComment[] = donorMessages.map((msg) => {
    const msgProfile = asProfile(msg.profiles);
    return {
      id: msg.id,
      name: msg.anonymous ? 'Anonymous' : (msgProfile.full_name ?? 'Kind supporter'),
      avatarUrl: msg.anonymous ? null : (msgProfile.avatar_url ?? null),
      anonymous: msg.anonymous,
      message: msg.message,
      createdAt: msg.created_at,
      likeCount: messageLikeCounts.get(msg.id) ?? 0,
      likedByUser: messageLikedByUser.has(msg.id),
      replies: (repliesByMessage.get(msg.id) ?? []).map((r) => ({ id: r.id, message: r.message, createdAt: r.created_at })),
    };
  });

  const rawImageUrls = (campaign as CampaignWithImages).image_urls ?? [];
  const galleryImages: string[] =
    rawImageUrls.length >= 4
      ? rawImageUrls
      : getPhotosForCategory(campaign.category, 4);

  // AI Donation Optimizer — campaign-tuned ask amounts + impact projection
  const campaignStats = {
    goalCents: goal,
    raisedCents: raised,
    backerCount: campaign.backer_count ?? donations.length,
    createdAt: campaign.created_at as string,
  };
  const asks = optimizeAsks(campaignStats);
  const impact = computeImpact(campaignStats);

  // Arc SVG for Impact Tracker donut
  const arcPct = Math.max(5, pct);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (arcPct / 100) * circ;

  return (
    <main className="public-campaign">
      <JsonLd json={safeJsonLd(campaignJsonLd)} />
      <JsonLd json={safeJsonLd(breadcrumbJsonLd)} />
      {faqJsonLd && <JsonLd json={safeJsonLd(faqJsonLd)} />}
      {justDonated && (
        <DonationSuccess
          campaignId={campaign.id}
          amountCents={Number.isFinite(donatedAmountCents) && donatedAmountCents > 0 ? donatedAmountCents : undefined}
        />
      )}
      <MobileDonateCTA
        campaignTitle={campaign.title}
        raised={raised}
        goal={goal}
        pct={pct}
        isActive={isActive && payoutReady}
        campaignId={campaign.id}
        currency={currency}
      />

      {/* ── TOP HEADER ── */}
      <section className="pc-header">
        {/* Breadcrumb */}
        <nav className="pc-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/campaigns?category=${encodeURIComponent(campaign.category ?? '')}`}>
            {campaign.category ?? 'Campaign'}
          </Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom' }}>
            {campaign.title}
          </span>
        </nav>

        {/* Verified + category pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="pc-verified">✓ Verified Campaign</span>
          {campaign.category && (
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 12px', borderRadius: 999, background: '#f0eaff', color: 'var(--violet)', fontSize: 12, fontWeight: 650, letterSpacing: '.04em' }}>
              {campaign.category}
            </span>
          )}
          {(campaign as { nonprofit_verified?: boolean }).nonprofit_verified && (
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 12px', borderRadius: 999, background: '#dcfce7', color: '#15803d', fontSize: 12, fontWeight: 650 }}>
              Tax Deductible
            </span>
          )}
        </div>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="pc-title-h1" style={{ margin: 0 }}>{campaign.title}</h1>
          <SaveCampaignButton campaignId={campaign.id} initialSaved={isSaved} isAuthenticated={!!user} loginNext={`/campaigns/${slug}`} />
        </div>

        {/* Organizer row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,var(--violet),var(--violet-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
            {(organizer.full_name ?? 'C')[0]}
          </div>
          <p className="pc-organizer" style={{ margin: 0 }}>
            Organized by <b style={{ color: 'var(--ink)', fontWeight: 650 }}>{organizer.full_name ?? 'CharitMe Organizer'}</b>
            {' '}<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#dcfce7', color: '#15803d', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 650 }}>✓ Verified</span>
            {' '}· {campaign.location ?? 'New York, USA'}
          </p>
        </div>

        {/* Trust score bar — dynamic color-coded chips */}
        <div className="pc-trust-bar">
          {/* CharitScore badge */}
          <div className="pc-charit-score" style={{
            '--score-color': trustScore >= 70 ? '#059669' : trustScore >= 45 ? '#d97706' : '#dc2626',
          } as React.CSSProperties}>
            <div className="pc-charit-score-ring">
              <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
                <circle cx="28" cy="28" r="23" fill="none" stroke="#e8e4fb" strokeWidth="5" />
                <circle
                  cx="28" cy="28" r="23"
                  fill="none"
                  stroke={trustScore >= 70 ? '#059669' : trustScore >= 45 ? '#d97706' : '#dc2626'}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${(trustScore / 100) * 144.5} 144.5`}
                  strokeDashoffset="36"
                  style={{ transition: 'stroke-dasharray .6s ease' }}
                />
                <text x="28" y="32" textAnchor="middle" fontSize="13" fontWeight="900" fill={trustScore >= 70 ? '#059669' : trustScore >= 45 ? '#d97706' : '#dc2626'}>{trustScore}</text>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>CharitMe Score</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: trustScore >= 70 ? '#059669' : trustScore >= 45 ? '#d97706' : '#dc2626' }}>
                {trustScore >= 70 ? 'Strong Trust' : trustScore >= 45 ? 'Needs Attention' : 'Needs Review'}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)', flexShrink: 0 }} />

          {/* Individual trust signals */}
          {trustSignals.map((signal) => {
            const isVerified = signal.state === 'verified';
            const isWatch    = signal.state === 'watch';
            const color  = isVerified ? 'var(--green-dark, #059669)' : isWatch ? '#d97706' : 'var(--t3, #94a3b8)';
            const bg     = isVerified ? 'rgba(22,163,74,.12)'  : isWatch ? 'rgba(217,119,6,.10)' : 'var(--s2, #f1f5f9)';
            const icon   = isVerified ? '✓' : isWatch ? '⚠' : '○';
            return (
              <div key={signal.label} className="pc-trust-signal" title={signal.detail}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {icon}
                </span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 650, color: 'var(--t1)', whiteSpace: 'nowrap' }}>{signal.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{signal.state}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live donation ticker */}
        {wallDonations.length > 0 && (
          <DonationTicker campaignId={campaign.id} initialDonations={wallDonations.slice(0, 10)} currency={currency} />
        )}
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
            <div className="pc-cta-row">
              <a href="#donate-section" className="pc-cta pc-cta-donate">
                Donate
              </a>
              <a href="#quick-share" className="pc-cta pc-cta-share">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
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
              {user ? (
                <a href="#donations" className="pc-org-message">Message</a>
              ) : (
                <Link href={`/login?next=${encodeURIComponent(`/campaigns/${slug}#donations`)}`} className="pc-org-message">Message</Link>
              )}
            </div>
          </div>

          {/* Comments / donor messages */}
          <div className="pc-comments" id="donations">
            <h3 className="pc-section-h3">
              Comments
              <span className="pc-section-count">{donorMessages.length}</span>
            </h3>
            <CommentForm campaignId={campaign.id} isAuthenticated={!!user} loginNext={`/campaigns/${slug}`} />
            <CommentsList
              campaignId={campaign.id}
              initialComments={initialComments}
              isAuthenticated={!!user}
              loginNext={`/campaigns/${slug}`}
            />
          </div>

          {/* Quick Share — client component records share events */}
          <ShareButtons
            campaignId={campaign.id}
            campaignUrl={campaignUrl}
            campaignTitle={campaign.title}
            qrUrl={qrUrl}
            qrPosterId={campaign.id}
          />

        </div>{/* end pc-left */}

        {/* RIGHT column: sticky donation form */}
        <div className="pc-right">
          <div className="pc-donate" id="donate-section">

            {/* "Boost by giving monthly" nudge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--t2)' }}>Boost your impact by giving monthly 🌱</span>
            </div>

            <strong className="pc-raised">{formatMoneyShort(raised, currency)}</strong>
            <span className="pc-raised-label">raised of {formatMoneyShort(goal, currency)} goal</span>
            <div className="pc-progress"><span style={{ width: `${pct}%` }} /></div>
            <div className="pc-statline">
              <span><b style={{ color: 'var(--t1)' }}>{campaign.backer_count ?? donations.length}</b> donations</span>
              <span>{daysLeft !== null ? `${daysLeft} days left` : 'No deadline'}</span>
            </div>

            <Milestones milestones={milestones} raisedCents={raised} currency={currency} />

            {isActive && payoutReady ? (
              <DonateButton
                campaignId={campaign.id}
                campaignTitle={campaign.title}
                utm={utm}
                rewards={rewards}
                currency={currency}
                smartPresets={asks.presets}
                recommendedAmount={asks.recommended}
              />
            ) : isActive && !payoutReady ? (
              <div className="pc-ended">
                💜 Donations open soon — secure payout setup is being completed so 100% of every
                gift goes straight to the recipient&apos;s own bank account. CharitMe never holds funds.
              </div>
            ) : !acceptDonations && campaign.status === 'active' ? (
              <div className="pc-ended">Donations are temporarily paused for this campaign.</div>
            ) : (
              <div className="pc-ended">This campaign has ended.</div>
            )}

            <ReportButton campaignId={campaign.id} />

          </div>
        </div>{/* end pc-right */}

      </section>{/* end pc-grid */}

      {/* ── BOTTOM: AI card + Impact Tracker + Donations + Ledger ── */}
      <section className="pc-cards" id="impact">

        <article className="pc-ai">
          <h2>Campaign created with AI</h2>
          <p>CharitMe helps organizers tell their story, reach more people, and maximize impact while keeping trust and transparency visible.</p>
          <ul>
            <li><Link href="/features" style={{ color: 'var(--pc-ai-link, #4d31c9)', textDecoration: 'none', fontWeight: 650 }}>AI story assistant</Link></li>
            <li><Link href="/features" style={{ color: 'var(--pc-ai-link, #4d31c9)', textDecoration: 'none', fontWeight: 650 }}>AI outreach plan</Link></li>
            <li><Link href="/features" style={{ color: 'var(--pc-ai-link, #4d31c9)', textDecoration: 'none', fontWeight: 650 }}>AI growth strategy</Link></li>
          </ul>
        </article>

        {/* Impact Tracker */}
        <div className="pc-impact-card">
          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, letterSpacing: '-.02em' }}>Impact Tracker</h2>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--t3)', lineHeight: 1.5 }}>Your generosity is making a difference</p>
          <div className="pc-impact-donut">
            <svg width="130" height="130" viewBox="0 0 130 130" aria-hidden="true">
              <circle cx="65" cy="65" r={r} fill="none" stroke="#ede8ff" strokeWidth="14" />
              <circle cx="65" cy="65" r={r} fill="none" stroke="var(--violet)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ * 0.25} style={{ transition: 'stroke-dasharray .6s ease' }} />
              <text x="65" y="60" textAnchor="middle" fontSize="20" fontWeight="900" fill="var(--t1)">{pct}%</text>
              <text x="65" y="76" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--t3)">funded</text>
            </svg>
            <p style={{ margin: 0, fontSize: 13, textAlign: 'center', color: 'var(--t2)', fontWeight: 700 }}>
              {formatMoneyShort(raised, currency)} raised of {formatMoneyShort(goal, currency)}
            </p>
          </div>

          {/* AI Impact Engine — momentum + projection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '12px 0 0', padding: '12px 14px', background: 'rgba(108,53,255,.05)', border: '1px solid rgba(108,53,255,.12)', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--t2)' }}>
              <span style={{ fontWeight: 700 }}>Momentum</span>
              <span style={{ fontWeight: 700, color: impact.momentum === 'surging' ? '#059669' : impact.momentum === 'steady' ? '#6c35ff' : 'var(--t3)' }}>
                {impact.momentum === 'surging' ? '🔥 Surging' : impact.momentum === 'steady' ? '📈 Steady' : '🌱 Just started'}
              </span>
            </div>
            {impact.dailyVelocityCents >= 100 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--t2)' }}>
                <span style={{ fontWeight: 700 }}>Raising per day</span>
                <span style={{ fontWeight: 700, color: 'var(--t1)' }}>~{formatMoneyShort(impact.dailyVelocityCents, currency)}</span>
              </div>
            )}
            {impact.projectedDaysToGoal !== null && impact.projectedDaysToGoal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--t2)' }}>
                <span style={{ fontWeight: 700 }}>On pace to hit goal in</span>
                <span style={{ fontWeight: 700, color: '#059669' }}>~{impact.projectedDaysToGoal} day{impact.projectedDaysToGoal === 1 ? '' : 's'}</span>
              </div>
            )}
            {impact.projectedDaysToGoal === 0 && (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#059669', textAlign: 'center' }}>🎉 Goal reached!</div>
            )}
          </div>
          {updates.length > 0 ? (
            <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
              {updates.slice(0, 3).map((update) => (
                <article key={update.id} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 12, alignItems: 'start' }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--violet)', boxShadow: '0 0 0 5px var(--s2, #eee8ff)', display: 'block', marginTop: 3 }} />
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

        <DonorWall campaignId={campaign.id} initialDonations={wallDonations} totalCount={campaign.backer_count ?? donations.length} currency={currency} />

      </section>

      {/* ── Similar campaigns ── */}
      {similarCampaigns.length > 0 && (
        <section style={{ maxWidth: 1100, margin: '0 auto 40px', padding: '0 24px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, color: 'var(--t1, #1a1a2e)' }}>
            Similar Campaigns
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
            {similarCampaigns.map((c) => {
              const sPct = c.goal_amount > 0 ? Math.min(100, Math.round((c.raised_amount / c.goal_amount) * 100)) : 0;
              return (
                <Link key={c.id} href={`/campaigns/${c.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ border: '1px solid var(--b1, #f1f5f9)', borderRadius: 12, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--s1, #fff)' }}>
                    <div style={{
                      height: 130, background: `url(${optimizedCoverUrl(c.cover_image_url || getCoverForCampaign(c.category, c.slug), 420)}) center/cover`,
                    }} />
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      {c.category && <span style={{ fontSize: 11, fontWeight: 800, color: '#6c35ff', textTransform: 'uppercase', letterSpacing: 0.4 }}>{c.category}</span>}
                      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--t1, #1a1a2e)', lineHeight: 1.3 }}>{c.title}</div>
                      {c.tagline && (
                        <div style={{ fontSize: 12, color: 'var(--t3, #94a3b8)', lineHeight: 1.4 }}>
                          {c.tagline.slice(0, 80)}{c.tagline.length > 80 ? '…' : ''}
                        </div>
                      )}
                      <div style={{ marginTop: 'auto' }}>
                        <div style={{ background: 'var(--s3, #f1f5f9)', borderRadius: 99, height: 6, overflow: 'hidden', marginBottom: 6 }}>
                          <div style={{ height: '100%', width: `${sPct}%`, background: 'var(--green, #19b86a)', borderRadius: 99 }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <strong style={{ color: 'var(--t1, #1a1a2e)' }}>{formatMoneyShort(c.raised_amount, c.currency ?? 'usd')}</strong>
                          <span style={{ color: 'var(--t3, #94a3b8)' }}>{sPct}% funded</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── FAQ + AI assistant ── */}
      <section style={{ maxWidth: 800, margin: '0 auto 40px', padding: '0 24px' }}>
        {faqs.length > 0 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, color: 'var(--t1, #1a1a2e)' }}>
              Frequently Asked Questions
            </h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {faqs.map(faq => (
                <details key={faq.id} style={{ background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 12, overflow: 'hidden' }}>
                  <summary style={{ padding: '16px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer', color: 'var(--t1, #1a1a2e)', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {faq.question}
                    <span style={{ fontSize: 20, color: 'var(--violet, #6c35ff)', flexShrink: 0, marginLeft: 12 }}>+</span>
                  </summary>
                  <div style={{ padding: '4px 20px 18px', fontSize: 14, color: 'var(--t3, #64748b)', lineHeight: 1.7 }}>
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </>
        )}
        <CampaignAssistant campaignId={campaign.id} />
      </section>

      {/* ── Trust bar ── */}
      <section className="pc-safe">
        <div><b>Secure donations</b><span>SSL encrypted checkout through Stripe.</span></div>
        <div><b>No mandatory platform fee</b><span>Optional tips keep CharitMe running.</span></div>
        <div><b>24/7 Support</b><span>Trust and safety tools protect every campaign.</span></div>
      </section>
    </main>
  );
}
