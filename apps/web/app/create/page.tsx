'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { validateBuilderStep, type BuilderField } from '../../lib/builder-validation';
import {
  CAMPAIGN_DRAFT_KEY,
  buildDraft,
  serializeDraft,
  parseDraft,
  draftHasContent,
  draftAgeLabel,
  campaignMediaStoragePath,
  fromRemoteDraft,
  pickFreshestDraft,
  describePublishFailure,
  type CampaignDraft,
} from '../../lib/campaign-draft';
import { WIZARD_STEPS, normalizeStep, minutesRemaining, isOptionalStep, type WizardStep } from '../../lib/wizard-steps';
import { CAMPAIGN_STEPS, CAMPAIGN_STEP_META, canGoBack, nextIncompleteStepAfter, stepPosition } from '../../lib/campaign-flow-core';
import {
  parseDraftRewards,
  summarizeRewardSync,
  toRewardPayloads,
  validateDraftRewards,
  type DraftReward,
  type RewardFieldError,
} from '../../lib/campaign-rewards-draft';
import StepRewards from './StepRewards';
import StepVerify from './StepVerify';
import CampaignPlanEditor from './CampaignPlanEditor';
import CampaignSettingsEditor from './CampaignSettingsEditor';
import CampaignPathChoice from './CampaignPathChoice';
import { evaluateDonorView } from '../../lib/donor-preview';
import { parseCampaignVideoUrl } from '../../lib/campaign-video';

/** A pristine wizard form — also what "start another campaign" resets to (F8). */
const EMPTY_FORM: FormState = {
  category: 'Medical',
  forSelf: '',
  country: 'United States',
  zipCode: '',
  autoGoal: 'false',
  title: '',
  tagline: '',
  goal: '',
  deadline: '',
  beneficiaryName: '',
  beneficiaryRelationship: '',
  description: '',
  coverImageUrl: '',
  videoUrl: '',
  campaignPath: 'personal',
  rewardsJson: '',
  currency: 'USD',
  useOfFundsJson: '',
  donationTiersJson: '',
  faqsJson: '',
  milestonesJson: '',
  sourceLinksJson: '',
  sourceDocumentsJson: '',
  recurringEnabled: 'true',
  anonymousEnabled: 'true',
  visibility: 'public',
  acceptDonations: 'true',
  seoTitle: '',
  seoDescription: '',
  socialTitle: '',
  socialDescription: '',
  coverImageGuidance: '',
  policyAccepted: 'false',
  aiPrompt: '',
};

/** Which of the organizer's drafts this browser is currently editing (F8). */
const ACTIVE_DRAFT_KEY = 'charitme-active-draft-id';

interface DraftSummary {
  id: string;
  title: string | null;
  step: string;
  updated_at: string;
  imageCount: number;
}
import { suggestCampaignTitle } from '../../lib/campaign-title';
import Link from 'next/link';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { currencySymbol, formatMoneyShort, SUPPORTED_CURRENCIES } from '@shared/currencies';
import { extractCampaignFields } from '../../lib/campaign-intake';
import { CharitMeShell, KFIcon } from '../../components/CharitMeApp';
import { createClient } from '../../lib/supabase-browser';
import AiFollowUps from './AiFollowUps';
import ReadinessChecklist from './ReadinessChecklist';
import GoalProceedsBreakdown from './GoalProceedsBreakdown';
import StorySectionsEditor from './StorySectionsEditor';
import { publishReadiness, type ReadinessStep } from '../../lib/campaign-readiness';
import FeatureUpsell from './FeatureUpsell';
import { analyzeStory } from '../../lib/story-analysis';
import {
  CAMPAIGN_BUILDER_SCHEMA_VERSION,
  parseCampaignFaqs,
  parseCampaignMilestones,
  parseDonationTiers,
  parseSourceDocuments,
  parseSourceLinks,
  parseUseOfFunds,
  stringifyBuilderItems,
  totalUseOfFunds,
  validateCampaignBuilderSettings,
  type CampaignBuilderPath,
} from '../../lib/campaign-builder-model';
import {
  AI_INTAKE_SESSION_KEY,
  clearCachedAiIntakeFiles,
  loadCachedAiIntakeFiles,
  parseAiCampaignIntake,
} from '../../lib/campaign-ai-intake';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type PayoutAccount = {
  id: string;
  stripe_account_id: string;
  payouts_enabled: boolean;
  charges_enabled: boolean;
  details_submitted: boolean;
  verification_status: string;
};

interface FormState {
  category: string;
  forSelf: string;      // 'true' | 'false'
  country: string;
  zipCode: string;
  autoGoal: string;     // 'true' | 'false'
  title: string;
  tagline: string;
  goal: string;
  deadline: string;
  beneficiaryName: string;
  beneficiaryRelationship: string;
  description: string;
  coverImageUrl: string;
  videoUrl: string;
  /** 'personal' | 'nonprofit' | 'team'. Controls the required verification path. */
  campaignPath: string;
  /**
   * Optional rewards, JSON-encoded.
   *
   * ⚠️ Stored as a string INSIDE the form rather than as its own draft field on
   * purpose. `CampaignDraft.form` is persisted verbatim to localStorage and to
   * `campaign_wizard_drafts.form` (jsonb), so keeping rewards here means drafted
   * rewards survive a refresh and a device switch with no change to the draft
   * parser, the draft API or the table. `parseDraft` only copies fields it knows
   * about, so a new top-level key would have been silently dropped on restore —
   * losing work the organizer had typed.
   */
  rewardsJson: string;
  currency: string;
  useOfFundsJson: string;
  donationTiersJson: string;
  faqsJson: string;
  milestonesJson: string;
  sourceLinksJson: string;
  sourceDocumentsJson: string;
  recurringEnabled: string;
  anonymousEnabled: string;
  visibility: string;
  acceptDonations: string;
  seoTitle: string;
  seoDescription: string;
  socialTitle: string;
  socialDescription: string;
  coverImageGuidance: string;
  policyAccepted: string;
  aiPrompt: string;
}

function normalizeForm(value: Partial<FormState> | null | undefined): FormState {
  return { ...EMPTY_FORM, ...(value ?? {}) };
}

type UploadStatus = 'uploading' | 'done' | 'error';

interface UploadedImage {
  id: string;
  url: string;
  name: string;
  status: UploadStatus;
  errorMsg?: string;
}

type AiCampaignDraftResponse = {
  title?: string;
  summary?: string;
  story?: string;
  category?: string;
  suggestedGoalCents?: number;
  useOfFunds?: { label: string; amountCents: number }[];
  socialCaption?: string;
  longPost?: string;
  donorFaq?: { question: string; answer: string }[];
  donationTiers?: { amountCents: number; label: string }[];
  milestones?: { title: string; description: string; targetCents: number }[];
  seoTitle?: string;
  seoDescription?: string;
  coverImageGuidance?: string;
};

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const JOURNEY_STEPS = ['Plan', 'Create', 'Launch', 'Manage', 'Celebrate', 'Impact'];

/**
 * Where an unauthenticated organizer is asked to sign in.
 *
 * The principle here was already right and is kept verbatim: ask **only when the
 * product genuinely cannot proceed**. What changed is that there is no longer a
 * STEP that triggers it. There were two problems with pinning it to a step:
 *
 *  1. The step it was pinned to (`goal`) comes AFTER `media` in the flow, and
 *     media is the step that actually needs a session — it posts to
 *     /api/upload/campaign-image, which 401s. So the gate sat one step too late
 *     for the only thing it was protecting. That was invisible while
 *     `middleware.ts` redirected every signed-out visitor away from /create;
 *     opening the builder to guests is what made it reachable.
   *  2. Authentication happens at the upload action, after the organizer has
   *     already entered enough context for the saved draft to survive sign-in.
 *
 * So the two moments that genuinely need a session ask for one themselves:
 * uploading a file (below, in `handleFileSelect`) and publishing (the campaign
 * needs an owner). Everything else a guest can do freely, and the draft survives
 * sign-in via localStorage + `campaign_wizard_drafts`, so nothing is lost.
 */

const ALLOWED_IMG_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
]);
const MAX_IMG_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES   = 10;

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France',
  'Netherlands', 'Ireland', 'New Zealand', 'Belgium', 'Austria', 'Switzerland',
  'Sweden', 'Norway', 'Denmark', 'Finland', 'Spain', 'Italy', 'Portugal',
  'Japan', 'Singapore', 'Hong Kong SAR', 'Other',
];

const _CATEGORY_META: Record<string, { icon: string; tone: string; desc: string }> = {
  Medical:     { icon: 'heart',  tone: 'violet', desc: 'Surgery, treatment, recovery' },
  Memorial:    { icon: 'gift',   tone: 'violet', desc: 'Final expenses, tribute' },
  Emergency:   { icon: 'shield', tone: 'orange', desc: 'Crisis, urgent need' },
  Nonprofit:   { icon: 'users',  tone: 'blue',   desc: 'Organizations & causes' },
  Education:   { icon: 'doc',    tone: 'blue',   desc: 'School, tuition, scholarships' },
  Animal:      { icon: 'heart',  tone: 'green',  desc: 'Vet care, rescue, shelter' },
  Environment: { icon: 'send',   tone: 'green',  desc: 'Conservation & sustainability' },
  Business:    { icon: 'stack',  tone: 'orange', desc: 'Startups & small business' },
  Community:   { icon: 'users',  tone: 'green',  desc: 'Events, local projects' },
  Competition: { icon: 'crown',  tone: 'orange', desc: 'Sports, athletics, contests' },
  Creative:    { icon: 'doc',    tone: 'violet', desc: 'Art, film, music, design' },
  Event:       { icon: 'bell',   tone: 'blue',   desc: 'Concerts, galas, gatherings' },
  Faith:       { icon: 'heart',  tone: 'violet', desc: 'Church, mission, spiritual' },
  Family:      { icon: 'users',  tone: 'green',  desc: 'Family needs & milestones' },
  Sports:      { icon: 'team',   tone: 'orange', desc: 'Teams, travel, gear' },
  Travel:      { icon: 'send',   tone: 'blue',   desc: 'Trips, missions, adventures' },
  Volunteer:   { icon: 'check',  tone: 'green',  desc: 'Service & community impact' },
  Wishes:      { icon: 'gift',   tone: 'violet', desc: 'Dreams, gifts, celebrations' },
};

/**
 * Photo prompts per campaign category.
 *
 * Covers **every** entry in `CAMPAIGN_CATEGORIES`. It previously listed only
 * Medical/Emergency/Education/Animal, so 14 of the 18 categories fell through to
 * the generic `default` — a Memorial or Sports organizer was told to add a
 * "Campaign hero image" while a Medical one got real guidance. CLAUDE.md flags
 * hand-maintained copies of this list as a known drift trap (three had already
 * diverged); `__tests__/campaign-suggested-photos.test.ts` now fails if a category
 * is added to the shared list without prompts here.
 */
const SUGGESTED_PHOTOS: Record<string, string[]> = {
  Medical:     ['Hospital recovery photo', 'Family support gathering', 'Medical team portrait'],
  Memorial:    ['Favourite photo of them', 'Family together', 'A place they loved'],
  Emergency:   ['Community response photo', 'Crisis impact image', 'Recovery moment'],
  Nonprofit:   ['Your team at work', 'People you serve', 'Programme in action'],
  Education:   ['Student studying photo', 'Graduation celebration', 'Classroom scene'],
  Animal:      ['Pet recovery photo', 'Animal shelter moment', 'Vet visit photo'],
  Environment: ['Site before the work', 'Volunteers restoring it', 'Wildlife or habitat'],
  Business:    ['Your storefront or workspace', 'The team behind it', 'Product being made'],
  Community:   ['Neighbours together', 'The space being improved', 'A local event'],
  Competition: ['Team photo', 'Training session', 'Last competition'],
  Creative:    ['Work in progress', 'Finished piece', 'You in the studio'],
  // NB: a real apostrophe, not `&apos;` — these strings render as JSX *children*
  // (`{photo}`), where HTML entities are not decoded and would show verbatim.
  Event:       ["Last year's event", 'The venue', 'People taking part'],
  Faith:       ['Congregation gathered', 'The building or space', 'Community outreach'],
  Family:      ['Family portrait', 'Everyday moment together', 'The home'],
  Sports:      ['Team in action', 'Match day photo', 'Training or kit'],
  Travel:      ['Where you are going', 'Preparing for the trip', 'The people joining you'],
  Volunteer:   ['Volunteers at work', 'Who the work helps', 'The site or project'],
  Wishes:      ['The person this is for', 'What the wish means', 'A moment together'],
  default:     ['Campaign hero image', 'Community gathering', 'Personal story photo'],
};

