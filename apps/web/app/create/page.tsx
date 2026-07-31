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
  fromRemoteDraft,
  pickFreshestDraft,
  describePublishFailure,
  type CampaignDraft,
} from '../../lib/campaign-draft';
import { WIZARD_STEPS, normalizeStep, minutesRemaining, type WizardStep } from '../../lib/wizard-steps';
import { evaluateDonorView } from '../../lib/donor-preview';

/** A pristine wizard form — also what "start another campaign" resets to (F8). */
const EMPTY_FORM: FormState = {
  category: 'Medical',
  forSelf: 'true',
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
import { extractCampaignFields } from '../../lib/campaign-intake';
import { CharitMeShell, KFIcon } from '../../components/CharitMeApp';
import { createClient } from '../../lib/supabase-browser';
import AiFollowUps from './AiFollowUps';
import ReadinessChecklist from './ReadinessChecklist';
import GoalProceedsBreakdown from './GoalProceedsBreakdown';
import StorySectionsEditor from './StorySectionsEditor';
import { publishReadiness } from '../../lib/campaign-readiness';
import FeatureUpsell from './FeatureUpsell';
import { analyzeStory } from '../../lib/story-analysis';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type PayoutMethod = 'stripe' | 'paypal' | 'venmo' | 'googlepay' | 'sinch';
type PayoutAccount = {
  id: string;
  stripe_account_id: string;
  payouts_enabled: boolean;
  details_submitted: boolean;
  verification_status: string;
  payout_type?: string;
  paypal_email?: string;
  venmo_handle?: string;
  googlepay_email?: string;
  sinch_ref?: string;
} | null;

interface PaymentMethods {
  primary?: string;
  paypal?: string;
  venmo?: string;
  googlepay?: string;
  sinch?: string;
}

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
}

type UploadStatus = 'uploading' | 'done' | 'error';

