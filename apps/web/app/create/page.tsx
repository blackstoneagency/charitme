'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { CharitMeShell, KFIcon } from '../../components/CharitMeApp';
import { createClient } from '../../lib/supabase-browser';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type WizardStep = 'type' | 'details' | 'story' | 'media' | 'preview' | 'payout' | 'summary' | 'live';

type PayoutMethod = 'stripe' | 'paypal' | 'plaid';
type PayoutAccount = {
  id: string;
  stripe_account_id: string;
  payouts_enabled: boolean;
  details_submitted: boolean;
  verification_status: string;
  payout_type?: string;
  paypal_email?: string;
} | null;

interface FormState {
  category: string;
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
const WIZARD_STEPS: { key: WizardStep; label: string; num: number }[] = [
  { key: 'type',    label: 'Campaign Type', num: 1 },
  { key: 'details', label: 'Details',       num: 2 },
  { key: 'story',   label: 'Your Story',    num: 3 },
  { key: 'media',   label: 'Media & Trust', num: 4 },
  { key: 'preview', label: 'Preview',       num: 5 },
  { key: 'payout',  label: 'Get Paid',      num: 6 },
  { key: 'summary', label: 'Review',        num: 7 },
];

const JOURNEY_STEPS = ['Plan', 'Create', 'Launch', 'Manage', 'Celebrate', 'Impact'];

const ALLOWED_IMG_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
]);
const MAX_IMG_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES   = 10;