// ─────────────────────────────────────────────
// CampaignPreviewModal
// ─────────────────────────────────────────────
function CampaignPreviewModal({
  form,
  coverImageUrl,
  imageCount,
  goalCents,
  organizerName,
  identityVerified,
  nonprofitVerified,
  payoutLinked,
  onGoToStep,
  onClose,
  onLaunch,
  launching,
  canLaunch,
}: {
  form: FormState;
  coverImageUrl: string;
  imageCount: number;
  goalCents: number;
  organizerName: string;
  identityVerified: boolean;
  nonprofitVerified: boolean;
  payoutLinked: boolean;
  /**
   * Field-named, not screen-named. The modal lists what a donor looks for —
   * "a title", "a story" — so its items keep those names even though title,
   * story and goal now share one screen. The page maps them to the screen via
   * `stepForReadiness`, in exactly one place.
   */
  onGoToStep: (step: ReadinessStep) => void;
  onClose: () => void;
  onLaunch: () => void;
  launching: boolean;
  canLaunch: boolean;
}) {
  const beneficiary = form.forSelf === 'true' ? 'you' : (form.beneficiaryName || 'someone in need');
  const useOfFunds = parseUseOfFunds(form.useOfFundsJson);
  const campaignVideo = parseCampaignVideoUrl(form.videoUrl);
  // Most donors arrive on a phone, so the preview defaults to the phone frame —
  // previewing only the desktop layout hid the view most donors actually get.
  const [viewport, setViewport] = React.useState<'mobile' | 'desktop' | 'social' | 'checkout'>('mobile');
  const donorView = evaluateDonorView({
    title: form.title, description: form.description, goalCents,
    coverImageUrl, imageCount, forSelf: form.forSelf,
    beneficiaryName: form.beneficiaryName, category: form.category, country: form.country,
  });
  const unmet = donorView.checks.filter((c) => !c.passed);
  return (
    <div className="cr2-preview-overlay">
      <div className="cr2-preview-topbar">
        <span className="cr2-preview-badge">PREVIEW MODE</span>
        <p className="cr2-preview-topbar-title">{form.title || 'Untitled Campaign'}</p>
        <button type="button" className="cr2-preview-topbar-back" onClick={onClose}>← Back</button>
        <div role="group" aria-label="Preview device" style={{ display: 'inline-flex', gap: 4, background: 'rgba(0,0,0,.18)', borderRadius: 999, padding: 3, marginLeft: 8 }}>
          {(['mobile', 'desktop', 'social', 'checkout'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setViewport(v)} aria-pressed={viewport === v}
              style={{ padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800,
                background: viewport === v ? '#fff' : 'transparent', color: viewport === v ? '#1a1a2e' : '#fff' }}>
              {v === 'mobile' ? 'Phone' : v === 'desktop' ? 'Desktop' : v === 'social' ? 'Social' : 'Checkout'}
            </button>
          ))}
        </div>
        <button type="button" className="cr2-preview-topbar-launch" onClick={onLaunch} disabled={launching || !canLaunch} title={canLaunch ? 'Publish campaign' : 'Complete launch readiness first'}>
          {launching ? 'Launching…' : '🚀 Launch Campaign'}
        </button>
      </div>
      <div className="cr2-preview-scroll">
        {viewport === 'social' ? (
          <div className="cb-social-preview" aria-label="Social sharing preview">
            <div className="cb-social-preview-image">
              {coverImageUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={coverImageUrl} alt="" />
                : <span>Cover image</span>}
            </div>
            <div className="cb-social-preview-copy">
              <span>charitme.com</span>
              <h2>{form.socialTitle || form.title || 'Your campaign title'}</h2>
              <p>{form.socialDescription || form.tagline || form.description.slice(0, 180) || 'Your campaign summary will appear here.'}</p>
            </div>
          </div>
        ) : viewport === 'checkout' ? (
          <div className="cb-checkout-preview" aria-label="Donation checkout preview">
            <div className="cb-checkout-summary">
              <span className="cr2-preview-cat-pill">{form.category}</span>
              <h2>Support {form.title || 'this campaign'}</h2>
              <p>Choose a donation amount</p>
              <div className="cb-checkout-amounts">
                {(parseDonationTiers(form.donationTiersJson).length > 0
                  ? parseDonationTiers(form.donationTiersJson).slice(0, 4).map((tier) => tier.amountCents)
                  : [2500, 5000, 10000, 25000]).map((amount) => (
                    <button type="button" key={amount} disabled>{formatMoneyShort(amount, form.currency)}</button>
                  ))}
              </div>
              <label><span>Other amount</span><div className="cb-checkout-input"><span>{currencySymbol(form.currency)}</span><input disabled placeholder="0.00" /></div></label>
              <button type="button" className="cr2-donate-btn" disabled>Continue to payment</button>
              <small>Preview only. No payment is collected.</small>
            </div>
          </div>
        ) : (
        <div
          className="cr2-preview-page"
          style={viewport === 'mobile'
            ? { maxWidth: 420, margin: '0 auto', boxShadow: '0 0 0 8px rgba(0,0,0,.25)', borderRadius: 18, overflow: 'hidden' }
            : undefined}
        >
          <div className="cr2-preview-hero">
            {campaignVideo?.kind === 'embed' ? (
              <iframe
                src={campaignVideo.previewUrl}
                title={`Video for ${form.title || 'campaign preview'}`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : coverImageUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={coverImageUrl} alt="Cover" />
              : 'Cover photo will appear here'}
          </div>
          <div className="cr2-preview-content">
            <div className="cr2-preview-main">
              <span className="cr2-preview-cat-pill">{form.category}</span>
              <h1>{form.title || 'Your Campaign Title'}</h1>
              <p className="cr2-preview-by">
                Organized by <strong>{organizerName || 'Organizer name pending'}</strong>
                {form.country && <> · {form.country}</>}
              </p>
              <button type="button" className="cb-preview-edit" onClick={() => { onClose(); onGoToStep('purpose'); }}>Edit title</button>
              <section className="cb-preview-section" aria-labelledby="preview-beneficiary-heading">
                <div className="cb-preview-section-head">
                  <h2 id="preview-beneficiary-heading">Who this helps</h2>
                  <button type="button" className="cb-preview-edit" onClick={() => { onClose(); onGoToStep('beneficiary'); }}>Edit</button>
                </div>
                <p>
                  {form.forSelf === 'true'
                    ? 'This campaign supports the organizer directly.'
                    : `${beneficiary}${form.beneficiaryRelationship ? ` · ${form.beneficiaryRelationship}` : ''}`}
                </p>
              </section>
              <section className="cb-preview-section" aria-labelledby="preview-story-heading">
                <div className="cb-preview-section-head">
                  <h2 id="preview-story-heading">The story</h2>
                  <button type="button" className="cb-preview-edit" onClick={() => { onClose(); onGoToStep('story'); }}>Edit</button>
                </div>
                <p className="cr2-preview-story-text">
                  {form.description || 'Your campaign story will appear here. Write a compelling story on the previous step to engage donors and explain your cause.'}
                </p>
              </section>
              <section className="cb-preview-section" aria-labelledby="preview-funds-heading">
                <div className="cb-preview-section-head">
                  <h2 id="preview-funds-heading">How funds will be used</h2>
                  <button type="button" className="cb-preview-edit" onClick={() => { onClose(); onGoToStep('plan'); }}>Edit</button>
                </div>
                {useOfFunds.length > 0 ? (
                  <ul className="cb-preview-fund-list">
                    {useOfFunds.map((item) => (
                      <li key={item.id}><span>{item.label}</span><strong>{formatMoneyShort(item.amountCents, form.currency)}</strong></li>
                    ))}
                  </ul>
                ) : <p>Your campaign budget will appear here.</p>}
              </section>
            </div>
            <div>
              <div className="cr2-donate-box">
                <div className="cr2-donate-raised">{formatMoneyShort(0, form.currency)}</div>
                <div className="cr2-donate-goal">raised of {formatMoneyShort(goalCents, form.currency)} goal</div>
                <div className="cr2-donate-bar"><div className="cr2-donate-fill" /></div>
                <div className="cr2-donate-stats">
                  <span><strong>{formatMoneyShort(0, form.currency)}</strong> raised</span>
                  <span><strong>0</strong> donors</span>
                </div>
                {/* Inert on purpose — say so, rather than letting it look broken. */}
                <button type="button" className="cr2-donate-btn" disabled title="Donations are disabled in preview">
                  Donate Now
                </button>
                <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--t3)', textAlign: 'center' }}>
                  Preview only — donations are disabled until you publish.
                </p>
              </div>

              <div className="cb-preview-trust" aria-label="Campaign trust and verification">
                <div className="cb-preview-section-head">
                  <h2>Trust and verification</h2>
                  <button type="button" className="cb-preview-edit" onClick={() => { onClose(); onGoToStep('verify'); }}>Edit</button>
                </div>
                <ul>
                  <li className={identityVerified ? 'is-ready' : ''}><span>{identityVerified ? '✓' : '○'}</span> Organizer identity {identityVerified ? 'verified' : 'pending'}</li>
                  <li className={payoutLinked ? 'is-ready' : ''}><span>{payoutLinked ? '✓' : '○'}</span> Payout account {payoutLinked ? 'ready' : 'pending'}</li>
                  {form.campaignPath === 'nonprofit' && (
                    <li className={nonprofitVerified ? 'is-ready' : ''}><span>{nonprofitVerified ? '✓' : '○'}</span> Organization {nonprofitVerified ? 'verified' : 'pending'}</li>
                  )}
                  <li className={imageCount > 0 ? 'is-ready' : ''}><span>{imageCount > 0 ? '✓' : '○'}</span> {imageCount} campaign {imageCount === 1 ? 'photo' : 'photos'}</li>
                </ul>
                <button type="button" className="cb-preview-edit cb-preview-media-edit" onClick={() => { onClose(); onGoToStep('media'); }}>Edit media</button>
              </div>

              {/* F10: what a donor looks for, from the donor's point of view. */}
              <div style={{ marginTop: 14, background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--t1, #1a1a2e)' }}>
                  How this looks to a donor
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--t3)', margin: '2px 0 10px' }}>
                  {donorView.passedCount} of {donorView.total} things donors look for
                  {unmet.length === 0 ? ' — you are ready to publish.' : ''}
                </div>
                <div style={{ height: 7, background: 'var(--s2, #eef0f7)', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ height: '100%', width: `${donorView.confidence}%`, background: 'linear-gradient(90deg,#7035ff,#ec39c3)' }} />
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {donorView.checks.map((c) => (
                    <li key={c.id} style={{ display: 'flex', minWidth: 0, gap: 9, alignItems: 'flex-start' }}>
                      <span aria-hidden style={{ color: c.passed ? 'var(--green, #059669)' : 'var(--t4, #94a3b8)', fontWeight: 800, lineHeight: 1.4 }}>
                        {c.passed ? '✓' : '○'}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: c.passed ? 600 : 700, color: c.passed ? 'var(--t3, #64748b)' : 'var(--t1, #1a1a2e)' }}>
                          {c.label}
                        </span>
                        {!c.passed && (
                          <>
                            <span style={{ display: 'block', fontSize: 12, color: 'var(--t3)', lineHeight: 1.45, marginTop: 2 }}>{c.why}</span>
                            <button type="button" onClick={() => { onClose(); onGoToStep(c.step); }}
                              style={{ marginTop: 4, padding: 0, border: 'none', background: 'none', color: 'var(--violet, #6c35ff)', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                              Fix this →
                            </button>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
// The builder shows at most one error banner at a time (the title step has its
// own; every other step shares the panel-level one), so a single id is unique in
// the DOM and safe for aria-describedby.
const BUILDER_ERROR_ID = 'cr2-builder-error';

export default function CreatePage() {
  const [step, setStep]               = useState<WizardStep>('purpose');
  const [builderPath, setBuilderPath] = useState<CampaignBuilderPath | null>(null);
  const [loading, setLoading]         = useState(false);
  const [aiLoading, setAiLoading]     = useState(false);
  const [storyMode, setStoryMode]     = useState<'freeform' | 'guided'>('freeform');
  // Held here and written after publish, because the rewards API needs a
  // campaign id that does not exist until then (lib/campaign-rewards-draft.ts).
  const [draftRewards, setDraftRewards] = useState<DraftReward[]>([]);
  const [rewardError, setRewardError]   = useState<{ key: string; error: RewardFieldError } | null>(null);
  /** Set when the campaign published but some rewards did not save — never a publish failure. */
  const [rewardSyncNotice, setRewardSyncNotice] = useState('');
  const [error, setError]             = useState('');
  // Which field the current error belongs to, so it can be marked aria-invalid
  // and focused. Panel-level banners alone told a keyboard/AT user that
  // *something* was wrong but not *which* input, leaving focus on the button.
  const [errorField, setErrorField]   = useState<BuilderField | null>(null);
  const titleInputRef                 = useRef<HTMLInputElement>(null);
  const titleSeededRef                = useRef(false);
  const storyInputRef                 = useRef<HTMLTextAreaElement>(null);
  const goalInputRef                  = useRef<HTMLInputElement>(null);
  const [publishedSlug, setPublishedSlug] = useState('');
  // The QR-poster endpoint keys on the campaign id, not the slug.
  const [publishedId, setPublishedId] = useState('');
  const [userName, setUserName]       = useState<string | null>(null);
  const [userEmail, setUserEmail]     = useState<string | undefined>(undefined);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [nonprofitVerified, setNonprofitVerified] = useState(false);
  const [payoutAccountState, setPayoutAccount] = useState<PayoutAccount | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [isGuest, setIsGuest]         = useState<boolean | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  /**
   * Why the modal was opened, so success does the right thing.
   *
   * ⚠️ This used to be INFERRED from the current step (`step === GUEST_GATE_STEP`
   * meant "advance", anything else meant "publish"). That worked only while
   * exactly one mid-wizard step could open it. Sign-in is now requested at the
   * two moments that actually need a session — uploading and publishing — and
   * those can both happen on the same step, so the step can no longer tell them
   * apart. Publishing a campaign because someone signed in to attach a photo
   * would be a genuinely bad outcome, so the intent is recorded, not guessed.
   */
  const [loginIntent, setLoginIntent] = useState<'upload' | 'publish'>('publish');
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Restore wizard state parked in sessionStorage across an OAuth sign-in bounce.
  // Restores images and story mode as well as the text — text-only restores used
  // to silently drop every upload and blank the cover image on return.
  const restoreBounce = useCallback((saved: string | null) => {
    if (!saved) return;
    try {
      const { savedForm, savedStep, savedImages, savedStoryMode } = JSON.parse(saved) as {
        savedForm: FormState; savedStep: WizardStep;
        savedImages?: { url: string; name: string; storagePath?: string }[]; savedStoryMode?: string;
      };
      if (Array.isArray(savedImages) && savedImages.length > 0) {
        setUploadedImages(savedImages.map((i, idx) => {
          const storagePath = campaignMediaStoragePath(i.url, i.storagePath);
          return {
            id: storagePath || `unrestorable-bounce-${idx}`,
            url: i.url,
            name: i.name ?? '',
            status: storagePath ? 'done' as const : 'error' as const,
            errorMsg: storagePath ? undefined : 'Re-upload this image to continue.',
          };
        }));
      }
      if (savedStoryMode === 'freeform' || savedStoryMode === 'guided') setStoryMode(savedStoryMode);
      setForm(normalizeForm(savedForm));
      const restoredStep = normalizeStep(savedStep);
      if (restoredStep) setStep(restoredStep);
    } catch { /* ignore */ }
    sessionStorage.removeItem('cm_wizard');
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setIsGuest(true);
        restoreBounce(sessionStorage.getItem('cm_wizard'));
        return;
      }
      setIsGuest(false);
      setUserEmail(user.email ?? undefined);
      restoreBounce(sessionStorage.getItem('cm_wizard'));
      void Promise.all([
        supabase
          .from('profiles')
          .select('full_name, avatar_url, identity_verified')
          .eq('id', user.id)
          .single(),
        supabase
          .from('nonprofit_profiles')
          .select('verified, verification_status')
          .eq('owner_id', user.id),
      ]).then(([profileResult, nonprofitResult]) => {
        const profile = profileResult.data as {
          full_name?: string | null;
          avatar_url?: string | null;
          identity_verified?: boolean | null;
        } | null;
        if (profile) {
          setUserName(profile.full_name ?? null);
          setUserAvatarUrl(profile.avatar_url ?? null);
          setIdentityVerified(profile.identity_verified === true);
        }
        const organizations = (nonprofitResult.data ?? []) as {
          verified?: boolean | null;
          verification_status?: string | null;
        }[];
        setNonprofitVerified(organizations.some((organization) =>
          organization.verified === true || organization.verification_status === 'verified'));
      });
    });
  }, [restoreBounce]);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('path');
    if (requested === 'ai' || params.has('ai') || params.has('intake')) setBuilderPath('ai');
    else if (requested === 'guided'
      || sessionStorage.getItem('cm_wizard')
      || localStorage.getItem(CAMPAIGN_DRAFT_KEY)) {
      titleSeededRef.current = true;
      setForm((previous) => previous.title.trim()
        ? previous
        : { ...previous, title: suggestCampaignTitle(previous) });
      setBuilderPath('guided');
    }
    else setBuilderPath(null);
  }, []);

  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [pendingIntakeFiles, setPendingIntakeFiles] = useState<File[]>([]);
  const [sourceUploadError, setSourceUploadError] = useState('');
  const [dragging, setDragging]             = useState(false);
  const [uploadError, setUploadError]       = useState('');

  // ── Draft autosave / recovery ──────────────────────────────────────────────
  // Persist wizard progress to localStorage so an interrupted user (refresh,
  // closed tab, dead battery) can resume exactly where they left off. We hold the
  // recovered draft until the user decides (resume vs start fresh) so autosave
  // never overwrites it with the empty initial form.
  const [recoverableDraft, setRecoverableDraft] = useState<CampaignDraft<FormState> | null>(null);
  // Every draft the organizer has in flight (F8) plus the id of the newest, so
  // the picker can offer "resume this one" / "start another".
  const [draftList, setDraftList] = useState<DraftSummary[]>([]);
  const [showDraftPicker, setShowDraftPicker] = useState(false);
  const remoteLatestIdRef = useRef<string | null>(null);
  const draftDecided = useRef(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    // A pending login-bounce restore (cm_wizard) takes precedence — don't also
    // offer the localStorage recovery banner in that case.
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('cm_wizard')) { draftDecided.current = true; return; }
    const draft = parseDraft<FormState>(localStorage.getItem(CAMPAIGN_DRAFT_KEY));
    if (draft && draftHasContent(draft.form, draft.images.length)) {
      setRecoverableDraft(draft);
    } else {
      draftDecided.current = true; // nothing to recover → safe to start autosaving
    }
  }, []);

  // Which server-side draft this tab is editing. Organizers may keep several in
  // flight (F8), so autosave has to update the right one rather than a single
  // per-user row. Persisted so a refresh keeps editing the same draft.
  const draftIdRef = useRef<string | null>(
    typeof window === 'undefined' ? null : localStorage.getItem(ACTIVE_DRAFT_KEY),
  );
  const draftSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const draftSaveSequenceRef = useRef(0);
  const draftGenerationRef = useRef(0);
  const setActiveDraftId = useCallback((id: string | null) => {
    draftIdRef.current = id;
    if (typeof window === 'undefined') return;
    if (id) localStorage.setItem(ACTIVE_DRAFT_KEY, id);
    else localStorage.removeItem(ACTIVE_DRAFT_KEY);
  }, []);

  const persistWizardDraft = useCallback(async (): Promise<boolean> => {
    const completedImages = uploadedImages.filter((image) => image.status === 'done');
    if (!draftHasContent(form, completedImages.length)) return true;
    const sequence = ++draftSaveSequenceRef.current;
    const generation = draftGenerationRef.current;
    setSaveState('saving');
    const draft = buildDraft({
      step,
      storyMode,
      builderPath: builderPath ?? 'guided',
      schemaVersion: CAMPAIGN_BUILDER_SCHEMA_VERSION,
      sourceContext: {
        links: parseSourceLinks(form.sourceLinksJson),
        documents: parseSourceDocuments(form.sourceDocumentsJson),
      },
      form,
      images: completedImages.map((image) => ({ url: image.url, name: image.name, storagePath: image.id })),
    });
    localStorage.setItem(CAMPAIGN_DRAFT_KEY, serializeDraft(draft));
    if (isGuest !== false) {
      if (sequence === draftSaveSequenceRef.current) setSaveState('saved');
      return true;
    }
    let remoteSaved = false;
    const queuedSave = draftSaveQueueRef.current.catch(() => undefined).then(async () => {
      if (generation !== draftGenerationRef.current) {
        remoteSaved = true;
        return;
      }
      try {
        const response = await fetch('/api/campaigns/draft', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: draftIdRef.current ?? undefined,
            step,
            storyMode,
            builderPath: builderPath ?? 'guided',
            schemaVersion: CAMPAIGN_BUILDER_SCHEMA_VERSION,
            sourceContext: draft.sourceContext,
            form,
            images: draft.images,
            ts: draft.ts,
          }),
        });
        if (!response.ok) throw new Error('remote save failed');
        const result: unknown = await response.json();
        if (generation === draftGenerationRef.current
            && result && typeof result === 'object'
            && typeof (result as { id?: unknown }).id === 'string') {
          setActiveDraftId((result as { id: string }).id);
        }
        remoteSaved = true;
      } catch {
        remoteSaved = false;
      }
    });
    draftSaveQueueRef.current = queuedSave.then(() => undefined, () => undefined);
    await queuedSave;
    if (generation === draftGenerationRef.current && sequence === draftSaveSequenceRef.current) {
      setSaveState(remoteSaved ? 'saved' : 'error');
    }
    return remoteSaved;
  }, [builderPath, form, isGuest, setActiveDraftId, step, storyMode, uploadedImages]);

  const clearDraft = useCallback(() => {
    draftGenerationRef.current += 1;
    draftSaveSequenceRef.current += 1;
    if (typeof window !== 'undefined') localStorage.removeItem(CAMPAIGN_DRAFT_KEY);
    setSaveState('idle');
    // Drop the cross-device copy too, so a published campaign never resurfaces as
    // a "resume your draft" prompt on the organizer's other devices. Only this
    // draft is removed — the organizer's other drafts must survive.
    const id = draftIdRef.current;
    if (id) {
      void fetch(`/api/campaigns/draft?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
        .catch(() => { /* best-effort */ });
    }
    setActiveDraftId(null);
  }, [setActiveDraftId]);

  // Rehydrate rewards whenever the form is replaced wholesale — draft recovery,
  // opening another draft, or the OAuth bounce. Doing it here rather than at each
  // restore site means a new restore path cannot forget to carry the rewards.
  // The comparison is what stops this looping: the editor writes both pieces of
  // state from the same JSON, so on an ordinary keystroke they already agree.
  useEffect(() => {
    const serialized = JSON.stringify(draftRewards);
    if (serialized === form.rewardsJson) return;
    if (!form.rewardsJson && draftRewards.length === 0) return;
    setDraftRewards(parseDraftRewards(form.rewardsJson));
  }, [form.rewardsJson, draftRewards]);

  const resumeDraft = useCallback(() => {
    const d = recoverableDraft;
    if (!d) return;
    draftGenerationRef.current += 1;
    draftSaveSequenceRef.current += 1;
    setForm(normalizeForm(d.form));
    setBuilderPath(d.builderPath);
    if (d.storyMode === 'freeform' || d.storyMode === 'guided') setStoryMode(d.storyMode);
    setUploadedImages(d.images.map((i, idx) => ({
      id: i.storagePath || `unrestorable-local-${idx}`,
      url: i.url,
      name: i.name,
      status: i.storagePath ? 'done' as const : 'error' as const,
      errorMsg: i.storagePath ? undefined : 'Re-upload this image to continue.',
    })));
    const draftStep = normalizeStep(d.step);
    if (draftStep) setStep(draftStep);
    setSaveState('saved');
    draftDecided.current = true;
    setRecoverableDraft(null);
  }, [recoverableDraft]);

  /** Load one of the organizer's other drafts into the wizard (F8). */
  const openDraft = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/campaigns/draft?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (res.status !== 200) return;
      const { draft: row } = await res.json();
      const d = fromRemoteDraft<FormState>(row);
      if (!d) return;
      draftGenerationRef.current += 1;
      draftSaveSequenceRef.current += 1;
      setForm(normalizeForm(d.form));
      setBuilderPath(d.builderPath);
      if (d.storyMode === 'freeform' || d.storyMode === 'guided') setStoryMode(d.storyMode);
      setUploadedImages(d.images.map((i, idx) => ({
        id: i.storagePath || `unrestorable-remote-${idx}`,
        url: i.url,
        name: i.name,
        status: i.storagePath ? 'done' as const : 'error' as const,
        errorMsg: i.storagePath ? undefined : 'Re-upload this image to continue.',
      })));
      const st = normalizeStep(d.step);
      if (st) setStep(st);
      setSaveState('saved');
      setActiveDraftId(id);
      draftDecided.current = true;
      setRecoverableDraft(null);
      setShowDraftPicker(false);
    } catch { /* best-effort */ }
  }, [setActiveDraftId]);

  /** Discard one draft permanently. */
  const deleteDraft = useCallback(async (id: string) => {
    try {
      await fetch(`/api/campaigns/draft?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setDraftList((list) => list.filter((d) => d.id !== id));
      if (draftIdRef.current === id) {
        draftGenerationRef.current += 1;
        draftSaveSequenceRef.current += 1;
        setActiveDraftId(null);
      }
    } catch { /* best-effort */ }
  }, [setActiveDraftId]);

  /** Begin a fresh campaign, leaving existing drafts untouched. */
  const startNewDraft = useCallback(() => {
    draftGenerationRef.current += 1;
    draftSaveSequenceRef.current += 1;
    setActiveDraftId(null);
    if (typeof window !== 'undefined') localStorage.removeItem(CAMPAIGN_DRAFT_KEY);
    const nextForm = builderPath === 'guided'
      ? { ...EMPTY_FORM, title: suggestCampaignTitle(EMPTY_FORM) }
      : EMPTY_FORM;
    titleSeededRef.current = builderPath === 'guided';
    setForm(nextForm);
    setUploadedImages([]);
    setStep('purpose');
    setSaveState('idle');
    draftDecided.current = true;
    setRecoverableDraft(null);
    setShowDraftPicker(false);
  }, [builderPath, setActiveDraftId]);

  const dismissDraft = useCallback(() => {
    clearDraft();
    draftDecided.current = true;
    setRecoverableDraft(null);
  }, [clearDraft]);

  useEffect(() => {
    if (!draftDecided.current || recoverableDraft) return;
    if (typeof window === 'undefined') return;
    if (!draftHasContent(form, uploadedImages.filter((image) => image.status === 'done').length)) return;
    setSaveState('saving');
    const timer = window.setTimeout(() => { void persistWizardDraft(); }, 600);
    return () => window.clearTimeout(timer);
  }, [form, step, storyMode, builderPath, uploadedImages, recoverableDraft, persistWizardDraft]);

  // Cross-device resume: once we know the user is signed in, look for a draft
  // saved on another device and offer it when it is fresher than anything local.
  const remoteDraftChecked = useRef(false);
  useEffect(() => {
    if (isGuest !== false || remoteDraftChecked.current) return;
    remoteDraftChecked.current = true;
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('cm_wizard')) return; // a login bounce owns this restore
    void (async () => {
      try {
        const res = await fetch('/api/campaigns/draft', { cache: 'no-store' });
        if (res.status !== 200) return;
        const { drafts, latest } = await res.json();
        setDraftList(Array.isArray(drafts) ? drafts : []);
        const remote = fromRemoteDraft<FormState>(latest);
        if (latest?.id) remoteLatestIdRef.current = latest.id as string;
        if (!remote || !draftHasContent(remote.form, remote.images.length)) return;
        const local = parseDraft<FormState>(localStorage.getItem(CAMPAIGN_DRAFT_KEY));
        const freshest = pickFreshestDraft(local, remote);
        // Only interrupt when the winner is the remote copy the user can't see yet.
        if (freshest !== remote) return;
        if (draftDecided.current && !recoverableDraft) return; // already resumed/dismissed
        setRecoverableDraft(remote);
        // More than one in flight → let the organizer choose rather than assuming
        // the newest is the one they meant to continue.
        if (Array.isArray(drafts) && drafts.length > 1) setShowDraftPicker(true);
      } catch { /* best-effort */ }
    })();
  }, [isGuest, recoverableDraft]);

  // ── Builder funnel analytics (drop-off / abandonment / completion) ──────────
  const builderSession = useRef<string>('');
  // Set when the user clicks an in-app link, so the resulting unload is not
  // miscounted as abandoning the builder.
  const internalNavRef = useRef(false);

  // ── Goal guidance: what comparable campaigns in this category actually set ──
  const [goalGuidance, setGoalGuidance] = useState<{
    available: boolean; sampleSize: number; lowCents: number | null; highCents: number | null;
    medianRaisedCents: number | null; goalHitRate: number | null; note: string;
  } | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let sid = localStorage.getItem('charitme-builder-session');
    if (!sid) { sid = (crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`); localStorage.setItem('charitme-builder-session', sid); }
    builderSession.current = sid;
  }, []);

  const trackBuilder = useCallback((event: string, stepKey: string) => {
    if (typeof window === 'undefined' || !builderSession.current) return;
    const body = JSON.stringify({ sessionId: builderSession.current, path: builderPath ?? 'guided', step: stepKey, event });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon('/api/analytics/builder', new Blob([body], { type: 'application/json' }));
      else void fetch('/api/analytics/builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
    } catch { /* analytics is best-effort */ }
  }, [builderPath]);

  // Fire an "enter" per step (the funnel), and "abandon" if the tab closes before publishing.
  useEffect(() => { if (builderSession.current) trackBuilder('enter', step); }, [step, trackBuilder]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Only count a real abandonment. `beforeunload` also fires on ordinary
    // same-origin navigation (e.g. clicking through to /login or the dashboard),
    // which was inflating the abandon rate and making the funnel look far worse
    // than it is. Clicking any in-app link marks the unload as intentional.
    const onNavigate = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.('a');
      const href = anchor?.getAttribute('href');
      if (!href) return;
      if (href.startsWith('/') || href.startsWith(window.location.origin)) {
        internalNavRef.current = true;
        // Reset shortly after: if the navigation never actually happens, a later
        // genuine close should still be recorded as an abandon.
        window.setTimeout(() => { internalNavRef.current = false; }, 2000);
      }
    };
    const onLeave = () => {
      if (step === 'publish' || internalNavRef.current) return;
      trackBuilder('abandon', step);
    };
    document.addEventListener('click', onNavigate, true);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      document.removeEventListener('click', onNavigate, true);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, [step, trackBuilder]);

  // AI-default prefill: never show an empty title field. When the creator reaches
  // the Title step with no title yet, seed a smart suggestion from what they've
  // already entered (category / beneficiary / self). Instant + editable; they can
  // also hit "AI improve". Seeds once so it never fights the user's edits.
  useEffect(() => {
    if (step !== 'purpose' || builderPath !== 'guided' || titleSeededRef.current) return;
    titleSeededRef.current = true;
    setForm(prev => (prev.title.trim() ? prev : { ...prev, title: suggestCampaignTitle(prev) }));
  }, [step, builderPath]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlsRef  = useRef<string[]>([]);

  useEffect(() => {
    const refs = blobUrlsRef.current;
    return () => { refs.forEach(u => URL.revokeObjectURL(u)); };
  }, []);

  useEffect(() => {
    const first = uploadedImages.find(img => img.status === 'done');
    setForm(prev => ({ ...prev, coverImageUrl: first?.url ?? '' }));
  }, [uploadedImages]);

  useEffect(() => {
    if (step !== 'payout' && step !== 'review') return;
    setPayoutLoading(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setPayoutLoading(false); return; }
      supabase
        .from('connected_accounts')
        .select('id, stripe_account_id, payouts_enabled, charges_enabled, details_submitted, verification_status')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data: account }) => {
          setPayoutAccount(account as PayoutAccount | null);
          setPayoutLoading(false);
        });
    });
  }, [step]);

  // Fetch guidance when the organizer reaches the Goal step. Best-effort: if it
  // is unavailable or the category has too few comparables, the step simply
  // renders as it did before rather than showing a made-up range.
  useEffect(() => {
    if (step !== 'goal' || !form.category) return;
    let cancelled = false;
    setGoalGuidance(null);
    void (async () => {
      try {
        const params = new URLSearchParams({ category: form.category, currency: form.currency });
        const res = await fetch(`/api/campaigns/goal-guidance?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { guidance } = await res.json();
        if (!cancelled && guidance?.available) setGoalGuidance(guidance);
      } catch { /* guidance is a nicety, never a blocker */ }
    })();
    return () => { cancelled = true; };
  }, [step, form.category, form.currency]);

  const upd = (k: keyof FormState, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const goalCents = Math.round((parseFloat(form.goal) || 0) * 100);
  const stepIdx   = WIZARD_STEPS.findIndex(s => s.key === step);
  /**
   * Whether an optional step has been engaged with, so the primary button can
   * read "Skip this step" rather than "Continue" when there is nothing to carry
   * forward. Only the two optional steps can answer this; everything else is
   * required and always reads "Continue".
   */
  const stepHasInput = step === 'verify'
    ? identityVerified || nonprofitVerified
    : false;
  const hasCover  = uploadedImages.some(img => img.status === 'done');


  const autoGoalStart = Math.max(2400, Math.round((parseFloat(form.goal) || 0) * 0.4));

  // Report a validation failure against a specific field: show the banner, mark
  // the field invalid, and move focus to it so the user lands on what to fix.
  const failField = (field: BuilderField, message: string) => {
    setError(message);
    setErrorField(field);
    const ref = field === 'title' ? titleInputRef
      : field === 'description' ? storyInputRef
      : field === 'goal' ? goalInputRef
      : null;
    // Focus after the banner renders so AT announces the alert, then lands.
    requestAnimationFrame(() => ref?.current?.focus());
  };

  const goNext = () => {
    setError(''); setErrorField(null);
    if (step === 'beneficiary') {
      if (!form.forSelf) { setError('Choose who will benefit from this campaign.'); return; }
      if (form.forSelf === 'false' && !form.beneficiaryName.trim()) {
        setError('Enter the beneficiary name.'); return;
      }
      if (form.forSelf === 'false' && !form.beneficiaryRelationship.trim()) {
        setError('Describe your relationship to the beneficiary.'); return;
      }
    }
    if (step === 'category' && !form.category) {
      setError('Choose the category that best matches this campaign.'); return;
    }
    if (step === 'location' && !form.country) {
      setError('Choose the beneficiary country.'); return;
    }
    if (step === 'plan') {
      const funds = parseUseOfFunds(form.useOfFundsJson);
      if (funds.length === 0 || funds.some((item) => !item.label.trim() || item.amountCents <= 0)) {
        setError('Add a clear label and amount for every budget item.'); return;
      }
      if (totalUseOfFunds(funds) !== goalCents) {
        setError('The use-of-funds budget must total the fundraising goal exactly.'); return;
      }
    }
    if (step === 'media') {
      const stillUploading = uploadedImages.some(img => img.status === 'uploading');
      if (stillUploading) { setError('Please wait for all images to finish uploading.'); return; }
      if (!hasCover) { setError('Add a cover photo before continuing.'); return; }
      if (form.videoUrl.trim() && !parseCampaignVideoUrl(form.videoUrl)) {
        setError('Enter a valid HTTPS YouTube or Vimeo video link.'); return;
      }
    }
    // Rewards are validated HERE rather than at publish, so an organizer learns a
    // title is too long while they are looking at it — not after the campaign is
    // already live and the write has been rejected.
    if (step === 'settings') {
      const invalid = validateDraftRewards(draftRewards);
      if (invalid) { setRewardError(invalid); setError(invalid.error.message); return; }
      setRewardError(null);
      const settingsError = validateCampaignBuilderSettings({
        donationTiers: parseDonationTiers(form.donationTiersJson),
        faqs: parseCampaignFaqs(form.faqsJson),
        milestones: parseCampaignMilestones(form.milestonesJson),
      });
      if (settingsError) { setError(settingsError); return; }
      if (form.policyAccepted !== 'true') {
        setError('Confirm the campaign is accurate and follows CharitMe policies.'); return;
      }
    }
    if (step === 'payout' && !payoutLinked) {
      setError('Complete Stripe payout onboarding before continuing.'); return;
    }
    if (step === 'verify' && !identityVerified) {
      setError('Complete identity verification before publishing.'); return;
    }
    if (step === 'verify' && form.campaignPath === 'nonprofit' && !nonprofitVerified) {
      setError('Complete organization verification before publishing a nonprofit campaign.'); return;
    }
    // Keep field targeting in the shared validator so browser and unit coverage
    // exercise the same focus and error contract.
    const stepError = validateBuilderStep({
      step,
      title: form.title,
      description: form.description,
      goalCents,
      goalRaw: form.goal,
      currency: form.currency,
    });
    if (stepError) { failField(stepError.field, stepError.message); return; }
    if (builderPath === 'ai') {
      const funds = parseUseOfFunds(form.useOfFundsJson);
      const budgetComplete = funds.length > 0
        && funds.every((item) => Boolean(item.label.trim()) && item.amountCents > 0)
        && totalUseOfFunds(funds) === goalCents;
      setStep(nextIncompleteStepAfter(step, {
        purpose: form.title.trim().length >= 3,
        beneficiary: Boolean(form.forSelf)
          && (form.forSelf !== 'false'
            || (Boolean(form.beneficiaryName.trim()) && Boolean(form.beneficiaryRelationship.trim()))),
        category: Boolean(form.category),
        location: Boolean(form.country),
        goal: goalCents >= 100,
        plan: budgetComplete,
        story: form.description.trim().length >= 20,
        media: hasCover,
        settings: form.policyAccepted === 'true',
        payout: payoutLinked,
        verify: identityVerified
          && (form.campaignPath !== 'nonprofit' || nonprofitVerified),
      }));
      return;
    }
    const next = WIZARD_STEPS[stepIdx + 1];
    if (next) setStep(next.key);
  };

  const goPrev = () => {
    setError('');
    // Checked here as well as on the button: once the campaign is live, going
    // back would reopen the builder on something that already has a public URL.
    if (!canGoBack(step)) return;
    const prev = WIZARD_STEPS[stepIdx - 1];
    if (prev) setStep(prev.key);
  };

  const handleFileSelect = useCallback(async (files: FileList | readonly File[] | null) => {
    if (!files || files.length === 0) return;
    // The one moment in the builder that cannot work without a session:
    // /api/upload/campaign-image checks it server-side and 401s. Asking here —
    // rather than on entering the step — means a guest who is not adding photos
    // is never asked at all, and one who is gets the prompt at the instant it
    // becomes true, with their draft already saved.
    if (isGuest === true) { setLoginIntent('upload'); setShowLoginModal(true); return; }
    const remaining = MAX_IMAGES - uploadedImages.length;
    if (remaining <= 0) { setUploadError(`Maximum ${MAX_IMAGES} images allowed.`); return; }
    const validFiles = Array.from(files).filter(f => ALLOWED_IMG_TYPES.has(f.type) && f.size <= MAX_IMG_SIZE).slice(0, remaining);
    const skipped = files.length - validFiles.length;
    if (validFiles.length === 0) { setUploadError('No valid images found. Use JPG, PNG, GIF, WebP, or AVIF under 5 MB.'); return; }
    setUploadError(skipped > 0 ? `${skipped} file(s) skipped — invalid type or over 5 MB.` : '');
    const newItems: UploadedImage[] = validFiles.map(f => {
      const blobUrl = URL.createObjectURL(f);
      blobUrlsRef.current.push(blobUrl);
      return { id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`, url: blobUrl, name: f.name, status: 'uploading' };
    });
    setUploadedImages(prev => [...prev, ...newItems]);
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]!;
      const pendingId = newItems[i]!.id;
      const blobUrl = newItems[i]!.url;
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload/campaign-image', { method: 'POST', body: fd });
        const data = await res.json() as { url?: string; path?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Upload failed');
        URL.revokeObjectURL(blobUrl);
        blobUrlsRef.current = blobUrlsRef.current.filter(u => u !== blobUrl);
        setUploadedImages(prev => prev.map(img => img.id === pendingId ? { id: data.path!, url: data.url!, name: file.name, status: 'done' } : img));
      } catch (e: unknown) {
        setUploadedImages(prev => prev.map(img => img.id === pendingId ? { ...img, status: 'error', errorMsg: e instanceof Error ? e.message : 'Upload failed' } : img));
      }
    }
  }, [uploadedImages.length, isGuest]);

  const uploadSourceDocuments = useCallback(async (files: readonly File[]) => {
    if (files.length === 0) return;
    if (isGuest !== false) {
      setPendingIntakeFiles((current) => [...current, ...files]);
      return;
    }
    setSourceUploadError('');
    const saved = parseSourceDocuments(form.sourceDocumentsJson);
    for (const file of files) {
      try {
        const body = new FormData();
        body.append('file', file);
        const response = await fetch('/api/upload/campaign-source', { method: 'POST', body });
        const payload = await response.json() as {
          path?: string;
          name?: string;
          mimeType?: string;
          sizeBytes?: number;
          error?: string;
        };
        if (!response.ok || !payload.path) throw new Error(payload.error ?? 'Document upload failed.');
        saved.push({
          id: payload.path,
          name: payload.name ?? file.name,
          mediaType: 'document',
          mimeType: payload.mimeType ?? file.type,
          sizeBytes: payload.sizeBytes ?? file.size,
          storagePath: payload.path,
          publicUrl: '',
        });
      } catch (cause: unknown) {
        setSourceUploadError(cause instanceof Error ? cause.message : 'A source document could not be uploaded.');
      }
    }
    setForm((current) => ({ ...current, sourceDocumentsJson: stringifyBuilderItems(saved) }));
  }, [form.sourceDocumentsJson, isGuest]);

  const processIntakeFiles = useCallback(async (files: readonly File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'));
    const documents = files.filter((file) => !file.type.startsWith('image/'));
    if (images.length > 0) await handleFileSelect(images);
    if (documents.length > 0) await uploadSourceDocuments(documents);
  }, [handleFileSelect, uploadSourceDocuments]);

  useEffect(() => {
    if (isGuest !== false || pendingIntakeFiles.length === 0) return;
    const files = pendingIntakeFiles;
    setPendingIntakeFiles([]);
    void processIntakeFiles(files).then(() => clearCachedAiIntakeFiles()).catch(() => {
      setPendingIntakeFiles(files);
    });
  }, [isGuest, pendingIntakeFiles, processIntakeFiles]);

  const removeImage = useCallback(async (img: UploadedImage) => {
    if (img.url.startsWith('blob:')) {
      URL.revokeObjectURL(img.url);
      blobUrlsRef.current = blobUrlsRef.current.filter(u => u !== img.url);
    }
    if (img.status === 'done') {
      fetch('/api/upload/campaign-image', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: img.id }) }).catch(() => undefined);
    }
    setUploadedImages(prev => prev.filter(i => i.id !== img.id));
  }, []);

  const runAi = async (
    notesOverride?: string,
    toneOverride?: string,
    forceStory = false,
    context?: {
      category?: string;
      goalCents?: number;
      beneficiary?: string;
      sourceLinks?: string[];
      sourceDocuments?: string[];
    },
  ) => {
    setAiLoading(true);
    setError('');
    try {
      const notes = (notesOverride ?? form.description)?.trim() || 'Help us write a compelling fundraiser.';
      const res = await fetch('/api/ai/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: context?.category ?? form.category,
          goalAmount: (context?.goalCents ?? goalCents) || 500000,
          currency: form.currency,
          beneficiary: (context?.beneficiary ?? form.beneficiaryName) || 'the beneficiary',
          notes,
          tone: toneOverride || 'authentic',
          sourceLinks: context?.sourceLinks ?? parseSourceLinks(form.sourceLinksJson).map((item) => item.url),
          sourceDocuments: context?.sourceDocuments ?? parseSourceDocuments(form.sourceDocumentsJson).map((item) => item.name),
        }),
      });
      const data = await res.json() as AiCampaignDraftResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'AI generation failed');
      setForm((previous) => {
        const category = typeof data.category === 'string'
          && (CAMPAIGN_CATEGORIES as readonly string[]).includes(data.category)
          ? data.category
          : previous.category;
        const useOfFunds = Array.isArray(data.useOfFunds)
          ? data.useOfFunds.map((item, index) => ({ id: `ai-fund-${index + 1}`, label: item.label, amountCents: item.amountCents }))
          : parseUseOfFunds(previous.useOfFundsJson);
        const donationTiers = Array.isArray(data.donationTiers)
          ? data.donationTiers.map((item, index) => ({ id: `ai-tier-${index + 1}`, label: item.label, amountCents: item.amountCents }))
          : parseDonationTiers(previous.donationTiersJson);
        const faqs = Array.isArray(data.donorFaq)
          ? data.donorFaq.map((item, index) => ({ id: `ai-faq-${index + 1}`, question: item.question, answer: item.answer, aiGenerated: true }))
          : parseCampaignFaqs(previous.faqsJson);
        const milestones = Array.isArray(data.milestones)
          ? data.milestones.map((item, index) => ({ id: `ai-milestone-${index + 1}`, title: item.title, description: item.description, targetCents: item.targetCents }))
          : parseCampaignMilestones(previous.milestonesJson);
        const generatedTitle = typeof data.title === 'string' ? data.title : previous.title;
        const summary = typeof data.summary === 'string'
          ? data.summary
          : typeof data.socialCaption === 'string' ? data.socialCaption : previous.tagline;
        return {
          ...previous,
          title: previous.title || generatedTitle,
          tagline: previous.tagline || summary,
          description: (!forceStory && previous.description.length > 80)
            ? previous.description
            : typeof data.story === 'string' ? data.story : previous.description,
          category,
          goal: previous.goal.trim() || (typeof data.suggestedGoalCents === 'number' ? String(data.suggestedGoalCents / 100) : previous.goal),
          useOfFundsJson: stringifyBuilderItems(useOfFunds),
          donationTiersJson: stringifyBuilderItems(donationTiers),
          faqsJson: stringifyBuilderItems(faqs),
          milestonesJson: stringifyBuilderItems(milestones),
          seoTitle: previous.seoTitle || data.seoTitle || generatedTitle.slice(0, 60),
          seoDescription: previous.seoDescription || data.seoDescription || summary.slice(0, 160),
          socialTitle: previous.socialTitle || generatedTitle,
          socialDescription: previous.socialDescription || data.socialCaption || summary,
          coverImageGuidance: previous.coverImageGuidance || data.coverImageGuidance || '',
        };
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const aiSeededRef = useRef(false);
  useEffect(() => {
    if (aiSeededRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const intake = parseAiCampaignIntake(sessionStorage.getItem(AI_INTAKE_SESSION_KEY));
    const prompt = intake?.prompt ?? params.get('ai') ?? '';
    if (!prompt.trim()) return;
    aiSeededRef.current = true;
    setBuilderPath('ai');
    const seed = prompt.trim().slice(0, 4000);
    const fields = extractCampaignFields(seed);
    const sourceLinks = intake?.links ?? [];
    setForm((previous) => ({
      ...previous,
      aiPrompt: seed,
      description: previous.description.trim().length > seed.length ? previous.description : seed,
      category: fields.category ?? previous.category,
      goal: previous.goal.trim() || (fields.goalCents ? String(fields.goalCents / 100) : previous.goal),
      sourceLinksJson: stringifyBuilderItems(sourceLinks.map((url, index) => ({ id: `source-link-${index + 1}`, url }))),
    }));
    void (async () => {
      const cachedFiles = intake ? await loadCachedAiIntakeFiles(intake.files.map((file) => file.id)) : [];
      if (cachedFiles.length > 0) setPendingIntakeFiles(cachedFiles);
      const textContext = await Promise.all(cachedFiles
        .filter((file) => file.type === 'text/plain')
        .slice(0, 2)
        .map(async (file) => `${file.name}: ${(await file.text()).slice(0, 1200)}`));
      const contextNotes = [
        seed,
        sourceLinks.length > 0 ? `Helpful links: ${sourceLinks.join(', ')}` : '',
        intake?.files.length ? `Attached files: ${intake.files.map((file) => file.name).join(', ')}` : '',
        ...textContext,
      ].filter(Boolean).join('\n').slice(0, 4000);
      await runAi(contextNotes, undefined, false, {
        category: fields.category ?? 'Community',
        goalCents: fields.goalCents ?? 500000,
        sourceLinks,
        sourceDocuments: intake?.files.map((file) => file.name) ?? [],
      });
      setStep('beneficiary');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitCampaign = async (status: 'draft' | 'active') => {
    // Any requirement that fails here also sends the organizer back to the step
    // that owns it — an error on the Review screen is otherwise a dead end.
    if (form.title.trim().length < 3) {
      setError('Campaign title must be at least 3 characters.');
      setStep('purpose');
      return;
    }
    if (status === 'active') {
      if (form.description.trim().length < 20) {
        setError('Campaign story must be at least 20 characters.');
        setStep('story');
        return;
      }
      if (goalCents < 100) {
        setError(`Fundraising goal must be at least ${formatMoneyShort(100, form.currency)}.`);
        setStep('goal');
        return;
      }
      if (!readiness.readyToPublish) {
        const firstMissing = readiness.missingRequired[0];
        setError(firstMissing?.hint ?? 'Complete every required launch item before publishing.');
        if (firstMissing) setStep(firstMissing.step);
        return;
      }
    }
    setLoading(true); setError('');
    try {
      const location = form.zipCode ? `${form.zipCode} - ${form.country}` : form.country;
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          tagline: form.tagline.trim() || undefined,
          description: form.description.trim() || 'Draft — story coming soon.',
          // Send the real figure. A draft may legitimately have no goal yet (0);
          // coercing it to one currency unit wrote a number the organizer never chose, which then
          // rode along if they later published from the dashboard.
          goalAmount: goalCents,
          deadline: form.deadline || null,
          category: form.category,
          coverImageUrl: form.coverImageUrl || null,
          videoUrl: form.videoUrl.trim() || null,
          imageUrls: uploadedImages.filter(img => img.status === 'done').map(img => img.url),
          beneficiaryName: form.beneficiaryName.trim() || undefined,
          beneficiaryRelationship: form.beneficiaryRelationship.trim() || undefined,
          location,
          status,
          campaignPath: form.campaignPath || 'personal',
          builderPath: builderPath ?? 'guided',
          beneficiaryType: form.forSelf === 'true' ? 'self' : form.campaignPath === 'nonprofit' ? 'organization' : 'other',
          currency: form.currency,
          useOfFunds: parseUseOfFunds(form.useOfFundsJson),
          donationTiers: parseDonationTiers(form.donationTiersJson),
          faqs: parseCampaignFaqs(form.faqsJson),
          milestones: parseCampaignMilestones(form.milestonesJson),
          sourceLinks: parseSourceLinks(form.sourceLinksJson),
          sourceDocuments: parseSourceDocuments(form.sourceDocumentsJson),
          media: uploadedImages
            .filter((image) => image.status === 'done')
            .map((image, index) => ({
              mediaType: 'image',
              storagePath: image.id,
              publicUrl: image.url,
              altText: index === 0 ? `Cover image for ${form.title.trim()}` : `Campaign image ${index + 1} for ${form.title.trim()}`,
            })),
          allowRecurring: form.recurringEnabled === 'true',
          allowAnonymous: form.anonymousEnabled === 'true',
          visibility: form.visibility,
          acceptDonations: form.acceptDonations === 'true',
          seoTitle: form.seoTitle.trim() || undefined,
          seoDescription: form.seoDescription.trim() || undefined,
          socialTitle: form.socialTitle.trim() || undefined,
          socialDescription: form.socialDescription.trim() || undefined,
          coverImageGuidance: form.coverImageGuidance.trim() || undefined,
          policyAccepted: form.policyAccepted === 'true',
          schemaVersion: CAMPAIGN_BUILDER_SCHEMA_VERSION,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Never surface a raw API/database string to an organizer mid-publish.
        setError(describePublishFailure(data?.error, res.status).message);
        return;
      }
      // Persisted to Supabase — the local recovery copy is no longer needed.
      clearDraft();
      trackBuilder(status === 'draft' ? 'save_draft' : 'publish', step);
      if (status === 'draft') { setError(''); window.location.href = '/dashboard/campaigns'; return; }
      if (typeof window !== 'undefined') localStorage.removeItem('charitme-builder-session');
      setPublishedSlug(typeof data.slug === 'string' ? data.slug : '');
      const newId = typeof data.id === 'string' ? data.id : '';
      setPublishedId(newId);
      // Rewards are written now that a campaign id exists.
      //
      // ⚠️ Deliberately AFTER the success state is committed and never allowed to
      // throw into the publish path. The campaign is live at this point; a failed
      // reward write must not surface as a failed publish, because the obvious
      // response to that — press Publish again — would create a second campaign.
      const payloads = toRewardPayloads(draftRewards);
      if (newId && payloads.length > 0) {
        const results = await Promise.allSettled(
          payloads.map((payload) =>
            fetch(`/api/campaigns/${encodeURIComponent(newId)}/rewards`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }).then((r) => {
              if (!r.ok) throw new Error(String(r.status));
              return r;
            }),
          ),
        );
        const saved = results.filter((r) => r.status === 'fulfilled').length;
        setRewardSyncNotice(summarizeRewardSync(payloads.length, saved) ?? '');
      }
      setStep('publish');
    } catch (e: unknown) {
      // Network/transport failure — the draft is still saved locally and remotely.
      setError(describePublishFailure(e instanceof Error ? e.message : '').message);
    } finally {
      setLoading(false);
    }
  };

  const publish = () => submitCampaign('active');
  const saveAndExit = async (): Promise<void> => {
    setError('');
    const saved = await persistWizardDraft();
    if (!saved) {
      setError('Your draft is safe on this device, but it could not sync to your account. Try again before exiting.');
      return;
    }
    window.location.assign(isGuest === false ? '/dashboard/campaigns' : '/');
  };

  const payoutLinked = Boolean(
    payoutAccountState?.stripe_account_id
      && payoutAccountState.payouts_enabled
      && payoutAccountState.charges_enabled
      && payoutAccountState.details_submitted
      && payoutAccountState.verification_status === 'verified',
  );
  const stepForReadiness = (readinessStep: ReadinessStep): WizardStep => readinessStep;

  const useOfFunds = parseUseOfFunds(form.useOfFundsJson);
  const useOfFundsComplete = useOfFunds.length > 0
    && useOfFunds.every((item) => Boolean(item.label.trim()) && item.amountCents > 0)
    && totalUseOfFunds(useOfFunds) === goalCents;

  const readiness = publishReadiness({
    title: form.title,
    description: form.description,
    goalCents,
    currency: form.currency,
    category: form.category,
    country: form.country,
    coverImageUrl: form.coverImageUrl,
    forSelf: form.forSelf,
    beneficiaryName: form.beneficiaryName,
    beneficiaryRelationship: form.beneficiaryRelationship,
    payoutLinked,
    useOfFundsComplete,
    organizerComplete: isGuest === false && Boolean(userName?.trim()),
    verificationComplete: identityVerified
      && (form.campaignPath !== 'nonprofit' || nonprofitVerified),
    policyAccepted: form.policyAccepted === 'true',
  });

  const connectStripe = async () => {
    setConnectingStripe(true); setError('');
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' });
      const text = await res.text();
      const data = (text ? JSON.parse(text) : {}) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Could not start Stripe onboarding. Ensure STRIPE_SECRET_KEY is set in Vercel.');
      window.location.href = data.url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect Stripe.');
      setConnectingStripe(false);
    }
  };

  const journeyState = (i: number): 'done' | 'active' | '' => {
    if (i === 0) return 'done';
    if (i === 1) return stepIdx <= 6 ? 'active' : 'done';
    if (i === 2) { if (step === 'publish') return 'done'; if (step === 'review') return 'active'; return ''; }
    return '';
  };

  const heroCopy: Record<string, { title: string; sub: string }> = {
    purpose: { title: 'Name Your Campaign', sub: 'Give donors a clear reason to care at a glance.' },
    beneficiary: { title: 'Choose the Beneficiary', sub: 'Tell us who receives the support and who is organizing it.' },
    plan: { title: 'Plan the Funds', sub: 'Show donors exactly how their support will be used.' },
    settings: { title: 'Choose Settings', sub: 'Set donor options, FAQs, milestones, and search previews.' },
    verify: { title: 'Confirm Verification', sub: 'Complete the trust checks required for this campaign type.' },
    review: { title: 'Preview and Readiness', sub: 'Resolve anything blocking a safe production launch.' },
    type:     { title: 'Start Your Fundraiser',    sub: 'Tell us who you\'re raising funds for.' },
    category: { title: 'Pick a Category',           sub: 'Choose the category that best fits your cause — it helps donors find you.' },
    location: { title: 'Where Are You Located?',   sub: 'We use your location to connect you with local donors and comply with fundraising laws.' },
    story:    { title: 'Tell Your Story',           sub: 'Write a compelling story — campaigns with great stories raise 3× more.' },
    title:    { title: 'Name Your Campaign',        sub: 'A great title helps donors understand your cause at a glance.' },
    goal:     { title: 'Set Your Goal',             sub: 'Set a fundraising goal. You can always adjust it later from your dashboard.' },
    media:    { title: 'Add Photos',                sub: 'Campaigns with photos raise 3× more than text-only campaigns.' },
    payout:   { title: 'Get Paid',                 sub: 'Connect your payout account so donations reach you directly — 0% platform fee.' },
    summary:  { title: 'Ready to Launch',           sub: 'Review your campaign and hit launch when you\'re ready!' },
  };

  const currentHero = heroCopy[step] ?? { title: 'Create Your Campaign', sub: '' };

  const suggestedPhotos = SUGGESTED_PHOTOS[form.category] ?? SUGGESTED_PHOTOS.default ?? [];

  if (builderPath === null) {
    return (
      <CampaignPathChoice
        onGuidedStart={() => {
          titleSeededRef.current = true;
          setForm((previous) => previous.title.trim()
            ? previous
            : { ...previous, title: suggestCampaignTitle(previous) });
          window.history.replaceState({}, '', '/create?path=guided');
          setBuilderPath('guided');
        }}
      />
    );
  }

  // ─────────────────────────────────────────────
  return (
    <CharitMeShell active="My Campaigns" userName={userName} userEmail={userEmail} userAvatarUrl={userAvatarUrl} guestMode={isGuest !== false} hideSidebar>

      {/* ── F8: choose among several in-flight drafts ── */}
      {showDraftPicker && draftList.length > 1 && step !== 'publish' && (
        <div role="region" aria-label="Choose a draft to continue" style={{ background: 'var(--s2, #f5f7fb)', borderBottom: '1px solid var(--b1, #e8ecf4)', padding: '16px 18px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--t1, #1a1a2e)', marginBottom: 2 }}>
              You have {draftList.length} campaigns in progress
            </div>
            <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 12 }}>
              Pick up where you left off, or start something new. Nothing is published until you say so.
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {draftList.map((d) => (
                <li key={d.id} style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--t1, #1a1a2e)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.title?.trim() || 'Untitled campaign'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                      {WIZARD_STEPS.find((w) => w.key === normalizeStep(d.step))?.label ?? 'In progress'}
                      {d.imageCount > 0 && ` · ${d.imageCount} photo${d.imageCount === 1 ? '' : 's'}`}
                      {` · saved ${draftAgeLabel(new Date(d.updated_at).getTime())}`}
                    </div>
                  </div>
                  <button type="button" onClick={() => void openDraft(d.id)}
                    style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'var(--violet, #6c35ff)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    Continue
                  </button>
                  <button type="button" onClick={() => void deleteDraft(d.id)} aria-label={`Delete draft ${d.title?.trim() || 'Untitled campaign'}`}
                    style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--b2, #d7dced)', background: 'transparent', color: 'var(--t3)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', minWidth: 0, gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button type="button" onClick={startNewDraft}
                style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--violet, #6c35ff)', background: 'transparent', color: 'var(--violet, #6c35ff)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                + Start another campaign
              </button>
              <button type="button" onClick={() => setShowDraftPicker(false)}
                style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--t3)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Draft recovery banner ── */}
      {recoverableDraft && step !== 'publish' && (
        <div role="region" aria-label="Resume unfinished campaign" style={{ background: 'linear-gradient(135deg, var(--violet), var(--violet-2))', color: '#fff', padding: '14px 18px', display: 'flex', minWidth: 0, flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <span style={{ fontSize: 20 }} aria-hidden>↩️</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            Welcome back — pick up where you left off?
          </span>
          <span style={{ fontSize: 13, opacity: .9 }}>Saved {draftAgeLabel(recoverableDraft.ts)}</span>
          <div style={{ display: 'flex', minWidth: 0, gap: 8 }}>
            <button type="button" onClick={resumeDraft} style={{ background: 'var(--s1, #fff)', color: 'var(--brand-text)', border: 0, borderRadius: 999, padding: '8px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Resume
            </button>
            <button type="button" onClick={dismissDraft} style={{ background: 'rgba(255,255,255,.18)', color: '#fff', border: '1px solid rgba(255,255,255,.4)', borderRadius: 999, padding: '8px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Start fresh
            </button>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {showPreviewModal && (
        <CampaignPreviewModal
          form={form}
          coverImageUrl={form.coverImageUrl}
          imageCount={uploadedImages.filter(i => i.status === 'done').length}
          goalCents={goalCents}
          organizerName={userName?.trim() || ''}
          identityVerified={identityVerified}
          nonprofitVerified={nonprofitVerified}
          payoutLinked={payoutLinked}
          onGoToStep={(s) => setStep(stepForReadiness(s))}
          onClose={() => setShowPreviewModal(false)}
          onLaunch={() => {
            setShowPreviewModal(false);
            if (isGuest !== false) { setLoginIntent('publish'); setShowLoginModal(true); } else { void publish(); }
          }}
          launching={loading}
          canLaunch={readiness.readyToPublish}
        />
      )}

      {/* ── Gradient Hero Banner ── */}
      {step !== 'publish' && (
        <div className="cr2-hero">
          <div className="cr2-hero-glow" />
          <div className="cr2-hero-inner">
            <div className="cr2-hero-top">
              <Link href="/dashboard/campaigns" className="cr2-back-link">← My Campaigns</Link>
              <div className="cr2-step-badge">
                Step {stepPosition(step).index} / {stepPosition(step).total}
                {stepIdx >= 0 && (
                  // Answer "how much longer?" up front — an unknown remaining
                  // cost is its own reason to abandon.
                  <span style={{ marginLeft: 8, opacity: 0.75, fontWeight: 600 }}>
                    · about {minutesRemaining(step)} min left
                  </span>
                )}
                {saveState !== 'idle' && (
                  <span
                    title={saveState === 'error' ? 'Saved on this device; account sync needs attention' : 'Campaign draft save status'}
                    style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, opacity: .85 }}
                  >
                    {saveState === 'saving' ? ' · Saving...'
                      : saveState === 'error' ? ' · Saved on this device'
                        : ' · ✓ Saved'}
                  </span>
                )}
              </div>
              <Link href="/ai-campaign" className="cr2-ai-hero-cta">
                <KFIcon name="send" /> Use AI Instead
              </Link>
            </div>
            <h1 className="cr2-hero-title">{currentHero.title}</h1>
            <p className="cr2-hero-sub">{currentHero.sub}</p>
          </div>
        </div>
      )}

      <div className="cr2-page">

        {/* ── Step Progress Track ── */}
        {step !== 'publish' && (
          <div className="cr2-track-wrap">
            <div className="cr2-track">
              {WIZARD_STEPS.filter((item) => !CAMPAIGN_STEP_META[item.key].postPublish).map((s, i) => {
                const isDone   = i < stepIdx;
                const isActive = s.key === step;
                return (
                  <React.Fragment key={s.key}>
                    {i > 0 && <div className={`cr2-track-line${isDone ? ' done' : ''}`} />}
                    <button
                      type="button"
                      className={`cr2-track-item${isActive ? ' active' : isDone ? ' done' : ''}`}
                      onClick={() => isDone && setStep(s.key)}
                      disabled={!isDone && !isActive}
                    >
                      <div className="cr2-track-dot">{isDone ? '✓' : s.num}</div>
                      <span className="cr2-track-label">{s.label}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Main Layout ── */}
        {!CAMPAIGN_STEP_META[step].postPublish ? (
          <div className="cr2-layout">

            {/* ─── Left: wizard form card ─── */}
            <section className="cr2-form-card">

              {/* AI banner — story step only */}
              {step === 'purpose' && (
                <div className="cr2-title-panel">
                  <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
                    <h2 className="cr2-step-q" style={{ padding: 0, margin: 0 }}>Give your fundraiser a Title</h2>
                    <button
                      type="button"
                      className="cr2-ai-suggest"
                      onClick={async () => {
                        setAiLoading(true);
                        try {
                          const res = await fetch('/api/ai/campaign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: form.category, goalAmount: goalCents || 500000, currency: form.currency, beneficiary: form.beneficiaryName || 'the beneficiary', notes: form.description?.trim() || 'Help us write a compelling fundraiser.', tone: 'authentic' }) });
                          const data = await res.json() as { title?: string; error?: string };
                          if (!res.ok) throw new Error(data.error ?? 'AI title improvement failed.');
                          if (!data.title?.trim()) throw new Error('AI did not return a title.');
                          upd('title', data.title.slice(0, 80));
                        } catch (cause: unknown) {
                          setError(cause instanceof Error ? cause.message : 'AI title improvement failed.');
                        } finally { setAiLoading(false); }
                      }}
                      disabled={aiLoading}
                    >
                      {aiLoading ? '✨ Thinking…' : '✨ AI improve'}
                    </button>
                  </div>

                  <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--t3)', lineHeight: 1.5 }}>
                    We&rsquo;ve suggested a title from your story — edit it, or tap <strong>AI improve</strong> for a polished version.
                  </p>

                  <div className="cr2-title-input-wrap">
                    <input
                      type="text"
                      aria-label="Campaign title"
                      className="cr2-title-big"
                      ref={titleInputRef}
                      value={form.title}
                      onChange={e => upd('title', e.target.value.slice(0, 80))}
                      placeholder="Donate to help..."
                      maxLength={80}
                      aria-invalid={errorField === 'title' || undefined}
                      aria-describedby={errorField === 'title' ? BUILDER_ERROR_ID : undefined}
                    />
                    <span className={`cr2-char-count${form.title.length > 70 ? ' warn' : ''}`}>
                      {form.title.length}/80
                    </span>
                  </div>
                  {error && <div id={BUILDER_ERROR_ID} className="cr2-error" role="alert" style={{ margin: '14px 0 0' }}>{error}</div>}
                </div>
              )}

              {step === 'story' && (
                <div className="cr2-ai-banner">
                  <div className="cr2-ai-banner-orb"><KFIcon name="send" /></div>
                  <div className="cr2-ai-banner-text">
                    <strong>AI Copilot</strong>
                    <p>Auto-generate a polished story, title &amp; social captions from your notes.</p>
                  </div>
                  <button type="button" className="cr2-ai-banner-btn" onClick={() => void runAi()} disabled={aiLoading}>
                    {aiLoading ? 'Generating…' : '✨ Write with AI'}
                  </button>
                </div>
              )}

              {step === 'settings' && (
                <div className="cr2-form-panel cb-settings-panel">
                  <CampaignSettingsEditor
                    currency={form.currency}
                    recurringEnabled={form.recurringEnabled === 'true'}
                    anonymousEnabled={form.anonymousEnabled === 'true'}
                    visibility={form.visibility}
                    policyAccepted={form.policyAccepted === 'true'}
                    donationTiers={parseDonationTiers(form.donationTiersJson)}
                    faqs={parseCampaignFaqs(form.faqsJson)}
                    milestones={parseCampaignMilestones(form.milestonesJson)}
                    seoTitle={form.seoTitle}
                    seoDescription={form.seoDescription}
                    socialTitle={form.socialTitle}
                    socialDescription={form.socialDescription}
                    onField={upd}
                    onDonationTiers={(items) => upd('donationTiersJson', stringifyBuilderItems(items))}
                    onFaqs={(items) => upd('faqsJson', stringifyBuilderItems(items))}
                    onMilestones={(items) => upd('milestonesJson', stringifyBuilderItems(items))}
                  />
                  <details className="cb-disclosure">
                    <summary>Optional donor rewards <span>{draftRewards.length}</span></summary>
                    <div className="cb-disclosure-body">
                      <StepRewards
                        rewards={draftRewards}
                        currency={form.currency}
                        onChange={(next) => {
                          setDraftRewards(next);
                          setRewardError(null);
                          upd('rewardsJson', JSON.stringify(next));
                        }}
                        fieldError={rewardError}
                      />
                    </div>
                  </details>
                </div>
              )}

              {/* ── Step: Required verification ── */}
              {step === 'verify' && (
                <StepVerify
                  campaignPath={form.campaignPath}
                  signedIn={isGuest === false}
                  identityVerified={identityVerified}
                  nonprofitVerified={nonprofitVerified}
                />
              )}

              {/* ── Step: Type ── */}
              {(step === 'beneficiary' || step === 'category' || step === 'location') && (
                <div className="cr2-type-panel">
                  {step === 'beneficiary' && (
                    <>
                      <h2 className="cr2-step-q">Who will benefit from this campaign?</h2>

                      <div className="cr2-who-grid">
                        {([
                          { key: 'self', path: 'personal', self: 'true', title: 'Myself', detail: 'The funds support your own need.' },
                          { key: 'other', path: 'personal', self: 'false', title: 'Someone I know', detail: 'A family member, friend, or community member.' },
                          { key: 'nonprofit', path: 'nonprofit', self: 'false', title: 'A registered nonprofit', detail: 'A verified charity, foundation, or community organization.' },
                          { key: 'team', path: 'team', self: 'false', title: 'A team or group', detail: 'A school, club, sports team, or group effort.' },
                        ] as const).map((choice) => (
                          <button
                            key={choice.key}
                            type="button"
                            className={`cr2-who-card${form.campaignPath === choice.path && form.forSelf === choice.self ? ' selected' : ''}`}
                            onClick={() => setForm((current) => ({ ...current, campaignPath: choice.path, forSelf: choice.self }))}
                          >
                            <strong>{choice.title}</strong>
                            <p>{choice.detail}</p>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {step === 'category' && (
                    <>
                      <h2 className="cr2-step-q" style={{ marginTop: 0 }}>What best describes your cause?</h2>

                      <div className="cr2-divider-label">Choose a category</div>
                      <div className="cr2-cat-chips">
                    {CAMPAIGN_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        className={`cr2-cat-chip${form.category === cat ? ' selected' : ''}`}
                        onClick={() => upd('category', cat)}
                      >
                        {cat}
                      </button>
                    ))}
                      </div>
                    </>
                  )}

                  {step === 'location' && (
                    <>
                      <h2 className="cr2-step-q" style={{ marginTop: 0, marginBottom: 22 }}>Where is the beneficiary located?</h2>

                      <div className="cr2-field">
                    <label htmlFor="cr-country">Country</label>
                    <select id="cr-country" value={form.country} onChange={e => upd('country', e.target.value)}>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <a href="/supported-countries" className="cr2-countries-link" target="_blank" rel="noopener noreferrer">
                      Countries we support fundraisers in →
                    </a>
                      </div>

                      <div className="cr2-field">
                    <label htmlFor="cr-zip">ZIP / Postal Code</label>
                    <input
                      id="cr-zip"
                      type="text"
                      value={form.zipCode}
                      onChange={e => upd('zipCode', e.target.value)}
                      placeholder="e.g. 90210"
                      maxLength={12}
                    />
                      </div>
                    </>
                  )}

                  {step === 'beneficiary' && form.forSelf === 'false' && (
                    <>
                      <div className="cr2-field">
                        <label htmlFor="cr-beneficiary-name">
                          {form.campaignPath === 'nonprofit' ? 'Organization Name' : form.campaignPath === 'team' ? 'Team or Group Name' : 'Beneficiary Name'}
                        </label>
                        <input
                          id="cr-beneficiary-name"
                          type="text"
                          value={form.beneficiaryName}
                          onChange={e => upd('beneficiaryName', e.target.value)}
                          placeholder="Jane Smith"
                          maxLength={120}
                        />
                      </div>
                      <div className="cr2-field">
                        <label htmlFor="cr-beneficiary-rel">
                          {form.campaignPath === 'nonprofit' || form.campaignPath === 'team' ? 'Your Role' : 'Your Relationship to Them'}
                        </label>
                        <input
                          id="cr-beneficiary-rel"
                          type="text"
                          value={form.beneficiaryRelationship}
                          onChange={e => upd('beneficiaryRelationship', e.target.value)}
                          placeholder="Sister, friend, colleague…"
                          maxLength={120}
                        />
                      </div>
                    </>
                  )}

                  {step === 'location' && (
                  <div className="cr2-loc-banner">
                    <span>📍</span>
                    <span>CharitMe is where fundraising begins for more than 278 people near you.</span>
                  </div>
                  )}
                </div>
              )}

              {/* ── Step: Story ── */}
              {step === 'story' && (
                <div className="cr2-form-panel">
                  <h2 className="cr2-step-q" style={{ padding: 0, marginBottom: 8 }}>Tell Donors Your Story.</h2>

                  {/* Mode toggle: one open textarea, or a guided four-section builder.
                      Both write the SAME `description` field. */}
                  <div role="tablist" aria-label="Story writing mode" style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 999, background: 'var(--s3, #eef2f7)', marginBottom: 14 }}>
                    {(['freeform', 'guided'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        role="tab"
                        aria-selected={storyMode === mode}
                        onClick={() => setStoryMode(mode)}
                        style={{
                          padding: '7px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                          fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                          background: storyMode === mode ? 'var(--s1, #fff)' : 'transparent',
                          color: storyMode === mode ? 'var(--t1, #1a1a2e)' : 'var(--t3, #64748b)',
                          boxShadow: storyMode === mode ? 'var(--shadow, 0 1px 2px rgba(0,0,0,0.06))' : 'none',
                        }}
                      >
                        {mode === 'freeform' ? 'Write freely' : 'Guide me'}
                      </button>
                    ))}
                  </div>

                  {storyMode === 'freeform' ? (
                    <div className="cr2-field">
                      <label htmlFor="cr-story">Campaign Story * <span className="cr2-optional">— min. 20 characters</span></label>
                      <textarea
                        id="cr-story"
                        ref={storyInputRef}
                        value={form.description}
                        onChange={e => upd('description', e.target.value)}
                        placeholder="Introduce yourself and what you're raising funds for..."
                        style={{ minHeight: 220 }}
                        aria-invalid={errorField === 'description' || undefined}
                        aria-describedby={errorField === 'description' ? BUILDER_ERROR_ID : undefined}
                      />
                    </div>
                  ) : (
                    <StorySectionsEditor
                      key="guided"
                      initialStory={form.description}
                      onCompose={(story) => upd('description', story)}
                      onPickTone={(tone) => void runAi(form.description, tone, true)}
                      aiBusy={aiLoading}
                    />
                  )}

                  {/* Strengthen your story box */}
                  <div className="cr2-strengthen-box">
                    <div className="cr2-strengthen-head">
                      <span className="cr2-strengthen-title">✨ Strengthen your story</span>
                      <span className="cr2-strengthen-words">
                        {form.description.trim().split(/\s+/).filter(Boolean).length < 50
                          ? `${50 - form.description.trim().split(/\s+/).filter(Boolean).length} words needed`
                          : '✓ Good length'}
                      </span>
                    </div>
                    <div className="cr2-strengthen-tags">
                      {analyzeStory(form.description).signals.map((s) => {
                        const style = s.tone === 'good'
                          ? { bg: '#d1fae5', fg: '#065f46', dot: '✅' }
                          : s.tone === 'ok'
                            ? { bg: '#fef9c3', fg: '#713f12', dot: '🟡' }
                            : { bg: '#ffedd5', fg: '#7c2d12', dot: '🟠' };
                        return (
                          <span
                            key={s.id}
                            className="cr2-strengthen-tag"
                            style={{ background: style.bg, color: style.fg }}
                            title={s.detail ?? s.label}
                          >
                            {style.dot} {s.label}
                          </span>
                        );
                      })}
                    </div>
                    <button type="button" className="cr2-strengthen-btn" onClick={() => void runAi()} disabled={aiLoading}>
                      {aiLoading ? 'Enhancing…' : 'Enhance'}
                    </button>
                  </div>

                  {/* AI follow-ups — fill the human facts the AI can't infer, one at
                      a time. Shown once there's a story to build on. */}
                  {form.description.trim().length >= 20 && !aiLoading && (
                    <AiFollowUps form={form} currency={form.currency} onAnswer={(field, value) => upd(field, value)} />
                  )}
                </div>
              )}

              {/* ── Step: Title ── */}

              {/* ── Step: Goal ── */}
              {step === 'goal' && (
                <div className="cr2-form-panel">
                  <h2 className="cr2-step-q" style={{ padding: 0, marginBottom: 8 }}>How much would you like to raise?</h2>

                  {goalGuidance?.available && goalGuidance.lowCents != null && goalGuidance.highCents != null && (
                    <div style={{ margin: '0 0 14px', padding: '12px 14px', borderRadius: 12, background: 'var(--s2, #f5f7fb)', border: '1px solid var(--b1, #e8ecf4)' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--t1, #1a1a2e)' }}>
                        Most {form.category.toLowerCase()} campaigns set{' '}
                        {formatMoneyShort(goalGuidance.lowCents, form.currency)} to {formatMoneyShort(goalGuidance.highCents, form.currency)}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--t3)', marginTop: 4, lineHeight: 1.5 }}>
                        {goalGuidance.note}
                        {goalGuidance.goalHitRate != null && ` About ${Math.round(goalGuidance.goalHitRate * 100)}% reach their goal.`}
                        {' '}A goal you can realistically pass builds momentum — you can raise it later.
                      </div>
                      <div style={{ display: 'flex', minWidth: 0, gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        {[goalGuidance.lowCents, goalGuidance.highCents].map((c, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => upd('goal', String(Math.round((c as number) / 100)))}
                            style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid var(--b2, #d7dced)', background: 'var(--s1, #fff)', color: 'var(--t2, #334064)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Use {formatMoneyShort(c as number, form.currency)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="cr2-field">
                    <label style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Fundraising Goal</span>
                      <button
                        type="button"
                        className="cr2-ai-suggest"
                        onClick={async () => {
                          setAiLoading(true);
                          try {
                            const res = await fetch('/api/ai/goal-recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: form.category, beneficiary: form.beneficiaryName || 'the beneficiary', notes: form.description || undefined }) });
                            const data = await res.json() as { goal_cents?: number };
                            if (data.goal_cents) upd('goal', String(Math.round(data.goal_cents / 100)));
                          } catch { /* silent */ } finally { setAiLoading(false); }
                        }}
                        disabled={aiLoading}
                      >
                        {aiLoading ? '✨ Thinking…' : '✨ AI Suggest'}
                      </button>
                    </label>
                    <div className="cr2-goal-input-row">
                      <span className="cr2-goal-prefix">{currencySymbol(form.currency)}</span>
                      <input
                        type="number"
                        aria-label={`Fundraising goal amount in ${form.currency}`}
                        className="cr2-goal-input"
                        ref={goalInputRef}
                        value={form.goal}
                        onChange={e => upd('goal', e.target.value)}
                        placeholder="10,000"
                        min="1"
                        step="any"
                        aria-invalid={errorField === 'goal' || undefined}
                        aria-describedby={errorField === 'goal' ? BUILDER_ERROR_ID : undefined}
                      />
                      <select
                        className="cr2-goal-suffix"
                        aria-label="Campaign currency"
                        value={form.currency}
                        onChange={(event) => upd('currency', event.target.value)}
                      >
                        {SUPPORTED_CURRENCIES.map((currency) => (
                          <option key={currency.code} value={currency.code}>{currency.code}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="cr2-auto-goal-box">
                    <div className="cr2-auto-goal-head">
                      <span className="cr2-auto-goal-title">⚡ Automated goal setting</span>
                      <label className="cr2-toggle-wrap">
                        <input
                          type="checkbox"
                          className="cr2-toggle-input"
                          checked={form.autoGoal === 'true'}
                          onChange={e => upd('autoGoal', e.target.checked ? 'true' : 'false')}
                        />
                        <span className="sr-only">Automated goal setting</span>
                      </label>
                    </div>
                    <p className="cr2-auto-goal-body">
                      We&apos;ll gradually adjust your goal as donations come in to help build momentum.
                    </p>
                    <p className="cr2-auto-goal-start">
                      Your starting goal would be {formatMoneyShort(Math.round(autoGoalStart * 100), form.currency)}
                    </p>
                  </div>

                  <GoalProceedsBreakdown goalCents={goalCents} currency={form.currency} />
                </div>
              )}

              {/* ── Step: Media ── */}
              {step === 'plan' && (
                <div className="cr2-form-panel">
                  <CampaignPlanEditor
                    goalCents={goalCents}
                    category={form.category}
                    currency={form.currency}
                    items={parseUseOfFunds(form.useOfFundsJson)}
                    onChange={(items) => upd('useOfFundsJson', stringifyBuilderItems(items))}
                  />
                </div>
              )}

              {step === 'media' && (
                <div className="cr2-form-panel">
                  <h2 className="cr2-step-q" style={{ padding: 0, marginBottom: 8 }}>Bring your campaign to life</h2>
                  <p className="cr2-step-help">Add a cover photo for discovery and sharing. You can also add one secure YouTube or Vimeo link.</p>

                  <div className="cr2-field">
                    <div
                      className={`cr2-upload-zone${dragging ? ' dragging' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={e => { e.preventDefault(); setDragging(false); }}
                      onDrop={e => { e.preventDefault(); setDragging(false); handleFileSelect(e.dataTransfer.files); }}
                      onClick={() => fileInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                      aria-label="Upload campaign images"
                    >
                      <input ref={fileInputRef} aria-label="Upload campaign images" type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif" multiple style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files)} onClick={e => { (e.target as HTMLInputElement).value = ''; }} />
                      <div className="cr2-upload-icon"><KFIcon name="upload" /></div>
                      <strong>{dragging ? 'Release to upload' : 'Drop images here or click to browse'}</strong>
                      <span>JPG, PNG, GIF, WebP, AVIF; up to {MAX_IMAGES} images; 5 MB each</span>
                    </div>
                    {uploadError && <p role="alert" style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--red-text)', fontWeight: 700 }}>{uploadError}</p>}
                    {sourceUploadError && <p role="alert" style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--red-text)', fontWeight: 700 }}>{sourceUploadError}</p>}
                  </div>

                  {uploadedImages.length > 0 && (
                    <div>
                      <p className="cr2-label-sm">Uploaded Photos ({uploadedImages.length} / {MAX_IMAGES})</p>
                      <div className="cr2-img-gallery">
                        {uploadedImages.map((img, i) => (
                          <div key={img.id} className={['cr2-img-thumb', i === 0 && img.status === 'done' ? 'cover' : '', img.status === 'uploading' ? 'uploading' : '', img.status === 'error' ? 'img-error' : ''].filter(Boolean).join(' ')}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt={img.name} />
                            {i === 0 && img.status === 'done' && <span className="cr2-cover-badge">Cover</span>}
                            {img.status === 'uploading' && <div className="cr2-thumb-overlay"><div className="cr2-upload-spinner" /></div>}
                            {img.status === 'error' && <div className="cr2-thumb-overlay cr2-thumb-error"><span>Failed</span></div>}
                            <button type="button" className="cr2-img-remove" onClick={e => { e.stopPropagation(); void removeImage(img); }} aria-label={`Remove ${img.name}`}>×</button>
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--t3)', margin: '10px 0 0', lineHeight: 1.45 }}>The first photo becomes your cover image. Remove and re-upload to reorder.</p>
                    </div>
                  )}

                  <div className="cr2-field cr2-video-field">
                    <label htmlFor="campaign-video-url">Video link (optional)</label>
                    <input
                      id="campaign-video-url"
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={form.videoUrl}
                      onChange={(event) => upd('videoUrl', event.target.value)}
                      aria-invalid={Boolean(form.videoUrl.trim() && !parseCampaignVideoUrl(form.videoUrl))}
                      aria-describedby="campaign-video-help"
                    />
                    <span id="campaign-video-help" className="cr2-field-help">
                      HTTPS links from YouTube or Vimeo.
                    </span>
                    {form.videoUrl.trim() && !parseCampaignVideoUrl(form.videoUrl) && (
                      <span className="cr2-field-error" role="alert">Use a supported secure video link.</span>
                    )}
                    {parseCampaignVideoUrl(form.videoUrl) && (
                      <span className="cr2-field-success" role="status">Video link ready for preview.</span>
                    )}
                  </div>

                  {/* Suggested photos */}
                  <div className="cr2-suggested">
                    {/* The ‹ › carousel nav that used to sit here was removed: every
                        suggestion renders at once, so the buttons had nothing to page
                        through and did nothing when clicked — dead controls in the
                        campaign builder, the funnel we are actively de-frictioning.
                        Wiring fake paging would have been worse than deleting them. */}
                    <div className="cr2-suggested-head">
                      <span>Suggested for your story</span>
                    </div>
                    {suggestedPhotos.map((photo, i) => (
                      <div key={i} className="cr2-suggested-item">
                        <span className="cr2-suggested-pin">📷</span>
                        {photo}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Step: Payout ── */}
              {step === 'payout' && (
                <div className="cr2-form-panel">
                  <div className="cr2-payout-header">
                    <span className="cr2-payout-header-label">Stripe payout status</span>
                    {payoutLoading
                      ? <span className="cr2-payout-status-pill checking">Checking...</span>
                      : payoutLinked
                        ? <span className="cr2-payout-status-pill linked">Connected</span>
                        : <span className="cr2-payout-status-pill unlinked">Action required</span>}
                  </div>
                  <h2 className="cr2-step-q">Connect the account that will receive donations</h2>
                  <p className="cr2-step-help">
                    Stripe Connect verifies the recipient and routes each donation directly to the correct account. CharitMe never stores bank credentials.
                  </p>
                  {payoutLinked ? (
                    <div className="cb-payout-ready" role="status">
                      <strong>Payouts are ready</strong>
                      <span>Bank details and identity checks were completed in Stripe.</span>
                    </div>
                  ) : (
                    <button type="button" className="cr2-payout-connect-btn cr2-payout-btn-stripe" onClick={() => void connectStripe()} disabled={connectingStripe || payoutLoading}>
                      {connectingStripe ? 'Opening Stripe...' : 'Complete secure payout setup'}
                    </button>
                  )}

                  {payoutAccountState && !payoutLinked && !payoutLoading && (
                    <div className="cr2-payout-warn" role="status">Stripe onboarding is incomplete. Continue setup to enable payouts.</div>
                  )}
                  <div className="cr2-payout-important">
                    <strong>Production safeguard:</strong> a campaign cannot publish or accept donations until payouts are enabled and recipient details are submitted.
                  </div>
                </div>
              )}

              {/* ── Step: Summary / Review & Launch ── */}
              {step === 'review' && (
                <div className="cr2-launch-panel">
                  <div className="cr2-launch-header">
                    <h2>{readiness.readyToPublish ? 'Ready to publish' : 'Finish launch readiness'}</h2>
                    <p>Review the campaign in every donor context, then resolve any required items.</p>
                  </div>

                  {/* Score bar */}
                  <ScoreBar score={computeScore(form, step, payoutLinked, isGuest)} />

                  {/* Publish-readiness checklist — each item jumps to its step */}
                  <div style={{ margin: '14px 0' }}>
                    <ReadinessChecklist
                      readiness={readiness}
                      onGoToStep={(s) => setStep(stepForReadiness(s))}
                    />
                  </div>

                  <div className="cr2-launch-btns">
                    <button
                      type="button"
                      className="cr2-btn-launch"
                      onClick={() => { if (isGuest !== false) { setLoginIntent('publish'); setShowLoginModal(true); } else { void publish(); } }}
                      disabled={loading || !readiness.readyToPublish}
                    >
                      🚀 {loading ? 'Launching…' : 'LAUNCH'}
                    </button>
                    <button
                      type="button"
                      className="cr2-btn-preview"
                      onClick={() => setShowPreviewModal(true)}
                    >
                      👁 PREVIEW
                    </button>
                  </div>

                  <div className="cr2-review-rows">
                    {/* Cover / Media */}
                    <div className="cr2-review-row">
                      <span className="cr2-review-label">Media</span>
                      <span className="cr2-review-val" style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 10 }}>
                        <div className="cr2-review-cover">
                          {form.coverImageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={form.coverImageUrl} alt="Cover" />
                          )}
                        </div>
                        {hasCover
                          ? parseCampaignVideoUrl(form.videoUrl) ? 'Cover photo and video added' : 'Cover photo added'
                          : 'No photo yet'}
                      </span>
                      <button type="button" className="cr2-review-edit" onClick={() => setStep('media')}>Edit</button>
                    </div>

                    {/* Title */}
                    <div className="cr2-review-row">
                      <span className="cr2-review-label">Title</span>
                      <span className="cr2-review-val">{form.title || <span style={{ color: 'var(--red-text)' }}>Not set</span>}</span>
                      <button type="button" className="cr2-review-edit" onClick={() => setStep('purpose')}>Edit</button>
                    </div>

                    {/* Goal */}
                    <div className="cr2-review-row">
                      <span className="cr2-review-label">Goal</span>
                      <span className="cr2-review-val">
                        {goalCents >= 100 ? formatMoneyShort(goalCents, form.currency) : <span style={{ color: 'var(--red-text)' }}>Not set</span>}
                        {form.autoGoal === 'true' && <span className="cr2-automated-badge">AUTOMATED</span>}
                      </span>
                      <button type="button" className="cr2-review-edit" onClick={() => setStep('goal')}>Edit</button>
                    </div>

                    {/* Location */}
                    <div className="cr2-review-row">
                      <span className="cr2-review-label">Location</span>
                      <span className="cr2-review-val">
                        {form.zipCode ? `${form.zipCode}, ${form.country}` : form.country}
                      </span>
                      <button type="button" className="cr2-review-edit" onClick={() => setStep('location')}>Edit</button>
                    </div>

                    {/* Story */}
                    <div className="cr2-review-row">
                      <span className="cr2-review-label">Story</span>
                      <span className="cr2-review-val">
                        {form.description.length >= 20
                          ? `${form.description.slice(0, 80)}${form.description.length > 80 ? '…' : ''}`
                          : <span style={{ color: 'var(--red-text)' }}>Story too short (min 20 chars)</span>}
                      </span>
                      <button type="button" className="cr2-review-edit" onClick={() => setStep('story')}>Edit</button>
                    </div>
                  </div>

                  <p className="cr2-legal-line">
                    By clicking &apos;Launch fundraiser&apos; you agree to our{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
                    {' '}and{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</a>.
                  </p>
                </div>
              )}

              {/* Error (global, not shown inside title step which has inline) */}
              {error && step !== 'purpose' && <div id={BUILDER_ERROR_ID} className="cr2-error" role="alert">{error}</div>}

              {/* Navigation */}
              <div className="cr2-nav">
                <button type="button" className="cr2-nav-back" onClick={goPrev} disabled={!canGoBack(step)}>← Back</button>
                <div style={{ display: 'flex', minWidth: 0, gap: 10, alignItems: 'center' }}>
                  {step !== 'review' && (
                    <button type="button" className="cr2-nav-draft" onClick={() => void saveAndExit()} disabled={saveState === 'saving'}>
                      {saveState === 'saving' ? 'Saving...' : 'Save & Exit'}
                    </button>
                  )}
                  {step !== 'review' && (
                    <button type="button" className="cr2-nav-next" onClick={goNext}>
                      {isOptionalStep(step) && !stepHasInput ? 'Skip this step →' : 'Continue →'}
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* ─── Right: sidebar ─── */}
            <aside className="cr2-side">
              <ScoreBar score={computeScore(form, step, payoutLinked, isGuest)} />

              <div className="cr2-side-card">
                <div className="cr2-side-head">Tips to Raise More</div>
                <div className="cr2-tips-list">
                  {[
                    { icon: 'chart', tip: 'Campaigns with a specific goal raise 89% more than vague asks.' },
                    { icon: 'send',  tip: 'Sharing in the first 24 hours drives 3× more donations.' },
                    { icon: 'doc',   tip: 'Stories with cover photos raise 3× more than text-only campaigns.' },
                  ].map(({ icon, tip }) => (
                    <div key={tip} className="cr2-tip-item">
                      <div className="cr2-tip-icon"><KFIcon name={icon} /></div>
                      <p>{tip}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="cr2-ai-side-card">
                <div className="cr2-ai-side-title">AI Copilot <span className="cr2-ai-side-badge">Free</span></div>
                <p className="cr2-ai-side-body">On the story step, use AI to automatically generate a polished story, title, and social captions from your notes.</p>
              </div>
            </aside>
          </div>

        ) : step === 'publish' ? (
          <div className="cr2-success">
            <div className="cr2-success-icon"><KFIcon name="check" /></div>
            <h2>🎉 Your Campaign is Live!</h2>
            <p>
              {payoutLinked
                ? 'Congratulations! Your fundraiser is now live and ready to receive donations. Share it everywhere to reach your goal faster.'
                : 'Congratulations! Your fundraiser is now live and shareable. One last step to start receiving donations: connect a payout method.'}
            </p>
            {/* A reward that did not save. Phrased as a live campaign with an
                outstanding task, never as a publish to retry. */}
            {rewardSyncNotice && (
              <div
                role="status"
                style={{ margin: '0 auto 22px', maxWidth: 460, padding: '14px 16px', borderRadius: 14, background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.35)', textAlign: 'left', fontSize: 13.5, lineHeight: 1.5, color: 'var(--t2)' }}
              >
                {rewardSyncNotice}
              </div>
            )}
            {!payoutLinked && (
              <div style={{ margin: '0 auto 22px', maxWidth: 460, padding: '16px 18px', borderRadius: 14, background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.35)', textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, color: 'var(--t1)' }}>🏦 Finish payout setup to get paid</div>
                <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--t2)', margin: '0 0 12px' }}>
                  Your campaign is visible and shareable now. Donations can be collected once your payout account is connected — it takes about 2 minutes.
                </p>
                <button type="button" className="cr2-btn-launch" style={{ width: '100%' }} onClick={() => void connectStripe()} disabled={connectingStripe}>
                  {connectingStripe ? 'Redirecting…' : 'Set up payouts →'}
                </button>
              </div>
            )}
            {publishedId && <FeatureUpsell campaignId={publishedId} />}

            <div className="cr2-launch-actions">
              {publishedSlug && (
                <Link href={`/campaigns/${publishedSlug}`} className="cr2-launch-view" style={{ textDecoration: 'none' }}>
                  <KFIcon name="send" /> View Live Campaign
                </Link>
              )}
              <Link href="/dashboard/campaigns" className="cr2-launch-manage" style={{ textDecoration: 'none' }}>
                Manage Campaigns
              </Link>
            </div>

            {/* Sharing immediately after launch is the strongest next action. */}
            {publishedSlug && (
              <button
                type="button"
                className="cr2-btn-launch"
                style={{ marginTop: 28 }}
                onClick={() => setStep('share')}
              >
                Next: get your first donors →
              </button>
            )}
          </div>
        ) : (
          <div className="cr2-success">
            <h2>Get your first donors</h2>
            <p>
              Campaigns that get their first donation within 24 hours raise far more than those
              that do not. Share it with a handful of people who already know you before you post
              it anywhere public — early donations are what make later ones feel safe.
            </p>
            {publishedSlug && (
              <div style={{ marginTop: 24 }}>
                <QuickSharePanel slug={publishedSlug} campaignId={publishedId} />
              </div>
            )}
            <div className="cr2-launch-actions" style={{ marginTop: 28 }}>
              {publishedSlug && (
                <Link href={`/campaigns/${publishedSlug}`} className="cr2-launch-view" style={{ textDecoration: 'none' }}>
                  <KFIcon name="send" /> View Live Campaign
                </Link>
              )}
              <Link href="/dashboard/campaigns" className="cr2-launch-manage" style={{ textDecoration: 'none' }}>
                Manage Campaigns
              </Link>
            </div>
          </div>
        )}

        {/* ── Journey bar ── */}
        <div className="kf-journey-bar">
          {JOURNEY_STEPS.map((jStep, i) => {
            const state = journeyState(i);
            return (
              <div key={jStep} className={`kf-journey-item${state ? ` ${state}` : ''}`}>
                <div className="ji-dot" />
                {jStep}
              </div>
            );
          })}
        </div>

      </div>

      {/* ── Guest login modal ── */}
      {showLoginModal && (
        <GuestLoginModal
          savedForm={form}
          savedStep={step}
          savedImages={uploadedImages.filter(i => i.status === 'done').map(i => ({ url: i.url, name: i.name, storagePath: i.id }))}
          savedStoryMode={storyMode}
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => {
            setIsGuest(false);
            setShowLoginModal(false);
            // Only publish when publishing is what they were doing. Signing in
            // to attach a photo leaves them exactly where they were, with the
            // draft intact, to pick the file again.
            if (loginIntent === 'publish') void publish();
          }}
        />
      )}
    </CharitMeShell>
  );
}

// ─────────────────────────────────────────────
// Guest Login Modal
// ─────────────────────────────────────────────
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.34.07 2.27.74 3.04.8.96-.2 1.88-.89 3.17-.85 1.37.06 2.4.59 3.08 1.5-2.76 1.68-2.3 5.42.34 6.46-.54 1.5-1.23 2.95-1.63 4.97zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}

function GuestLoginModal({ onClose, onSuccess, savedForm, savedStep, savedImages, savedStoryMode }: {
  onClose: () => void;
  onSuccess: () => void;
  savedForm: FormState;
  savedStep: WizardStep;
  savedImages: { url: string; name: string; storagePath: string }[];
  savedStoryMode: string;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  // The gate that interrupts the builder (Location step) needs different copy
  // from the ordinary sign-in entry point.
  const midWizard = savedStep !== 'purpose';
  // Keyboard parity for the backdrop click-to-close: Escape closes the modal.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const [modalMode, setModalMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail]   = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]     = useState('');
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState('');
  const [ok, setOk]         = useState('');

  const handleOAuth = (provider: 'google' | 'apple') => {
    // Carry images + story mode through the OAuth bounce too — restoring only the
    // text used to drop every upload (and then blank coverImageUrl on return).
    sessionStorage.setItem('cm_wizard', JSON.stringify({ savedForm, savedStep, savedImages, savedStoryMode }));
    window.location.href = `/api/auth/signin?provider=${provider}&next=/create`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(''); setOk('');
    try {
      if (modalMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
        if (error) throw error;
        setOk('Check your email to confirm, then sign in below.');
        setModalMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess();
      }
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="guest-modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="guest-modal-card" role="dialog" aria-modal="true">
        <button className="guest-modal-close" onClick={onClose} aria-label="Close">✕</button>
        <h2>{midWizard ? 'Save your progress' : modalMode === 'login' ? 'Log in' : 'Sign up'}</h2>
        <p className="guest-modal-sub">
          {midWizard
            // Explain the interruption. An unexplained gate mid-flow reads as a
            // paywall; naming the benefit (work is kept, campaign is yours) and
            // the cost (free, nothing published yet) is what keeps people going.
            ? 'Your campaign is saved to your account so you can finish it on any device. It stays private until you choose to publish — creating an account is free.'
            : modalMode === 'login' ? 'Continue to your dashboard.' : 'Create your free account to launch.'}
        </p>
        <button className="guest-oauth-btn" onClick={() => handleOAuth('google')} disabled={busy} type="button">
          <GoogleMark /> Continue with Google
        </button>
        <button className="guest-oauth-btn guest-oauth-apple" onClick={() => handleOAuth('apple')} disabled={busy} type="button" style={{ background: '#000', color: '#fff', marginTop: 8 }}>
          <AppleMark /> Continue with Apple
        </button>
        <div className="guest-modal-sep"><span>OR</span></div>
        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {modalMode === 'signup' && (
            <label className="guest-modal-label">Full name<input value={name} onChange={e => setName(e.target.value)} placeholder="Sarah Thompson" required autoComplete="name" /></label>
          )}
          <label className="guest-modal-label">Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label>
          <label className="guest-modal-label">Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required minLength={6} autoComplete={modalMode === 'login' ? 'current-password' : 'new-password'} /></label>
          {err && <p role="alert" style={{ margin: 0, color: 'var(--red-text)', fontSize: 13, fontWeight: 700 }}>{err}</p>}
          {ok  && <p style={{ margin: 0, color: 'var(--green-text)', fontSize: 13, fontWeight: 700 }}>{ok}</p>}
          <button className="guest-modal-submit" type="submit" disabled={busy}>
            {busy ? 'Working…' : modalMode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        <p className="guest-modal-switch">
          {modalMode === 'login' ? 'Need an account?' : 'Already have an account?'}{' '}
          <button type="button" onClick={() => { setModalMode(m => m === 'login' ? 'signup' : 'login'); setErr(''); setOk(''); }}>
            {modalMode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// CharitMe Score
// ─────────────────────────────────────────────
type ScoreState = 'pending' | 'watch' | 'verified';

interface ScoreResult {
  total: number;
  identity: ScoreState;
  beneficiary: ScoreState;
  payout: ScoreState;
  storyQuality: ScoreState;
  evidence: ScoreState;
}

function computeScore(form: FormState, step: WizardStep, payoutLinked: boolean, isGuest: boolean | null): ScoreResult {
  // ⚠️ This used to carry its own hand-written copy of the step order, which had
  // already drifted out of sync with the real one. The thresholds are now named
  // steps resolved against the single list in campaign-flow-core, so reordering
  // the flow cannot silently change what this score means.
  const reached = (target: WizardStep) =>
    CAMPAIGN_STEPS.indexOf(step) >= CAMPAIGN_STEPS.indexOf(target);

  const identity: ScoreState   = isGuest === false ? 'verified' : (reached('beneficiary') ? 'watch' : 'pending');
  const beneficiary: ScoreState = form.description.length > 200 ? 'verified'
    : form.description.length > 50 ? 'watch' : 'pending';
  const payout: ScoreState     = payoutLinked ? 'verified' : (reached('publish') ? 'watch' : 'pending');
  const storyQuality: ScoreState = form.description.length > 400 ? 'verified'
    : form.description.length > 100 ? 'watch' : 'pending';
  const evidence: ScoreState   = form.coverImageUrl ? 'verified' : (reached('review') ? 'watch' : 'pending');

  const pts = { pending: 0, watch: 10, verified: 20 };
  const total = pts[identity] + pts[beneficiary] + pts[payout] + pts[storyQuality] + pts[evidence];
  return { total, identity, beneficiary, payout, storyQuality, evidence };
}

function scoreLabel(total: number) {
  if (total >= 90) return 'Excellent';
  if (total >= 70) return 'Strong';
  if (total >= 50) return 'Looking Good';
  if (total >= 30) return 'Building Up';
  return 'Needs Attention';
}

function scoreColor(total: number) {
  if (total >= 70) return 'var(--green-text)';
  if (total >= 50) return 'var(--orange-text)';
  return 'var(--red-text)';
}

function ScorePill({ state, label }: { state: ScoreState; label: string }) {
  const icon  = state === 'verified' ? '✓' : state === 'watch' ? '⚠' : '○';
  const cls   = `cr2-score-pill cr2-score-pill-${state}`;
  // Colour comes from --score-* tokens keyed off the state class, not an inline hex.
  // A single hardcoded value cannot satisfy AA on both a light pill and a dark one —
  // these measured 2.56:1 as inline hex, in BOTH themes.
  return (
    <div className={cls}>
      <span className="cr2-score-pill-icon">{icon}</span>
      <div>
        <div className="cr2-score-pill-label">{label}</div>
        <div className="cr2-score-pill-status">
          {state === 'verified' ? 'Verified' : state === 'watch' ? 'Watch' : 'Pending'}
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: ScoreResult }) {
  const c = scoreColor(score.total);
  const circumference = 2 * Math.PI * 22;
  const dashOffset = circumference * (1 - score.total / 100);
  return (
    <div className="cr2-score-card">
      <div className="cr2-score-top">
        <div className="cr2-score-gauge">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="22" fill="none" stroke="var(--b2)" strokeWidth="6" />
            <circle
              cx="32" cy="32" r="22" fill="none"
              stroke={c} strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 32 32)"
              style={{ transition: 'stroke-dashoffset .6s ease' }}
            />
          </svg>
          <div className="cr2-score-num" style={{ color: c }}>{score.total}</div>
        </div>
        <div className="cr2-score-right">
          <div className="cr2-score-title">CharitMe Score</div>
          <div className="cr2-score-status" style={{ color: c }}>{scoreLabel(score.total)}</div>
        </div>
      </div>
      <div className="cr2-score-pills">
        <ScorePill state={score.identity}     label="Identity" />
        <ScorePill state={score.beneficiary}  label="Beneficiary" />
        <ScorePill state={score.payout}       label="Payout Destination" />
        <ScorePill state={score.storyQuality} label="Story Quality" />
        <ScorePill state={score.evidence}     label="Evidence" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Quick Share Panel
// ─────────────────────────────────────────────
function QuickSharePanel({ slug, campaignId }: { slug: string; campaignId: string }) {
  const appUrl = (typeof window !== 'undefined' ? window.location.origin : 'https://www.charitme.com');
  const url = `${appUrl}/campaigns/${slug}`;
  const [copied, setCopied] = React.useState(false);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); }
    catch { const i = document.createElement('input'); i.value = url; document.body.appendChild(i); i.select(); document.execCommand('copy'); document.body.removeChild(i); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&color=6c35ff&data=${encodeURIComponent(url)}`;

  const shareLinks = [
    { label: 'Facebook',  href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, icon: '𝗳', bg: '#1877f2' },
    { label: 'Messenger', href: `https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&redirect_uri=${encodeURIComponent(url)}`, icon: 'm', bg: '#0084ff' },
    { label: 'LinkedIn',  href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, icon: 'in', bg: '#0a66c2' },
    { label: 'X / Twitter', href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Support my campaign on CharitMe!')}`, icon: '𝕏', bg: '#000' },
    { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent('Support my campaign: ' + url)}`, icon: '✓', bg: '#25d366' },
    { label: 'Email',     href: `mailto:?subject=${encodeURIComponent('Support my fundraiser')}&body=${encodeURIComponent('Please support my campaign on CharitMe:\n\n' + url)}`, icon: '@', bg: '#6c35ff' },
  ];

  return (
    <div className="cr2-quick-share">
      <div className="cr2-qs-header">
        <span className="cr2-qs-title">Quick share</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="cr2-qs-view-link">🔗 Share this campaign</a>
      </div>

      <div className="cr2-qs-body">
        <div className="cr2-qs-left">
          {/* URL bar */}
          <div className="cr2-qs-url-row">
            <span className="cr2-qs-url-text">{url}</span>
            <button type="button" className={`cr2-qs-copy-btn${copied ? ' copied' : ''}`} onClick={() => void copyLink()}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Social grid */}
          <div className="cr2-qs-grid">
            {shareLinks.map(({ label, href, icon, bg }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="cr2-qs-btn">
                <span className="cr2-qs-btn-icon" style={{ background: bg }}>{icon}</span>
                <span>{label}</span>
              </a>
            ))}
          </div>

          {/* Previously pointed at the slug-keyed "poster" path — wrong twice:
              the route is qr-poster, and it keys on the campaign ID. The
              onClick hid both by calling window.print(), which printed the
              BUILDER page rather than a poster, so the button never once did
              what it says. It now opens the real poster, which carries its own
              print stylesheet.

              NOTE: master briefly carried a half-fix here that corrected the
              route name but kept ${slug}. The handler does .eq('id', id), so
              that form 404s — verified against production. The two defects were
              independent; fixing only the path leaves the button broken. */}
          {campaignId && (
            <a
              href={`/api/campaigns/${campaignId}/qr-poster`}
              className="cr2-qs-poster-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              🖨 Download printable poster →
            </a>
          )}
        </div>

        {/* QR code */}
        <div className="cr2-qs-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR code for campaign" width={120} height={120} />
          <span>Scan to donate</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