interface UploadedImage {
  id: string;
  url: string;
  name: string;
  status: UploadStatus;
  errorMsg?: string;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const JOURNEY_STEPS = ['Plan', 'Create', 'Launch', 'Manage', 'Celebrate', 'Impact'];

/**
 * Where an unauthenticated organizer is asked to sign in — deliberately the FIRST
 * step that technically requires a session: the next step (media) uploads to
 * /api/upload/campaign-image, which 401s without one. Everything before it
 * (Basics → Story → Title → Goal) is narrative work a guest can do freely, so they
 * build the whole campaign and only sign in when the product genuinely cannot
 * proceed. The draft survives sign-in (localStorage + Supabase cross-device), so
 * nothing is lost at the gate.
 *
 * Moving this later requires guest uploads to a temp bucket + claim-on-signup.
 */
const GUEST_GATE_STEP: WizardStep = 'goal';

const ALLOWED_IMG_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
]);
const MAX_IMG_SIZE = 10 * 1024 * 1024;
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
  goalDisplay,
  imageCount,
  goalCents,
  onGoToStep,
  onClose,
  onLaunch,
  launching,
}: {
  form: FormState;
  coverImageUrl: string;
  goalDisplay: string;
  imageCount: number;
  goalCents: number;
  onGoToStep: (step: WizardStep) => void;
  onClose: () => void;
  onLaunch: () => void;
  launching: boolean;
}) {
  const beneficiary = form.forSelf === 'true' ? 'you' : (form.beneficiaryName || 'someone in need');
  // Most donors arrive on a phone, so the preview defaults to the phone frame —
  // previewing only the desktop layout hid the view most donors actually get.
  const [viewport, setViewport] = React.useState<'mobile' | 'desktop'>('mobile');
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
          {(['mobile', 'desktop'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setViewport(v)} aria-pressed={viewport === v}
              style={{ padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800,
                background: viewport === v ? '#fff' : 'transparent', color: viewport === v ? '#1a1a2e' : '#fff' }}>
              {v === 'mobile' ? '📱 Phone' : '🖥 Desktop'}
            </button>
          ))}
        </div>
        <button type="button" className="cr2-preview-topbar-launch" onClick={onLaunch} disabled={launching}>
          {launching ? 'Launching…' : '🚀 Launch Campaign'}
        </button>
      </div>
      <div className="cr2-preview-scroll">
        <div
          className="cr2-preview-page"
          style={viewport === 'mobile'
            ? { maxWidth: 420, margin: '0 auto', boxShadow: '0 0 0 8px rgba(0,0,0,.25)', borderRadius: 18, overflow: 'hidden' }
            : undefined}
        >
          <div className="cr2-preview-hero">
            {coverImageUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={coverImageUrl} alt="Cover" />
              : 'Cover photo will appear here'}
          </div>
          <div className="cr2-preview-content">
            <div className="cr2-preview-main">
              <span className="cr2-preview-cat-pill">{form.category}</span>
              <h1>{form.title || 'Your Campaign Title'}</h1>
              <p className="cr2-preview-by">
                Organized by <strong>{beneficiary}</strong>
                {form.country && <> · {form.country}</>}
              </p>
              <p className="cr2-preview-story-text">
                {form.description || 'Your campaign story will appear here. Write a compelling story on the previous step to engage donors and explain your cause.'}
              </p>
            </div>
            <div>
              <div className="cr2-donate-box">
                <div className="cr2-donate-raised">$0</div>
                <div className="cr2-donate-goal">raised of ${goalDisplay} goal</div>
                <div className="cr2-donate-bar"><div className="cr2-donate-fill" /></div>
                <div className="cr2-donate-stats">
                  <span><strong>$0</strong> raised</span>
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
                    <li key={c.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
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
  const [step, setStep]               = useState<WizardStep>('basics');
  const [loading, setLoading]         = useState(false);
  const [aiLoading, setAiLoading]     = useState(false);
  const [storyMode, setStoryMode]     = useState<'freeform' | 'guided'>('freeform');
  const [error, setError]             = useState('');
  // Which field the current error belongs to, so it can be marked aria-invalid
  // and focused. Panel-level banners alone told a keyboard/AT user that
  // *something* was wrong but not *which* input, leaving focus on the button.
  const [errorField, setErrorField]   = useState<BuilderField | null>(null);
  const titleInputRef                 = useRef<HTMLInputElement>(null);
  const storyInputRef                 = useRef<HTMLTextAreaElement>(null);
  const goalInputRef                  = useRef<HTMLInputElement>(null);
  const [publishedSlug, setPublishedSlug] = useState('');
  // The QR-poster endpoint keys on the campaign id, not the slug.
  const [publishedId, setPublishedId] = useState('');
  const [userName, setUserName]       = useState<string | null>(null);
  const [userEmail, setUserEmail]     = useState<string | undefined>(undefined);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [payoutAccount, setPayoutAccount] = useState<PayoutAccount>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMethod, setPayoutMethod]   = useState<PayoutMethod | null>(null);
  const [showAltPayouts, setShowAltPayouts] = useState(false);
  const [paypalEmail, setPaypalEmail]     = useState('');
  const [venmoHandle, setVenmoHandle]     = useState('');
  const [googlePayEmail, setGooglePayEmail] = useState('');
  const [routingNumber, setRoutingNumber]   = useState('');
  const [accountNumber, setAccountNumber]   = useState('');
  const [accountType, setAccountType]       = useState<'checking' | 'savings'>('checking');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods>({});
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [isGuest, setIsGuest]         = useState<boolean | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Restore wizard state parked in sessionStorage across an OAuth sign-in bounce.
  // Restores images and story mode as well as the text — text-only restores used
  // to silently drop every upload and blank the cover image on return.
  const restoreBounce = useCallback((saved: string | null) => {
    if (!saved) return;
    try {
      const { savedForm, savedStep, savedImages, savedStoryMode } = JSON.parse(saved) as {
        savedForm: FormState; savedStep: WizardStep;
        savedImages?: { url: string; name: string }[]; savedStoryMode?: string;
      };
      if (Array.isArray(savedImages) && savedImages.length > 0) {
        setUploadedImages(savedImages.map((i, idx) => ({
          id: `bounce-${idx}-${i.url}`, url: i.url, name: i.name ?? '', status: 'done' as const,
        })));
      }
      if (savedStoryMode === 'freeform' || savedStoryMode === 'guided') setStoryMode(savedStoryMode);
      setForm(savedForm);
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
      void supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setUserName((data as { full_name?: string | null; avatar_url?: string | null }).full_name ?? null);
            setUserAvatarUrl((data as { full_name?: string | null; avatar_url?: string | null }).avatar_url ?? null);
          }
        });
    });
  }, [restoreBounce]);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
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
  const [savedAt, setSavedAt] = useState<number | null>(null);

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
  const setActiveDraftId = useCallback((id: string | null) => {
    draftIdRef.current = id;
    if (typeof window === 'undefined') return;
    if (id) localStorage.setItem(ACTIVE_DRAFT_KEY, id);
    else localStorage.removeItem(ACTIVE_DRAFT_KEY);
  }, []);

  const clearDraft = useCallback(() => {
    if (typeof window !== 'undefined') localStorage.removeItem(CAMPAIGN_DRAFT_KEY);
    setSavedAt(null);
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

  const resumeDraft = useCallback(() => {
    const d = recoverableDraft;
    if (!d) return;
    setForm(d.form);
    if (d.storyMode === 'freeform' || d.storyMode === 'guided') setStoryMode(d.storyMode);
    setUploadedImages(d.images.map((i, idx) => ({ id: `restored-${idx}-${i.url}`, url: i.url, name: i.name, status: 'done' as const })));
    const draftStep = normalizeStep(d.step);
    if (draftStep) setStep(draftStep);
    setSavedAt(d.ts);
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
      setForm(d.form);
      if (d.storyMode === 'freeform' || d.storyMode === 'guided') setStoryMode(d.storyMode);
      setUploadedImages(d.images.map((i, idx) => ({ id: `remote-${idx}-${i.url}`, url: i.url, name: i.name, status: 'done' as const })));
      const st = normalizeStep(d.step);
      if (st) setStep(st);
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
      if (draftIdRef.current === id) setActiveDraftId(null);
    } catch { /* best-effort */ }
  }, [setActiveDraftId]);

  /** Begin a fresh campaign, leaving existing drafts untouched. */
  const startNewDraft = useCallback(() => {
    setActiveDraftId(null);
    if (typeof window !== 'undefined') localStorage.removeItem(CAMPAIGN_DRAFT_KEY);
    setForm(EMPTY_FORM);
    setUploadedImages([]);
    setStep('basics');
    setSavedAt(null);
    draftDecided.current = true;
    setRecoverableDraft(null);
    setShowDraftPicker(false);
  }, [setActiveDraftId]);

  const dismissDraft = useCallback(() => {
    clearDraft();
    draftDecided.current = true;
    setRecoverableDraft(null);
  }, [clearDraft]);

  useEffect(() => {
    // Autosave once the recovery decision is made and there's real content.
    if (!draftDecided.current || recoverableDraft) return;
    if (typeof window === 'undefined') return;
    if (!draftHasContent(form, uploadedImages.filter(i => i.status === 'done').length)) return;
    const t = setTimeout(() => {
      const draft = buildDraft({
        step,
        storyMode,
        form,
        images: uploadedImages.filter(i => i.status === 'done').map(i => ({ url: i.url, name: i.name })),
      });
      localStorage.setItem(CAMPAIGN_DRAFT_KEY, serializeDraft(draft));
      setSavedAt(draft.ts);
      // Signed-in organizers also get the draft mirrored to Supabase so they can
      // resume on another device. Best-effort: localStorage remains the source of
      // truth for this tab, so a failed sync never blocks or interrupts the user.
      if (isGuest === false) {
        void (async () => {
          try {
            const res = await fetch('/api/campaigns/draft', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: draftIdRef.current ?? undefined,
                step, storyMode, form, images: draft.images, ts: draft.ts,
              }),
            });
            if (!res.ok) return; // incl. the draft-limit 409 — local copy still holds the work
            const { id } = await res.json();
            if (typeof id === 'string') setActiveDraftId(id);
          } catch { /* offline or transient */ }
        })();
      }
    }, 600);
    return () => clearTimeout(t);
  }, [form, step, storyMode, uploadedImages, recoverableDraft, isGuest, setActiveDraftId]);

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
    const body = JSON.stringify({ sessionId: builderSession.current, path: 'guided', step: stepKey, event });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon('/api/analytics/builder', new Blob([body], { type: 'application/json' }));
      else void fetch('/api/analytics/builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
    } catch { /* analytics is best-effort */ }
  }, []);

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
      if (step === 'live' || internalNavRef.current) return;
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
  const titleSeededRef = useRef(false);
  useEffect(() => {
    if (step !== 'title' || titleSeededRef.current) return;
    titleSeededRef.current = true;
    setForm(prev => (prev.title.trim() ? prev : { ...prev, title: suggestCampaignTitle(prev) }));
  }, [step]);
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
    if (step !== 'payout' && step !== 'summary') return;
    setPayoutLoading(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setPayoutLoading(false); return; }
      Promise.all([
        supabase
          .from('connected_accounts')
          .select('id, stripe_account_id, payouts_enabled, details_submitted, verification_status')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('org_website')
          .eq('id', user.id)
          .single(),
      ]).then(([{ data: acct }, { data: profile }]) => {
        const orgSite = (profile as { org_website?: string | null } | null)?.org_website ?? '';
        let methods: PaymentMethods = {};
        // Parse stored payment methods — supports new JSON format + legacy paypal: prefix
        if (orgSite.startsWith('{')) {
          try { methods = JSON.parse(orgSite) as PaymentMethods; } catch { /* ignore */ }
        } else if (orgSite.startsWith('paypal:')) {
          methods = { primary: 'paypal', paypal: orgSite.replace('paypal:', '') };
        }
        setPaymentMethods(methods);
        // Set payout account based on what's connected
        if (acct && (acct as { payouts_enabled: boolean }).payouts_enabled) {
          setPayoutAccount(acct as PayoutAccount);
        } else if (methods.primary === 'venmo' && methods.venmo) {
          setPayoutAccount({ id: 'venmo', stripe_account_id: '', payouts_enabled: true, details_submitted: true, verification_status: 'verified', payout_type: 'venmo', venmo_handle: methods.venmo });
        } else if (methods.primary === 'googlepay' && methods.googlepay) {
          setPayoutAccount({ id: 'googlepay', stripe_account_id: '', payouts_enabled: true, details_submitted: true, verification_status: 'verified', payout_type: 'googlepay', googlepay_email: methods.googlepay });
        } else if (methods.primary === 'paypal' && methods.paypal) {
          setPayoutAccount({ id: 'paypal', stripe_account_id: '', payouts_enabled: true, details_submitted: true, verification_status: 'verified', payout_type: 'paypal', paypal_email: methods.paypal });
        } else if (methods.primary === 'sinch' && methods.sinch) {
          setPayoutAccount({ id: 'sinch', stripe_account_id: '', payouts_enabled: true, details_submitted: true, verification_status: 'verified', payout_type: 'sinch', sinch_ref: methods.sinch });
        } else if (acct) {
          setPayoutAccount(acct as PayoutAccount);
        }
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
    void (async () => {
      try {
        const res = await fetch(`/api/campaigns/goal-guidance?category=${encodeURIComponent(form.category)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { guidance } = await res.json();
        if (!cancelled && guidance?.available) setGoalGuidance(guidance);
      } catch { /* guidance is a nicety, never a blocker */ }
    })();
    return () => { cancelled = true; };
  }, [step, form.category]);

  const upd = (k: keyof FormState, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const goalCents = Math.round((parseFloat(form.goal) || 0) * 100);
  const stepIdx   = WIZARD_STEPS.findIndex(s => s.key === step);
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
    if (step === GUEST_GATE_STEP && isGuest === true) {
      setShowLoginModal(true);
      return;
    }
    if (step === 'media') {
      const stillUploading = uploadedImages.some(img => img.status === 'uploading');
      if (stillUploading) { setError('Please wait for all images to finish uploading.'); return; }
    }
    // Field-targeted validation lives in lib/builder-validation.ts so the rules
    // and their field mapping are unit-tested — the builder itself can't be
    // driven in CI (auth-gated, no database).
    const stepError = validateBuilderStep({
      step,
      title: form.title,
      description: form.description,
      goalCents,
      goalRaw: form.goal,
    });
    if (stepError) { failField(stepError.field, stepError.message); return; }
    // Payout is intentionally OPTIONAL to publish — the campaign can go live and be
    // shared immediately, and the organizer finishes payout to start receiving
    // donations (the donation API already blocks charges until the recipient is
    // payout-ready, so nothing is lost by publishing first). This removes the
    // single biggest drop-off point in the builder.
    const next = WIZARD_STEPS[stepIdx + 1];
    if (next) setStep(next.key);
  };

  const goPrev = () => {
    setError('');
    const prev = WIZARD_STEPS[stepIdx - 1];
    if (prev) setStep(prev.key);
  };

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - uploadedImages.length;
    if (remaining <= 0) { setUploadError(`Maximum ${MAX_IMAGES} images allowed.`); return; }
    const validFiles = Array.from(files).filter(f => ALLOWED_IMG_TYPES.has(f.type) && f.size <= MAX_IMG_SIZE).slice(0, remaining);
    const skipped = files.length - validFiles.length;
    if (validFiles.length === 0) { setUploadError('No valid images found. Use JPG, PNG, GIF, WebP, or AVIF under 10 MB.'); return; }
    setUploadError(skipped > 0 ? `${skipped} file(s) skipped — invalid type or over 10 MB.` : '');
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
  }, [uploadedImages.length]);

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

  const runAi = async (notesOverride?: string, toneOverride?: string, forceStory = false) => {
    setAiLoading(true);
    setError('');
    try {
      const notes = (notesOverride ?? form.description)?.trim() || 'Help us write a compelling fundraiser.';
      const res = await fetch('/api/ai/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: form.category, goalAmount: goalCents || 500000, beneficiary: form.beneficiaryName || 'the beneficiary', notes, tone: toneOverride || 'authentic' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'AI generation failed');
      setForm(prev => ({
        ...prev,
        title: prev.title || (typeof data.title === 'string' ? data.title : prev.title),
        tagline: prev.tagline || (typeof data.socialCaption === 'string' ? data.socialCaption : prev.tagline),
        description: (!forceStory && prev.description.length > 80) ? prev.description : (typeof data.story === 'string' ? data.story : prev.description),
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  // "Build with AI" entry: /ai-campaign routes here as /create?ai=<prompt>.
  // Carry the prompt through — seed the story, jump to the Story step, and
  // generate the first draft once (the AI endpoint falls back deterministically,
  // so this always produces reviewable content the organizer can edit).
  const aiSeededRef = useRef(false);
  useEffect(() => {
    if (aiSeededRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const prompt = params.get('ai');
    if (!prompt || !prompt.trim()) return;
    aiSeededRef.current = true;
    const seed = prompt.trim().slice(0, 4000);
    // Pre-fill the structured fields we can infer from the prompt so the AI path
    // asks fewer questions (category + goal); the wizard still lets the organizer
    // change anything. Never infers beneficiary identity.
    const fields = extractCampaignFields(seed);
    setForm(prev => ({
      ...prev,
      description: prev.description.trim().length > seed.length ? prev.description : seed,
      category: fields.category ?? prev.category,
      goal: prev.goal.trim() || (fields.goalCents ? String(Math.round(fields.goalCents / 100)) : prev.goal),
    }));
    setStep('story');
    void runAi(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitCampaign = async (status: 'draft' | 'active') => {
    // Any requirement that fails here also sends the organizer back to the step
    // that owns it — an error on the Review screen is otherwise a dead end.
    if (form.title.trim().length < 3) {
      setError('Campaign title must be at least 3 characters.');
      setStep('title');
      return;
    }
    if (status === 'active') {
      if (form.description.trim().length < 20) {
        setError('Campaign story must be at least 20 characters.');
        setStep('story');
        return;
      }
      if (goalCents < 100) {
        setError('Fundraising goal must be at least $1.00.');
        setStep('goal');
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
          // coercing it to $1 wrote a number the organizer never chose, which then
          // rode along if they later published from the dashboard.
          goalAmount: goalCents,
          deadline: form.deadline || null,
          category: form.category,
          coverImageUrl: form.coverImageUrl || null,
          imageUrls: uploadedImages.filter(img => img.status === 'done').map(img => img.url),
          beneficiaryName: form.beneficiaryName.trim() || undefined,
          beneficiaryRelationship: form.beneficiaryRelationship.trim() || undefined,
          location,
          status,
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
      setPublishedId(typeof data.id === 'string' ? data.id : '');
      setStep('live');
    } catch (e: unknown) {
      // Network/transport failure — the draft is still saved locally and remotely.
      setError(describePublishFailure(e instanceof Error ? e.message : '').message);
    } finally {
      setLoading(false);
    }
  };

  const publish = () => submitCampaign('active');
  const saveDraft = () => submitCampaign('draft');

  const payoutLinked = Boolean(
    payoutAccount && (
      (payoutAccount.payout_type === 'paypal'     && payoutAccount.paypal_email)    ||
      (payoutAccount.payout_type === 'venmo'      && payoutAccount.venmo_handle)    ||
      (payoutAccount.payout_type === 'googlepay'  && payoutAccount.googlepay_email) ||
      (payoutAccount.payout_type === 'sinch'      && payoutAccount.sinch_ref)       ||
      (payoutAccount.payouts_enabled && payoutAccount.details_submitted)
    )
  );

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

  // ── Shared: persist payment methods JSON to profiles.org_website ──
  const persistPaymentMethods = async (updated: PaymentMethods) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ org_website: JSON.stringify(updated) } as Record<string, string>)
      .eq('id', user.id);
    if (profileErr) throw new Error('Failed to save payment method.');
    setPaymentMethods(updated);
  };

  const savePaypal = async () => {
    if (!paypalEmail.trim() || !paypalEmail.includes('@')) { setError('Please enter a valid PayPal email address.'); return; }
    setLoading(true); setError('');
    try {
      const isFirst = !payoutLinked;
      const updated: PaymentMethods = { ...paymentMethods, paypal: paypalEmail.trim(), ...(isFirst ? { primary: 'paypal' } : {}) };
      await persistPaymentMethods(updated);
      setPayoutMethod(null);
      if (isFirst) setPayoutAccount({ id: 'paypal', stripe_account_id: '', payouts_enabled: true, details_submitted: true, verification_status: 'verified', payout_type: 'paypal', paypal_email: paypalEmail.trim() });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save PayPal email.');
    } finally { setLoading(false); }
  };

  const saveVenmo = async () => {
    if (!venmoHandle.trim()) { setError('Please enter your Venmo username.'); return; }
    setLoading(true); setError('');
    try {
      const handle = venmoHandle.trim().replace(/^@/, '');
      const isFirst = !payoutLinked;
      const updated: PaymentMethods = { ...paymentMethods, venmo: `@${handle}`, ...(isFirst ? { primary: 'venmo' } : {}) };
      await persistPaymentMethods(updated);
      setPayoutMethod(null);
      if (isFirst) setPayoutAccount({ id: 'venmo', stripe_account_id: '', payouts_enabled: true, details_submitted: true, verification_status: 'verified', payout_type: 'venmo', venmo_handle: `@${handle}` });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save Venmo handle.');
    } finally { setLoading(false); }
  };

  const saveGooglePay = async () => {
    if (!googlePayEmail.trim() || !googlePayEmail.includes('@')) { setError('Please enter your Google account email.'); return; }
    setLoading(true); setError('');
    try {
      const isFirst = !payoutLinked;
      const updated: PaymentMethods = { ...paymentMethods, googlepay: googlePayEmail.trim(), ...(isFirst ? { primary: 'googlepay' } : {}) };
      await persistPaymentMethods(updated);
      setPayoutMethod(null);
      if (isFirst) setPayoutAccount({ id: 'googlepay', stripe_account_id: '', payouts_enabled: true, details_submitted: true, verification_status: 'verified', payout_type: 'googlepay', googlepay_email: googlePayEmail.trim() });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save Google Pay email.');
    } finally { setLoading(false); }
  };

  const saveSinch = async () => {
    if (!routingNumber.trim() || routingNumber.length < 9) { setError('Please enter a valid 9-digit routing number.'); return; }
    if (!accountNumber.trim() || accountNumber.length < 4) { setError('Please enter your account number.'); return; }
    setLoading(true); setError('');
    try {
      const last4 = accountNumber.slice(-4);
      const ref = `sinch_${accountType}_${last4}`;
      const isFirst = !payoutLinked;
      const updated: PaymentMethods = { ...paymentMethods, sinch: ref, ...(isFirst ? { primary: 'sinch' } : {}) };
      await persistPaymentMethods(updated);
      setPayoutMethod(null);
      setRoutingNumber(''); setAccountNumber('');
      if (isFirst) setPayoutAccount({ id: 'sinch', stripe_account_id: '', payouts_enabled: true, details_submitted: true, verification_status: 'verified', payout_type: 'sinch', sinch_ref: ref });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save bank account.');
    } finally { setLoading(false); }
  };

  const journeyState = (i: number): 'done' | 'active' | '' => {
    if (i === 0) return 'done';
    if (i === 1) return stepIdx <= 6 ? 'active' : 'done';
    if (i === 2) { if (step === 'live') return 'done'; if (step === 'summary') return 'active'; return ''; }
    return '';
  };

  const goalDisplay = parseFloat(form.goal || '0').toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const heroCopy: Record<string, { title: string; sub: string }> = {
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

  // ─────────────────────────────────────────────
  return (
    <CharitMeShell active="My Campaigns" userName={userName} userEmail={userEmail} userAvatarUrl={userAvatarUrl} guestMode={isGuest !== false} hideSidebar>

      {/* ── F8: choose among several in-flight drafts ── */}
      {showDraftPicker && draftList.length > 1 && step !== 'live' && (
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
                <li key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 12, padding: '10px 14px' }}>
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
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
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
      {recoverableDraft && step !== 'live' && (
        <div role="region" aria-label="Resume unfinished campaign" style={{ background: 'linear-gradient(135deg, var(--violet), var(--violet-2))', color: '#fff', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <span style={{ fontSize: 20 }} aria-hidden>↩️</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            Welcome back — pick up where you left off?
          </span>
          <span style={{ fontSize: 13, opacity: .9 }}>Saved {draftAgeLabel(recoverableDraft.ts)}</span>
          <div style={{ display: 'flex', gap: 8 }}>
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
          goalDisplay={goalDisplay}
          imageCount={uploadedImages.filter(i => i.status === 'done').length}
          goalCents={goalCents}
          onGoToStep={(s) => setStep(s)}
          onClose={() => setShowPreviewModal(false)}
          onLaunch={() => {
            setShowPreviewModal(false);
            if (isGuest !== false) { setShowLoginModal(true); } else { void publish(); }
          }}
          launching={loading}
        />
      )}

      {/* ── Gradient Hero Banner ── */}
      {step !== 'live' && (
        <div className="cr2-hero">
          <div className="cr2-hero-glow" />
          <div className="cr2-hero-inner">
            <div className="cr2-hero-top">
              <Link href="/dashboard/campaigns" className="cr2-back-link">← My Campaigns</Link>
              <div className="cr2-step-badge">
                Step {stepIdx + 1} / {WIZARD_STEPS.length}
                {stepIdx >= 0 && (
                  // Answer "how much longer?" up front — an unknown remaining
                  // cost is its own reason to abandon.
                  <span style={{ marginLeft: 8, opacity: 0.75, fontWeight: 600 }}>
                    · about {minutesRemaining(step)} min left
                  </span>
                )}
                {savedAt && (
                  <span title="Your progress is saved on this device" style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, opacity: .85 }}>
                    · ✓ Saved
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
        {step !== 'live' && (
          <div className="cr2-track-wrap">
            <div className="cr2-track">
              {WIZARD_STEPS.map((s, i) => {
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
        {step !== 'live' ? (
          <div className="cr2-layout">

            {/* ─── Left: wizard form card ─── */}
            <section className="cr2-form-card">

              {/* AI banner — story step only */}
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

              {/* ── Step: Type ── */}
              {step === 'basics' && (
                <div className="cr2-type-panel">
                  <h2 className="cr2-step-q">Let&apos;s get started, who are you fundraising for?</h2>

                  <div className="cr2-who-grid">
                    <button
                      type="button"
                      className={`cr2-who-card${form.forSelf === 'true' ? ' selected' : ''}`}
                      onClick={() => upd('forSelf', 'true')}
                    >
                      <div className="cr2-who-icon" style={{ background: 'rgba(108,53,255,.12)' }}>🙋</div>
                      <strong>Yourself</strong>
                      <p>Funds are delivered to your bank account for your own use</p>
                    </button>
                    <button
                      type="button"
                      className={`cr2-who-card${form.forSelf === 'false' ? ' selected' : ''}`}
                      onClick={() => upd('forSelf', 'false')}
                    >
                      <div className="cr2-who-icon" style={{ background: 'rgba(16,185,129,.12)' }}>🤝</div>
                      <strong>Someone else</strong>
                      <p>You&apos;ll invite a beneficiary to receive funds or distribute them yourself</p>
                    </button>
                  </div>

                  <h2 className="cr2-step-q" style={{ marginTop: 26 }}>What best describes your cause?</h2>

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

                  <h2 className="cr2-step-q" style={{ marginTop: 26, marginBottom: 22 }}>Where are you located?</h2>

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

                  {form.forSelf === 'false' && (
                    <>
                      <div className="cr2-field">
                        <label htmlFor="cr-beneficiary-name">Beneficiary Name</label>
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
                        <label htmlFor="cr-beneficiary-rel">Your Relationship to Them</label>
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

                  <div className="cr2-loc-banner">
                    <span>📍</span>
                    <span>CharitMe is where fundraising begins for more than 278 people near you.</span>
                  </div>
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
                    <AiFollowUps form={form} onAnswer={(field, value) => upd(field, value)} />
                  )}
                </div>
              )}

              {/* ── Step: Title ── */}
              {step === 'title' && (
                <div className="cr2-title-panel">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
                    <h2 className="cr2-step-q" style={{ padding: 0, margin: 0 }}>Give your fundraiser a Title</h2>
                    <button
                      type="button"
                      className="cr2-ai-suggest"
                      onClick={async () => {
                        setAiLoading(true);
                        try {
                          const res = await fetch('/api/ai/campaign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: form.category, goalAmount: goalCents || 500000, beneficiary: form.beneficiaryName || 'the beneficiary', notes: form.description?.trim() || 'Help us write a compelling fundraiser.', tone: 'authentic' }) });
                          const data = await res.json();
                          if (res.ok && typeof data.title === 'string' && data.title.trim()) upd('title', data.title.slice(0, 80));
                        } catch { /* silent */ } finally { setAiLoading(false); }
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

              {/* ── Step: Goal ── */}
              {step === 'goal' && (
                <div className="cr2-form-panel">
                  <h2 className="cr2-step-q" style={{ padding: 0, marginBottom: 8 }}>How much would you like to raise?</h2>

                  {goalGuidance?.available && goalGuidance.lowCents != null && goalGuidance.highCents != null && (
                    <div style={{ margin: '0 0 14px', padding: '12px 14px', borderRadius: 12, background: 'var(--s2, #f5f7fb)', border: '1px solid var(--b1, #e8ecf4)' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--t1, #1a1a2e)' }}>
                        Most {form.category.toLowerCase()} campaigns set{' '}
                        ${Math.round(goalGuidance.lowCents / 100).toLocaleString('en-US')}–${Math.round(goalGuidance.highCents / 100).toLocaleString('en-US')}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--t3)', marginTop: 4, lineHeight: 1.5 }}>
                        {goalGuidance.note}
                        {goalGuidance.goalHitRate != null && ` About ${Math.round(goalGuidance.goalHitRate * 100)}% reach their goal.`}
                        {' '}A goal you can realistically pass builds momentum — you can raise it later.
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                        {[goalGuidance.lowCents, goalGuidance.highCents].map((c, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => upd('goal', String(Math.round((c as number) / 100)))}
                            style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid var(--b2, #d7dced)', background: 'var(--s1, #fff)', color: 'var(--t2, #334064)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Use ${Math.round((c as number) / 100).toLocaleString('en-US')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="cr2-field">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                      <span className="cr2-goal-prefix">$</span>
                      <input
                        type="number"
                        aria-label="Fundraising goal amount in dollars"
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
                      <span className="cr2-goal-suffix">USD</span>
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
                      Your starting goal would be ${autoGoalStart.toLocaleString()}
                    </p>
                  </div>

                  <GoalProceedsBreakdown goalCents={goalCents} />
                </div>
              )}

              {/* ── Step: Media ── */}
              {step === 'media' && (
                <div className="cr2-form-panel">
                  <h2 className="cr2-step-q" style={{ padding: 0, marginBottom: 8 }}>Add a cover photo or video</h2>

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
                      <span>JPG, PNG, GIF, WebP, AVIF · up to {MAX_IMAGES} images · 10 MB each</span>
                    </div>
                    {uploadError && <p role="alert" style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--red-text)', fontWeight: 700 }}>{uploadError}</p>}
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

                  {/* Status header */}
                  <div className="cr2-payout-header">
                    <span className="cr2-payout-header-label">Payout Status</span>
                    {payoutLoading ? (
                      <span className="cr2-payout-status-pill checking">Checking…</span>
                    ) : payoutLinked ? (
                      <span className="cr2-payout-status-pill linked">● Connected</span>
                    ) : (
                      <span className="cr2-payout-status-pill unlinked">● Not Linked</span>
                    )}
                  </div>

                  {!payoutLoading && !payoutLinked && (
                    <div style={{ margin: '0 0 16px', padding: '12px 14px', borderRadius: 12, background: 'rgba(16,185,129,.10)', border: '1px solid rgba(16,185,129,.3)', display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, lineHeight: 1.5, color: 'var(--t2)' }}>
                      <span aria-hidden style={{ fontSize: 17 }}>✅</span>
                      <span>
                        <strong>This is optional right now.</strong> You can publish your campaign and start sharing it in the next step — set up payouts here or later from your dashboard. You&rsquo;ll be able to <em>receive</em> donations once payouts are connected.
                      </span>
                    </div>
                  )}

                  {payoutLoading ? (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--t3)', fontSize: 14 }}>Checking your payout account…</div>

                  ) : payoutMethod === 'stripe' ? (
                    /* ── Stripe sub-form ── */
                    <div className="cr2-payout-subform">
                      <div className="cr2-payout-subform-head">
                        <span style={{ fontSize: 26 }}>🏦</span>
                        <div><strong>Stripe Connect</strong><p>Direct bank deposits to your verified bank account.</p></div>
                      </div>
                      <div className="cr2-payout-trust-row">
                        🔒 Bank-level encryption · 0% CharitMe fees · Funds deposited within 2 business days
                      </div>
                      <button type="button" className="cr2-payout-connect-btn cr2-payout-btn-stripe" onClick={() => void connectStripe()} disabled={connectingStripe}>
                        {connectingStripe ? 'Redirecting to Stripe…' : '🏦 Connect Bank via Stripe →'}
                      </button>
                      {payoutAccount && !payoutAccount.payouts_enabled && (
                        <div className="cr2-payout-warn">⚠️ Stripe onboarding incomplete — click above to finish setup.</div>
                      )}
                      <button type="button" className="cr2-payout-back-link" onClick={() => setPayoutMethod(null)}>← Back to options</button>
                    </div>

                  ) : payoutMethod === 'venmo' ? (
                    /* ── Venmo sub-form ── */
                    <div className="cr2-payout-subform">
                      <div className="cr2-payout-subform-head">
                        <span style={{ fontSize: 26 }}>💚</span>
                        <div><strong>Venmo</strong><p>Receive donations directly to your Venmo account.</p></div>
                      </div>
                      <label htmlFor="cr-venmo" className="cr2-payout-field-label">Venmo Username</label>
                      <div className="cr2-payout-input-prefix-wrap">
                        <span className="cr2-payout-input-prefix">@</span>
                        <input id="cr-venmo" type="text" value={venmoHandle} onChange={e => setVenmoHandle(e.target.value.replace(/^@/, ''))} placeholder="yourvenmo" className="cr2-payout-input cr2-payout-input-has-prefix" />
                      </div>
                      <button type="button" className="cr2-payout-connect-btn cr2-payout-btn-venmo" onClick={() => void saveVenmo()} disabled={loading || !venmoHandle.trim()}>
                        {loading ? 'Saving…' : '💚 Save Venmo Account'}
                      </button>
                      <button type="button" className="cr2-payout-back-link" onClick={() => setPayoutMethod(null)}>← Back to options</button>
                    </div>

                  ) : payoutMethod === 'googlepay' ? (
                    /* ── Google Pay sub-form ── */
                    <div className="cr2-payout-subform">
                      <div className="cr2-payout-subform-head">
                        <span style={{ fontSize: 26 }}>🔵</span>
                        <div><strong>Google Pay</strong><p>Receive donations via your Google Pay account.</p></div>
                      </div>
                      <label htmlFor="cr-gpay-email" className="cr2-payout-field-label">Google Account Email</label>
                      <input id="cr-gpay-email" type="email" value={googlePayEmail} onChange={e => setGooglePayEmail(e.target.value)} placeholder="you@gmail.com" className="cr2-payout-input" />
                      <button type="button" className="cr2-payout-connect-btn cr2-payout-btn-gpay" onClick={() => void saveGooglePay()} disabled={loading || !googlePayEmail.trim()}>
                        {loading ? 'Saving…' : '🔵 Save Google Pay Account'}
                      </button>
                      <button type="button" className="cr2-payout-back-link" onClick={() => setPayoutMethod(null)}>← Back to options</button>
                    </div>

                  ) : payoutMethod === 'paypal' ? (
                    /* ── PayPal sub-form ── */
                    <div className="cr2-payout-subform">
                      <div className="cr2-payout-subform-head">
                        <span style={{ fontSize: 26 }}>💙</span>
                        <div><strong>PayPal</strong><p>Donations sent to your PayPal account. PayPal fees apply on their end.</p></div>
                      </div>
                      <label htmlFor="cr-paypal-email" className="cr2-payout-field-label">PayPal Email Address</label>
                      <input id="cr-paypal-email" type="email" value={paypalEmail} onChange={e => setPaypalEmail(e.target.value)} placeholder="you@paypal.com" className="cr2-payout-input" />
                      <button type="button" className="cr2-payout-connect-btn cr2-payout-btn-paypal" onClick={() => void savePaypal()} disabled={loading || !paypalEmail.trim()}>
                        {loading ? 'Saving…' : '💙 Save PayPal Account'}
                      </button>
                      <button type="button" className="cr2-payout-back-link" onClick={() => setPayoutMethod(null)}>← Back to options</button>
                    </div>

                  ) : payoutMethod === 'sinch' ? (
                    /* ── Sinch ACH sub-form ── */
                    <div className="cr2-payout-subform">
                      <div className="cr2-payout-subform-head">
                        <span style={{ fontSize: 26 }}>🏛</span>
                        <div><strong>Sinch Bank Link</strong><p>Instant ACH bank account verification. Powered by Sinch.</p></div>
                      </div>
                      <div className="cr2-payout-trust-row">
                        🔒 Powered by <strong>Sinch</strong> · Bank-level encryption · Instant verification
                      </div>
                      <label htmlFor="cr-routing" className="cr2-payout-field-label">Routing Number (9 digits)</label>
                      <input id="cr-routing" type="text" value={routingNumber} onChange={e => setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="021000021" className="cr2-payout-input" maxLength={9} />
                      <label htmlFor="cr-account" className="cr2-payout-field-label" style={{ marginTop: 14 }}>Account Number</label>
                      <input id="cr-account" type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))} placeholder="Enter account number" className="cr2-payout-input" />
                      <span className="cr2-payout-field-label" style={{ marginTop: 14, display: 'block' }}>Account Type</span>
                      <div className="cr2-payout-acct-type-row" role="group" aria-label="Account type">
                        <button type="button" className={`cr2-acct-type-btn${accountType === 'checking' ? ' selected' : ''}`} onClick={() => setAccountType('checking')}>Checking</button>
                        <button type="button" className={`cr2-acct-type-btn${accountType === 'savings' ? ' selected' : ''}`} onClick={() => setAccountType('savings')}>Savings</button>
                      </div>
                      <button type="button" className="cr2-payout-connect-btn cr2-payout-btn-sinch" onClick={() => void saveSinch()} disabled={loading || !routingNumber || !accountNumber}>
                        {loading ? 'Verifying…' : '🏛 Connect Bank Account →'}
                      </button>
                      <button type="button" className="cr2-payout-back-link" onClick={() => setPayoutMethod(null)}>← Back to options</button>
                    </div>

                  ) : (
                    /* ── Method selection screen ── */
                    <div>
                      {/* Primary account (if already connected) */}
                      {payoutLinked && payoutAccount && (
                        <div className="cr2-payout-primary-card">
                          <div className="cr2-payout-primary-badge">PRIMARY</div>
                          <div className="cr2-payout-primary-row">
                            <span className="cr2-payout-primary-icon">
                              {payoutAccount.payout_type === 'paypal'    ? '💙'
                               : payoutAccount.payout_type === 'venmo'   ? '💚'
                               : payoutAccount.payout_type === 'googlepay' ? '🔵'
                               : payoutAccount.payout_type === 'sinch'   ? '🏛'
                               : '🏦'}
                            </span>
                            <div className="cr2-payout-primary-info">
                              <strong>
                                {payoutAccount.payout_type === 'paypal'     ? 'PayPal'
                                 : payoutAccount.payout_type === 'venmo'    ? 'Venmo'
                                 : payoutAccount.payout_type === 'googlepay' ? 'Google Pay'
                                 : payoutAccount.payout_type === 'sinch'    ? 'Sinch Bank Link'
                                 : 'Stripe Connect'}
                              </strong>
                              <span>
                                {payoutAccount.paypal_email    && payoutAccount.paypal_email}
                                {payoutAccount.venmo_handle    && payoutAccount.venmo_handle}
                                {payoutAccount.googlepay_email && payoutAccount.googlepay_email}
                                {payoutAccount.sinch_ref       && `${accountType} ••••${payoutAccount.sinch_ref.slice(-4)}`}
                                {payoutAccount.stripe_account_id && `${payoutAccount.stripe_account_id.slice(0, 14)}…`}
                              </span>
                            </div>
                            <span className="cr2-payout-primary-check">✓</span>
                          </div>
                        </div>
                      )}

                      <div className="cr2-payout-also-label">
                        {payoutLinked ? 'Also accept via:' : 'How do you want to receive donations?'}
                      </div>
                      {!payoutLinked && (
                        <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 18, lineHeight: 1.55 }}>
                          CharitMe charges 0% platform fees. Connect once — donations go directly to you.
                          <strong style={{ color: 'var(--red)' }}> This step is required to continue.</strong>
                        </p>
                      )}

                      {/* Stripe */}
                      <button type="button" className={`cr2-payout-option${!payoutLinked ? ' cr2-payout-option-featured' : ''}`} onClick={() => setPayoutMethod('stripe')}>
                        <span className="cr2-payout-option-icon">🏦</span>
                        <div className="cr2-payout-option-body">
                          <strong>Stripe Connect <span className="cr2-payout-recommended">RECOMMENDED</span></strong>
                          <span>Direct bank deposit · Identity verified · Most trusted</span>
                        </div>
                        {paymentMethods.primary === 'stripe' || (payoutAccount?.stripe_account_id && payoutAccount.payouts_enabled)
                          ? <span className="cr2-payout-option-connected">✓</span>
                          : <span className="cr2-payout-option-arrow">›</span>}
                      </button>

                      {/* Progressive disclosure: lead with the recommended option
                          (Stripe, above); tuck the alternates behind a toggle so the
                          required payout step poses one primary choice, not five. If
                          any alternate is already connected, reveal by default. */}
                      {(() => {
                        const anyAltConnected = Boolean(paymentMethods.venmo || paymentMethods.googlepay || paymentMethods.paypal || paymentMethods.sinch);
                        const open = showAltPayouts || anyAltConnected;
                        return (
                          <>
                            {!open && (
                              <button
                                type="button"
                                className="cr2-payout-more-toggle"
                                onClick={() => setShowAltPayouts(true)}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                  padding: '12px 16px', marginTop: 6, borderRadius: 12, cursor: 'pointer',
                                  border: '1.5px dashed var(--b1, #e8ecf4)', background: 'transparent',
                                  fontSize: 13.5, fontWeight: 700, color: 'var(--t2, #475569)', fontFamily: 'inherit',
                                }}
                                aria-expanded={false}
                              >
                                More ways to get paid <span aria-hidden>▾</span>
                              </button>
                            )}
                            <div style={{ display: open ? 'block' : 'none' }} aria-hidden={!open}>
                      {/* Venmo */}
                      <button type="button" className="cr2-payout-option" onClick={() => { setVenmoHandle(paymentMethods.venmo?.replace('@','') ?? ''); setPayoutMethod('venmo'); }}>
                        <span className="cr2-payout-option-icon">💚</span>
                        <div className="cr2-payout-option-body">
                          <strong>Venmo</strong>
                          <span>{paymentMethods.venmo ? `Connected: ${paymentMethods.venmo}` : 'Send directly to your Venmo account'}</span>
                        </div>
                        {paymentMethods.venmo
                          ? <span className="cr2-payout-option-connected">✓</span>
                          : <span className="cr2-payout-option-arrow">›</span>}
                      </button>

                      {/* Google Pay */}
                      <button type="button" className="cr2-payout-option" onClick={() => { setGooglePayEmail(paymentMethods.googlepay ?? ''); setPayoutMethod('googlepay'); }}>
                        <span className="cr2-payout-option-icon">🔵</span>
                        <div className="cr2-payout-option-body">
                          <strong>Google Pay</strong>
                          <span>{paymentMethods.googlepay ? `Connected: ${paymentMethods.googlepay}` : 'Receive via your Google account'}</span>
                        </div>
                        {paymentMethods.googlepay
                          ? <span className="cr2-payout-option-connected">✓</span>
                          : <span className="cr2-payout-option-arrow">›</span>}
                      </button>

                      {/* PayPal */}
                      <button type="button" className="cr2-payout-option" onClick={() => { setPaypalEmail(paymentMethods.paypal ?? ''); setPayoutMethod('paypal'); }}>
                        <span className="cr2-payout-option-icon">💙</span>
                        <div className="cr2-payout-option-body">
                          <strong>PayPal</strong>
                          <span>{paymentMethods.paypal ? `Connected: ${paymentMethods.paypal}` : 'Send to your PayPal account · PayPal fees apply'}</span>
                        </div>
                        {paymentMethods.paypal
                          ? <span className="cr2-payout-option-connected">✓</span>
                          : <span className="cr2-payout-option-arrow">›</span>}
                      </button>

                      {/* Sinch */}
                      <button type="button" className="cr2-payout-option" onClick={() => setPayoutMethod('sinch')}>
                        <span className="cr2-payout-option-icon">🏛</span>
                        <div className="cr2-payout-option-body">
                          <strong>Sinch Bank Link</strong>
                          <span>{paymentMethods.sinch ? `Connected: ••••${paymentMethods.sinch.slice(-4)}` : 'Instant ACH bank connection · No manual routing numbers'}</span>
                        </div>
                        {paymentMethods.sinch
                          ? <span className="cr2-payout-option-connected">✓</span>
                          : <span className="cr2-payout-option-arrow">›</span>}
                      </button>
                            </div>
                          </>
                        );
                      })()}

                      {/* Important notice */}
                      <div className="cr2-payout-important">
                        <strong>⚠️ IMPORTANT!</strong> CharitMe does <strong>NOT</strong> store any funds, they are sent directly to you at processing.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Step: Summary / Review & Launch ── */}
              {step === 'summary' && (
                <div className="cr2-launch-panel">
                  <div className="cr2-launch-header">
                    <h2>Your Fundraising is Ready to Launch!!</h2>
                    <p>Review everything below before going live</p>
                  </div>

                  {/* Score bar */}
                  <ScoreBar score={computeScore(form, step, payoutLinked, isGuest)} />

                  {/* Publish-readiness checklist — each item jumps to its step */}
                  <div style={{ margin: '14px 0' }}>
                    <ReadinessChecklist
                      readiness={publishReadiness({
                        title: form.title,
                        description: form.description,
                        goalCents,
                        category: form.category,
                        country: form.country,
                        coverImageUrl: form.coverImageUrl,
                        forSelf: form.forSelf,
                        beneficiaryName: form.beneficiaryName,
                        payoutLinked,
                      })}
                      onGoToStep={(s) => setStep(s)}
                    />
                  </div>

                  {!payoutLinked && (
                    <div style={{ margin: '4px 0 14px', padding: '12px 14px', borderRadius: 12, background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.35)', fontSize: 13.5, lineHeight: 1.5, color: 'var(--t2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span aria-hidden style={{ fontSize: 17 }}>💡</span>
                      <span>
                        <strong>You can launch now.</strong> Your campaign goes live and is shareable immediately. To start <em>receiving</em> donations, connect a payout method — you can{' '}
                        <button type="button" onClick={() => setStep('payout')} style={{ background: 'none', border: 0, padding: 0, color: 'var(--brand-text)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>do it now</button>{' '}
                        or anytime from your dashboard.
                      </span>
                    </div>
                  )}

                  <div className="cr2-launch-btns">
                    <button
                      type="button"
                      className="cr2-btn-launch"
                      onClick={() => { if (isGuest !== false) { setShowLoginModal(true); } else { void publish(); } }}
                      disabled={loading}
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
                      <span className="cr2-review-val" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="cr2-review-cover">
                          {form.coverImageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={form.coverImageUrl} alt="Cover" />
                          )}
                        </div>
                        {hasCover ? 'Cover photo added' : 'No photo yet'}
                      </span>
                      <button type="button" className="cr2-review-edit" onClick={() => setStep('media')}>Edit</button>
                    </div>

                    {/* Title */}
                    <div className="cr2-review-row">
                      <span className="cr2-review-label">Title</span>
                      <span className="cr2-review-val">{form.title || <span style={{ color: 'var(--red-text)' }}>Not set</span>}</span>
                      <button type="button" className="cr2-review-edit" onClick={() => setStep('title')}>Edit</button>
                    </div>

                    {/* Goal */}
                    <div className="cr2-review-row">
                      <span className="cr2-review-label">Goal</span>
                      <span className="cr2-review-val">
                        {goalCents >= 100 ? `$${(goalCents / 100).toLocaleString()}` : <span style={{ color: 'var(--red-text)' }}>Not set</span>}
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
                      <button type="button" className="cr2-review-edit" onClick={() => setStep('basics')}>Edit</button>
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
              {error && step !== 'title' && <div id={BUILDER_ERROR_ID} className="cr2-error" role="alert">{error}</div>}

              {/* Navigation */}
              <div className="cr2-nav">
                <button type="button" className="cr2-nav-back" onClick={goPrev} disabled={stepIdx === 0}>← Back</button>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {stepIdx >= 1 && step !== 'payout' && step !== 'summary' && (
                    <button type="button" className="cr2-nav-draft" onClick={() => void saveDraft()} disabled={loading}>
                      {loading ? 'Saving…' : 'Save Draft'}
                    </button>
                  )}
                  {step !== 'summary' && (
                    <button type="button" className="cr2-nav-next" onClick={goNext}>
                      {step === 'payout' && !payoutLinked ? 'Skip — set up later →' : 'Continue →'}
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

        ) : (
          /* ── Success / Live screen ── */
          <div className="cr2-success">
            <div className="cr2-success-icon"><KFIcon name="check" /></div>
            <h2>🎉 Your Campaign is Live!</h2>
            <p>
              {payoutLinked
                ? 'Congratulations! Your fundraiser is now live and ready to receive donations. Share it everywhere to reach your goal faster.'
                : 'Congratulations! Your fundraiser is now live and shareable. One last step to start receiving donations: connect a payout method.'}
            </p>
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
            {publishedSlug && (
              <div style={{ marginTop: 28 }}>
                <QuickSharePanel slug={publishedSlug} campaignId={publishedId} />
              </div>
            )}
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
          savedImages={uploadedImages.filter(i => i.status === 'done').map(i => ({ url: i.url, name: i.name }))}
          savedStoryMode={storyMode}
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => {
            setIsGuest(false);
            setShowLoginModal(false);
            // Two callers open this modal: the mid-wizard sign-in gate (continue
            // where they left off) and the Publish button (publish once signed in).
            // Derived from the step list rather than a hardcoded key so moving the
            // gate again doesn't silently strand the user here.
            if (step === GUEST_GATE_STEP) {
              const next = WIZARD_STEPS[WIZARD_STEPS.findIndex(s => s.key === step) + 1];
              if (next) setStep(next.key);
            } else {
              void publish();
            }
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
  savedImages: { url: string; name: string }[];
  savedStoryMode: string;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  // The gate that interrupts the builder (Location step) needs different copy
  // from the ordinary sign-in entry point.
  const midWizard = savedStep === 'basics';
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
  const stepOrder: WizardStep[] = ['basics','story','title','goal','media','payout','summary','live'];
  const si = stepOrder.indexOf(step);

  const identity: ScoreState   = isGuest === false ? 'verified' : (si >= 3 ? 'watch' : 'pending');
  const beneficiary: ScoreState = form.description.length > 200 ? 'verified'
    : form.description.length > 50 ? 'watch' : 'pending';
  const payout: ScoreState     = payoutLinked ? 'verified' : (si >= 7 ? 'watch' : 'pending');
  const storyQuality: ScoreState = form.description.length > 400 ? 'verified'
    : form.description.length > 100 ? 'watch' : 'pending';
  const evidence: ScoreState   = form.coverImageUrl ? 'verified' : (si >= 6 ? 'watch' : 'pending');

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