const CATEGORY_META: Record<string, { icon: string; tone: string; desc: string }> = {
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

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
export default function CreatePage() {
  const [step, setStep]               = useState<WizardStep>('type');
  const [loading, setLoading]         = useState(false);
  const [aiLoading, setAiLoading]     = useState(false);
  const [error, setError]             = useState('');
  const [publishedSlug, setPublishedSlug] = useState('');
  const [userName, setUserName]       = useState<string | null>(null);
  const [userEmail, setUserEmail]     = useState<string | undefined>(undefined);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [payoutAccount, setPayoutAccount] = useState<PayoutAccount>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMethod, setPayoutMethod]   = useState<PayoutMethod | null>(null);
  const [paypalEmail, setPaypalEmail]     = useState('');
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [isGuest, setIsGuest]         = useState<boolean | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setIsGuest(true);
        const saved = sessionStorage.getItem('cm_wizard');
        if (saved) {
          try {
            const { savedForm, savedStep } = JSON.parse(saved) as { savedForm: FormState; savedStep: WizardStep };
            setForm(savedForm);
            setStep(savedStep);
          } catch { /* ignore */ }
          sessionStorage.removeItem('cm_wizard');
        }
        return;
      }
      setIsGuest(false);
      setUserEmail(user.email ?? undefined);
      const saved = sessionStorage.getItem('cm_wizard');
      if (saved) {
        try {
          const { savedForm, savedStep } = JSON.parse(saved) as { savedForm: FormState; savedStep: WizardStep };
          setForm(savedForm);
          setStep(savedStep);
        } catch { /* ignore */ }
        sessionStorage.removeItem('cm_wizard');
      }
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
  }, []);

  const [form, setForm] = useState<FormState>({
    category: 'Medical',
    title: '',
    tagline: '',
    goal: '',
    deadline: '',
    beneficiaryName: '',
    beneficiaryRelationship: '',
    description: '',
    coverImageUrl: '',
  });

  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [dragging, setDragging]             = useState(false);
  const [uploadError, setUploadError]       = useState('');
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
        if (!acct && orgSite.startsWith('paypal:')) {
          const email = orgSite.replace('paypal:', '');
          setPayoutAccount({ id: 'paypal', stripe_account_id: '', payouts_enabled: true, details_submitted: true, verification_status: 'verified', payout_type: 'paypal', paypal_email: email });
        } else {
          setPayoutAccount(acct as PayoutAccount);
        }
        setPayoutLoading(false);
      });
    });
  }, [step]);

  const upd = (k: keyof FormState, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const goalCents = Math.round((parseFloat(form.goal) || 0) * 100);
  const stepIdx   = WIZARD_STEPS.findIndex(s => s.key === step);
  const hasCover  = uploadedImages.some(img => img.status === 'done');

  const goNext = () => {
    setError('');
    if (step === 'media') {
      const stillUploading = uploadedImages.some(img => img.status === 'uploading');
      if (stillUploading) { setError('Please wait for all images to finish uploading.'); return; }
    }
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

  const runAi = async () => {
    setAiLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: form.category, goalAmount: goalCents || 500000, beneficiary: form.beneficiaryName || 'the beneficiary', notes: form.description || 'Help us write a compelling fundraiser.', tone: 'authentic' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'AI generation failed');
      setForm(prev => ({
        ...prev,
        title: prev.title || (typeof data.title === 'string' ? data.title : prev.title),
        tagline: prev.tagline || (typeof data.socialCaption === 'string' ? data.socialCaption : prev.tagline),
        description: prev.description.length > 80 ? prev.description : (typeof data.story === 'string' ? data.story : prev.description),
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const submitCampaign = async (status: 'draft' | 'active') => {
    if (form.title.trim().length < 3) { setError('Campaign title must be at least 3 characters.'); return; }
    if (status === 'active') {
      if (form.description.trim().length < 20) { setError('Campaign story must be at least 20 characters.'); return; }
      if (goalCents < 100) { setError('Fundraising goal must be at least $1.00.'); return; }
    }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title.trim(), tagline: form.tagline.trim() || undefined, description: form.description.trim() || 'Draft — story coming soon.', goalAmount: goalCents || 100, deadline: form.deadline || null, category: form.category, coverImageUrl: form.coverImageUrl || null, imageUrls: uploadedImages.filter(img => img.status === 'done').map(img => img.url), beneficiaryName: form.beneficiaryName.trim() || undefined, beneficiaryRelationship: form.beneficiaryRelationship.trim() || undefined, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `Failed to ${status === 'draft' ? 'save draft' : 'publish'}.`);
      if (status === 'draft') { setError(''); window.location.href = '/dashboard/campaigns'; return; }
      setPublishedSlug(typeof data.slug === 'string' ? data.slug : '');
      setStep('live');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const publish = () => submitCampaign('active');
  const saveDraft = () => submitCampaign('draft');

  const payoutLinked = Boolean(
    payoutAccount && (
      (payoutAccount.payout_type === 'paypal' && payoutAccount.paypal_email) ||
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

  const savePaypal = async () => {
    if (!paypalEmail.trim() || !paypalEmail.includes('@')) { setError('Please enter a valid PayPal email address.'); return; }
    setLoading(true); setError('');
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error: profileErr } = await supabase.from('profiles').update({ org_website: `paypal:${paypalEmail.trim()}` } as Record<string, string>).eq('id', user.id);
      if (profileErr) throw new Error('Failed to save PayPal email.');
      setPayoutMethod(null);
      setPayoutAccount({ id: 'paypal', stripe_account_id: '', payouts_enabled: true, details_submitted: true, verification_status: 'verified', payout_type: 'paypal', paypal_email: paypalEmail.trim() });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save PayPal email.');
    } finally {
      setLoading(false);
    }
  };

  const journeyState = (i: number): 'done' | 'active' | '' => {
    if (i === 0) return 'done';
    if (i === 1) return stepIdx <= 3 ? 'active' : 'done';
    if (i === 2) { if (step === 'live') return 'done'; if (step === 'preview') return 'active'; return ''; }
    return '';
  };

  const goalDisplay = parseFloat(form.goal || '0').toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // ─────────────────────────────────────────────
  return (
    <CharitMeShell active="My Campaigns" userName={userName} userEmail={userEmail} userAvatarUrl={userAvatarUrl} guestMode={isGuest !== false} hideSidebar>

      {/* ── Gradient Hero Banner ── */}
      {step !== 'live' && (
        <div className="cr2-hero">
          <div className="cr2-hero-glow" />
          <div className="cr2-hero-inner">
            <div className="cr2-hero-top">
              <Link href="/dashboard/campaigns" className="cr2-back-link">← My Campaigns</Link>
              <div className="cr2-step-badge">Step {stepIdx + 1} / {WIZARD_STEPS.length}</div>
              <Link href="/ai-fundraising" className="cr2-ai-hero-cta">
                <KFIcon name="send" /> Use AI Instead
              </Link>
            </div>
            <h1 className="cr2-hero-title">
              {step === 'type'    && 'Choose Your Campaign Type'}
              {step === 'details' && 'Campaign Details'}
              {step === 'story'   && 'Tell Your Story'}
              {step === 'media'   && 'Media & Trust Signals'}
              {step === 'preview' && 'Preview Your Campaign'}
              {step === 'payout'  && 'Get Paid'}
              {step === 'summary' && 'Review & Launch'}
            </h1>
            <p className="cr2-hero-sub">
              {step === 'type'    && 'Pick the category that best fits your cause — this helps donors discover you.'}
              {step === 'details' && 'Set your title, funding goal, and beneficiary. AI can suggest your goal amount.'}
              {step === 'story'   && 'Write a compelling story — campaigns with great stories raise 3× more.'}
              {step === 'media'   && 'Upload photos and verify your trust signals to maximize donations.'}
              {step === 'preview' && 'See exactly how your campaign looks to donors before publishing.'}
              {step === 'payout'  && 'Connect your payout account so donations reach you directly — 0% platform fee.'}
              {step === 'summary' && "Everything looks great? Hit launch and start collecting donations today!"}
            </p>
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
                  <button type="button" className="cr2-ai-banner-btn" onClick={runAi} disabled={aiLoading}>
                    {aiLoading ? 'Generating…' : '✨ Write with AI'}
                  </button>
                </div>
              )}

              {/* ── Step: Type ── */}
              {step === 'type' && (
                <div className="cr2-cat-grid">
                  {CAMPAIGN_CATEGORIES.map(cat => {
                    const meta = CATEGORY_META[cat] ?? { icon: 'stack', tone: 'violet', desc: '' };
                    return (
                      <button
                        key={cat}
                        type="button"
                        className={`cr2-cat-tile cr2-tone-${meta.tone}${form.category === cat ? ' selected' : ''}`}
                        onClick={() => upd('category', cat)}
                      >
                        <div className="cr2-cat-icon"><KFIcon name={meta.icon} /></div>
                        <strong>{cat}</strong>
                        <span>{meta.desc}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Step: Details ── */}
              {step === 'details' && (
                <div className="cr2-form-panel">
                  <div className="cr2-field">
                    <label>Campaign Title *</label>
                    <input type="text" value={form.title} onChange={e => upd('title', e.target.value)} placeholder="e.g. Help Sarah cover emergency medical bills" maxLength={100} />
                  </div>
                  <div className="cr2-field">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Fundraising Goal ($) *</span>
                      <button
                        type="button"
                        className="cr2-ai-suggest"
                        onClick={async () => {
                          if (!form.category) return;
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
                    <input type="number" value={form.goal} onChange={e => upd('goal', e.target.value)} placeholder="25000" min="1" step="any" />
                  </div>
                  <div className="cr2-field">
                    <label>Campaign Deadline <span className="cr2-optional">— optional</span></label>
                    <input type="date" value={form.deadline} onChange={e => upd('deadline', e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="cr2-field">
                      <label>Beneficiary Name</label>
                      <input type="text" value={form.beneficiaryName} onChange={e => upd('beneficiaryName', e.target.value)} placeholder="Jane Smith" maxLength={120} />
                    </div>
                    <div className="cr2-field">
                      <label>Your Relationship</label>
                      <input type="text" value={form.beneficiaryRelationship} onChange={e => upd('beneficiaryRelationship', e.target.value)} placeholder="Sister, friend, myself…" maxLength={120} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step: Story ── */}
              {step === 'story' && (
                <div className="cr2-form-panel">
                  <div className="cr2-field">
                    <label>Short Tagline <span className="cr2-optional">— one sentence that hooks donors</span></label>
                    <input type="text" value={form.tagline} onChange={e => upd('tagline', e.target.value)} placeholder="A clear, emotional summary of your need" maxLength={160} />
                  </div>
                  <div className="cr2-field">
                    <label>Campaign Story * <span className="cr2-optional">— min. 20 characters</span></label>
                    <textarea
                      value={form.description}
                      onChange={e => upd('description', e.target.value)}
                      placeholder={'Who needs help? What happened? Why now?\nHow will the funds be used? What will change?'}
                      rows={10}
                    />
                  </div>
                </div>
              )}

              {/* ── Step: Media ── */}
              {step === 'media' && (
                <div className="cr2-form-panel">
                  <div className="cr2-field">
                    <label>Campaign Photos <span className="cr2-optional">— campaigns with photos raise 3× more</span></label>
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
                      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif" multiple style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files)} onClick={e => { (e.target as HTMLInputElement).value = ''; }} />
                      <div className="cr2-upload-icon"><KFIcon name="upload" /></div>
                      <strong>{dragging ? 'Release to upload' : 'Drop images here or click to browse'}</strong>
                      <span>JPG, PNG, GIF, WebP, AVIF · up to {MAX_IMAGES} images · 10 MB each</span>
                    </div>
                    {uploadError && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444', fontWeight: 700 }}>{uploadError}</p>}
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

                  <div className="cr2-trust-check">
                    <p className="cr2-label-sm">Trust Signal Checklist</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <TrustRow label="Campaign story written"  done={form.description.length > 80} />
                      <TrustRow label="Goal amount set"         done={goalCents >= 100} />
                      <TrustRow label="Cover photo added"       done={hasCover} />
                      <TrustRow label="Beneficiary identified"  done={Boolean(form.beneficiaryName)} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step: Preview ── */}
              {step === 'preview' && (
                <div className="cr2-form-panel">
                  <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 18 }}>
                    This is how your campaign appears to donors. Click <strong>Launch Campaign</strong> when ready.
                  </p>
                  <div className="cr2-preview-card">
                    <div className="cr2-preview-cover" style={form.coverImageUrl ? { backgroundImage: `url(${form.coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}} />
                    <div className="cr2-preview-body">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span className="kf-pill violet" style={{ fontSize: 10 }}>{form.category}</span>
                        {form.beneficiaryName && <span style={{ fontSize: 12, color: 'var(--t3)' }}>for {form.beneficiaryName}</span>}
                      </div>
                      <h3>{form.title || 'Your Campaign Title'}</h3>
                      <p>
                        {(form.tagline || form.description).slice(0, 140) || 'Your campaign story excerpt will appear here for donors to read.'}
                        {(form.tagline || form.description).length > 140 ? '…' : ''}
                      </p>
                      <div className="cr2-preview-progress"><span /></div>
                      <div className="cr2-preview-stats">
                        <span><strong>$0</strong> raised</span>
                        <span>of <strong>${goalDisplay}</strong> goal</span>
                        <span><strong>0</strong> donors</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step: Payout ── */}
              {step === 'payout' && (
                <div className="cr2-form-panel">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t2)' }}>Payout Status</span>
                    {payoutLoading ? (
                      <span style={{ fontSize: 12, color: 'var(--t3)' }}>Checking…</span>
                    ) : payoutLinked ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 999, fontSize: 12, fontWeight: 800, color: '#15803d' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> Linked
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 999, fontSize: 12, fontWeight: 800, color: '#dc2626' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> Not Linked
                      </span>
                    )}
                  </div>

                  {payoutLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--t3)', fontSize: 14 }}>Checking your payout account…</div>
                  ) : payoutLinked && payoutAccount ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 14, marginBottom: 16 }}>
                        <span style={{ fontSize: 32, flexShrink: 0 }}>{payoutAccount.payout_type === 'paypal' ? '💙' : '🏦'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 900, fontSize: 15, color: '#15803d', marginBottom: 3 }}>{payoutAccount.payout_type === 'paypal' ? 'PayPal Account Linked' : 'Stripe Bank Account Linked'}</div>
                          <div style={{ fontSize: 13, color: '#166534' }}>{payoutAccount.payout_type === 'paypal' ? `Donations will be sent to ${payoutAccount.paypal_email}` : 'Direct bank deposits enabled. Funds arrive within 2 business days.'}</div>
                        </div>
                        <span style={{ fontSize: 20 }}>✓</span>
                      </div>
                      {payoutAccount.stripe_account_id && (
                        <div style={{ padding: '12px 16px', background: '#f8f9fc', borderRadius: 10, border: '1px solid #eef0f7', fontSize: 12, color: 'var(--t3)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                          <span>Account: {payoutAccount.stripe_account_id.slice(0, 14)}…</span>
                          <span style={{ color: '#16a34a', fontWeight: 700 }}>● Payouts active</span>
                        </div>
                      )}
                      <button type="button" onClick={() => { setPayoutAccount(null); setPayoutMethod(null); }} style={{ fontSize: 12, color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Connect a different account instead</button>
                    </div>
                  ) : payoutAccount && !payoutAccount.payouts_enabled ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 14, marginBottom: 20 }}>
                        <span style={{ fontSize: 28 }}>⚠️</span>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 15, color: '#92400e' }}>Stripe Onboarding Incomplete</div>
                          <div style={{ fontSize: 13, color: '#78350f', marginTop: 2 }}>You started connecting Stripe but didn&apos;t finish. Complete setup to receive payouts.</div>
                        </div>
                      </div>
                      <button type="button" onClick={() => void connectStripe()} disabled={connectingStripe} style={{ width: '100%', height: 46, background: '#6c35ff', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 10 }}>
                        {connectingStripe ? 'Redirecting to Stripe…' : 'Complete Stripe Setup →'}
                      </button>
                      <button type="button" onClick={goNext} style={{ width: '100%', height: 40, background: 'none', color: 'var(--t3)', border: '1px solid var(--b2)', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Skip for now — set up payouts later</button>
                    </div>
                  ) : payoutMethod === 'stripe' ? (
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Connect with Stripe</div>
                      <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20, lineHeight: 1.6 }}>Stripe is the most trusted way to receive donations. You&apos;ll be redirected to Stripe to verify your identity and connect your bank account. Takes 5 minutes.</p>
                      <div style={{ display: 'flex', gap: 10, padding: '14px 18px', background: '#f0eaff', borderRadius: 12, marginBottom: 20, fontSize: 13 }}>
                        <span>🔒</span>
                        <span style={{ color: '#4c1d95', fontWeight: 700 }}>Bank-level encryption · No card fees charged by CharitMe · Funds deposited directly to your bank</span>
                      </div>
                      <button type="button" onClick={() => void connectStripe()} disabled={connectingStripe} style={{ width: '100%', height: 48, background: '#6c35ff', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 10 }}>
                        {connectingStripe ? 'Redirecting to Stripe…' : '🏦 Connect Bank via Stripe →'}
                      </button>
                      <button type="button" onClick={() => setPayoutMethod(null)} style={{ fontSize: 12, color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>← Back to options</button>
                    </div>
                  ) : payoutMethod === 'paypal' ? (
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Connect PayPal</div>
                      <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20, lineHeight: 1.6 }}>Enter your PayPal email address. CharitMe will send donations directly to this account. PayPal fees apply on their end.</p>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--t2)', marginBottom: 6 }}>PayPal Email Address</label>
                      <input type="email" value={paypalEmail} onChange={e => setPaypalEmail(e.target.value)} placeholder="you@paypal.com" style={{ width: '100%', height: 44, border: '1.5px solid var(--b2)', borderRadius: 10, padding: '0 14px', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
                      <button type="button" onClick={() => void savePaypal()} disabled={loading || !paypalEmail.trim()} style={{ width: '100%', height: 46, background: '#003087', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 10 }}>
                        {loading ? 'Saving…' : '💙 Save PayPal Account'}
                      </button>
                      <button type="button" onClick={() => setPayoutMethod(null)} style={{ fontSize: 12, color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>← Back to options</button>
                    </div>
                  ) : payoutMethod === 'plaid' ? (
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>Connect Bank via Plaid</div>
                      <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20, lineHeight: 1.6 }}>Plaid lets you instantly link your bank account. Secure and instant.</p>
                      <div style={{ padding: '14px 18px', background: '#eff6ff', borderRadius: 12, marginBottom: 20, fontSize: 13, color: '#1e40af', fontWeight: 700 }}>🔗 Plaid integration coming soon. Use Stripe Connect for immediate bank deposits.</div>
                      <button type="button" onClick={() => setPayoutMethod('stripe')} style={{ width: '100%', height: 46, background: '#6c35ff', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 10 }}>Switch to Stripe Connect Instead →</button>
                      <button type="button" onClick={() => setPayoutMethod(null)} style={{ fontSize: 12, color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>← Back to options</button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6, color: 'var(--t1)' }}>How do you want to receive donations?</div>
                      <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 22, lineHeight: 1.6 }}>CharitMe charges 0% platform fees. Connect once — donations go directly to you.</p>
                      <button type="button" onClick={() => setPayoutMethod('stripe')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', marginBottom: 12, background: '#fff', border: '2px solid #6c35ff', borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ fontSize: 28, flexShrink: 0 }}>🏦</span>
                        <div style={{ flex: 1 }}><div style={{ fontWeight: 900, fontSize: 14, color: '#1a1a2e' }}>Stripe Connect <span style={{ fontSize: 11, background: '#6c35ff', color: '#fff', padding: '2px 8px', borderRadius: 6, marginLeft: 6, fontWeight: 800 }}>RECOMMENDED</span></div><div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>Direct bank deposit · Identity verified · Most trusted</div></div>
                        <span style={{ color: '#6c35ff', fontWeight: 900, fontSize: 18 }}>›</span>
                      </button>
                      <button type="button" onClick={() => setPayoutMethod('paypal')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', marginBottom: 12, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ fontSize: 28, flexShrink: 0 }}>💙</span>
                        <div style={{ flex: 1 }}><div style={{ fontWeight: 900, fontSize: 14, color: '#1a1a2e' }}>PayPal</div><div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>Send to your PayPal account · PayPal fees apply</div></div>
                        <span style={{ color: 'var(--t3)', fontWeight: 900, fontSize: 18 }}>›</span>
                      </button>
                      <button type="button" onClick={() => setPayoutMethod('plaid')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', marginBottom: 20, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14, cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ fontSize: 28, flexShrink: 0 }}>🔗</span>
                        <div style={{ flex: 1 }}><div style={{ fontWeight: 900, fontSize: 14, color: '#1a1a2e' }}>Plaid Bank Link <span style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 6, marginLeft: 6, fontWeight: 800 }}>COMING SOON</span></div><div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>Instant bank connection · No manual routing numbers</div></div>
                        <span style={{ color: 'var(--t3)', fontWeight: 900, fontSize: 18 }}>›</span>
                      </button>
                      <div style={{ textAlign: 'center', borderTop: '1px solid var(--b2)', paddingTop: 16 }}>
                        <button type="button" onClick={goNext} style={{ fontSize: 13, color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer' }}>Skip for now — I&apos;ll set up payouts after launch</button>
                        <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 4 }}>You can connect your payout account anytime from your dashboard.</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Step: Summary / Review & Launch ── */}
              {step === 'summary' && (
                <div className="cr2-form-panel">
                  <div style={{ background: '#f8f9fc', border: '1px solid #eef0f7', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef0f7', background: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>📋</span>
                      <strong style={{ fontSize: 14, color: 'var(--t1)' }}>Campaign Summary</strong>
                    </div>
                    {[
                      { label: 'Title',       value: form.title || '—',                                                         ok: form.title.length >= 3 },
                      { label: 'Category',    value: form.category,                                                              ok: true },
                      { label: 'Goal',        value: goalCents >= 100 ? `$${(goalCents / 100).toLocaleString()}` : '—',          ok: goalCents >= 100 },
                      { label: 'Deadline',    value: form.deadline || 'No deadline',                                             ok: true },
                      { label: 'Beneficiary', value: form.beneficiaryName || 'Self',                                             ok: true },
                      { label: 'Story',       value: form.description.length >= 20 ? `${form.description.slice(0, 60)}…` : '—', ok: form.description.length >= 20 },
                      { label: 'Cover Photo', value: hasCover ? '✓ Uploaded' : 'None (optional)',                                ok: hasCover },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', borderBottom: '1px solid #f0f2f7' }}>
                        <span style={{ fontSize: 13, color: 'var(--t3)', fontWeight: 700, minWidth: 110 }}>{row.label}</span>
                        <span style={{ fontSize: 13, fontWeight: row.ok ? 700 : 600, textAlign: 'right', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: row.ok ? 'var(--t1)' : '#ef4444' }}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#f8f9fc', border: '1px solid #eef0f7', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef0f7', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>💳</span>
                        <strong style={{ fontSize: 14, color: 'var(--t1)' }}>Payout Account</strong>
                      </div>
                      {payoutLinked
                        ? <span style={{ fontSize: 11, fontWeight: 800, color: '#15803d', background: '#f0fdf4', border: '1px solid #86efac', padding: '3px 10px', borderRadius: 999 }}>● Linked</span>
                        : <span style={{ fontSize: 11, fontWeight: 800, color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', padding: '3px 10px', borderRadius: 999 }}>● Not Linked</span>
                      }
                    </div>
                    <div style={{ padding: '14px 20px', fontSize: 13, color: 'var(--t2)' }}>
                      {payoutLinked && payoutAccount
                        ? payoutAccount.payout_type === 'paypal' ? `PayPal · ${payoutAccount.paypal_email}` : `Stripe Connect · ${payoutAccount.stripe_account_id.slice(0, 14)}…`
                        : <span style={{ color: '#92400e' }}>⚠ No payout account linked. You can still launch — connect payouts from your dashboard before your first withdrawal.</span>
                      }
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, padding: '14px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>🎉</span>
                    <div style={{ fontSize: 13, color: '#15803d', fontWeight: 700, lineHeight: 1.6 }}>
                      CharitMe charges <strong>0% platform fees</strong>. 100% of donations go to your campaign. Stripe processing fees (2.9% + $0.30) are covered by donors optionally.
                    </div>
                  </div>

                  {(form.title.length < 3 || goalCents < 100 || form.description.length < 20) && (
                    <div style={{ padding: '14px 18px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, fontSize: 13, color: '#92400e' }}>
                      <strong>Fix before launching:</strong>
                      <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 2 }}>
                        {form.title.length < 3 && <li>Campaign title too short (min 3 characters)</li>}
                        {goalCents < 100 && <li>Set a fundraising goal (min $1.00)</li>}
                        {form.description.length < 20 && <li>Write your campaign story (min 20 characters)</li>}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && <div className="cr2-error">{error}</div>}

              {/* Navigation */}
              <div className="cr2-nav">
                <button type="button" className="cr2-nav-back" onClick={goPrev} disabled={stepIdx === 0}>← Back</button>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {stepIdx >= 1 && step !== 'preview' && step !== 'payout' && step !== 'summary' && (
                    <button type="button" className="cr2-nav-draft" onClick={() => void saveDraft()} disabled={loading}>
                      {loading ? 'Saving…' : 'Save Draft'}
                    </button>
                  )}
                  {step === 'summary' ? (
                    <button
                      type="button"
                      className="cr2-nav-launch"
                      onClick={() => { if (isGuest !== false) { setShowLoginModal(true); } else { void publish(); } }}
                      disabled={loading}
                    >
                      {loading ? 'Launching…' : '🚀 Launch Campaign'}
                    </button>
                  ) : (
                    <button type="button" className="cr2-nav-next" onClick={goNext}>Continue →</button>
                  )}
                </div>
              </div>
            </section>

            {/* ─── Right: sidebar ─── */}
            <aside className="cr2-side">
              <div className="cr2-side-card">
                <div className="cr2-side-head">Your Progress</div>
                <div className="cr2-progress-list">
                  <TrustRow label="Category selected"  done />
                  <TrustRow label="Title & goal set"   done={form.title.length >= 3 && goalCents >= 100} />
                  <TrustRow label="Story written"      done={form.description.length > 80} />
                  <TrustRow label="Cover photo added"  done={hasCover} />
                  <TrustRow label="Beneficiary named"  done={Boolean(form.beneficiaryName)} />
                </div>
              </div>

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
            <p>Congratulations! Your fundraiser is now live and ready to receive donations. Share it everywhere to reach your goal faster.</p>
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
            <div style={{ borderTop: '1px solid var(--b1)', marginTop: 28, paddingTop: 24 }}>
              <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 800, color: 'var(--t3)' }}>Share your campaign</p>
              <ShareButtons slug={publishedSlug} />
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
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => { setIsGuest(false); setShowLoginModal(false); void publish(); }}
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

function GuestLoginModal({ onClose, onSuccess, savedForm, savedStep }: {
  onClose: () => void;
  onSuccess: () => void;
  savedForm: FormState;
  savedStep: WizardStep;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [modalMode, setModalMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail]   = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]     = useState('');
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState('');
  const [ok, setOk]         = useState('');

  const handleOAuth = (provider: 'google') => {
    sessionStorage.setItem('cm_wizard', JSON.stringify({ savedForm, savedStep }));
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
    <div className="guest-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="guest-modal-card">
        <button className="guest-modal-close" onClick={onClose} aria-label="Close">✕</button>
        <h2>{modalMode === 'login' ? 'Log in' : 'Sign up'}</h2>
        <p className="guest-modal-sub">{modalMode === 'login' ? 'Continue to your dashboard.' : 'Create your free account to launch.'}</p>
        <button className="guest-oauth-btn" onClick={() => handleOAuth('google')} disabled={busy} type="button">
          <GoogleMark /> Continue with Google
        </button>
        <div className="guest-modal-sep"><span>OR</span></div>
        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {modalMode === 'signup' && (
            <label className="guest-modal-label">Full name<input value={name} onChange={e => setName(e.target.value)} placeholder="Sarah Thompson" required autoComplete="name" /></label>
          )}
          <label className="guest-modal-label">Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label>
          <label className="guest-modal-label">Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required minLength={6} autoComplete={modalMode === 'login' ? 'current-password' : 'new-password'} /></label>
          {err && <p style={{ margin: 0, color: '#be123c', fontSize: 13, fontWeight: 700 }}>{err}</p>}
          {ok  && <p style={{ margin: 0, color: '#15803d', fontSize: 13, fontWeight: 700 }}>{ok}</p>}
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
// Sub-components
// ─────────────────────────────────────────────
function ShareButtons({ slug }: { slug: string }) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com'}/campaigns/${slug}`;
  const [copied, setCopied] = React.useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareItems = [
    { label: copied ? 'Copied!' : 'Copy Link', icon: 'link', onClick: () => void copyLink(), bg: copied ? '#19b86a' : 'var(--s3)', color: copied ? '#fff' : 'var(--t1)', border: '1px solid var(--b2)' },
    { label: 'Facebook', icon: 'users', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, bg: '#1877f2', color: '#fff' },
    { label: 'Twitter/X', icon: 'send', href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`, bg: '#000', color: '#fff' },
    { label: 'WhatsApp', icon: 'chat', href: `https://wa.me/?text=${encodeURIComponent(url)}`, bg: '#25d366', color: '#fff' },
    { label: 'Email', icon: 'doc', href: `mailto:?subject=Support%20my%20campaign&body=${encodeURIComponent(`Please support: ${url}`)}`, bg: 'var(--s3)', color: 'var(--t1)', border: '1px solid var(--b2)' },
  ] as const;

  const btnStyle = (item: typeof shareItems[number]) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
    cursor: 'pointer', textDecoration: 'none',
    background: item.bg, color: item.color,
    border: 'border' in item ? item.border : '0',
    transition: 'opacity .15s',
  });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {shareItems.map((item) => (
        'href' in item && item.href ? (
          <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" style={btnStyle(item)}>
            <KFIcon name={item.icon} />{item.label}
          </a>
        ) : (
          <button key={item.label} type="button" onClick={item.onClick} style={btnStyle(item)}>
            <KFIcon name={item.icon} />{item.label}
          </button>
        )
      ))}
    </div>
  );
}

function TrustRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className={`kf-trust-row${done ? ' done' : ''}`}>
      <span className="tr-dot">{done ? '✓' : ''}</span>
      {label}
    </div>
  );
}
