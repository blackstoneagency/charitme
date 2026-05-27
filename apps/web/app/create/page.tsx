'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { KindFundShell, TopBar, KFIcon } from '../../components/KindFundApp';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type WizardStep = 'type' | 'details' | 'story' | 'media' | 'preview' | 'live';

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
  url: string;       // blob URL while uploading → CDN URL when done
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
];

const JOURNEY_STEPS = ['Plan', 'Create', 'Launch', 'Manage', 'Celebrate', 'Impact'];

const ALLOWED_IMG_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
]);
const MAX_IMG_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_IMAGES   = 10;

const CATEGORY_META: Record<string, { icon: string; tone: string; desc: string }> = {
  Medical:            { icon: 'heart',  tone: 'violet', desc: 'Surgery, treatment, recovery' },
  'Memorial/Funeral': { icon: 'gift',   tone: 'violet', desc: 'Final expenses, tribute' },
  Emergency:          { icon: 'shield', tone: 'orange', desc: 'Crisis, urgent need' },
  'Disaster Relief':  { icon: 'send',   tone: 'orange', desc: 'Natural disasters, rebuilding' },
  Education:          { icon: 'doc',    tone: 'blue',   desc: 'School, tuition, scholarships' },
  'Animal/Pet':       { icon: 'heart',  tone: 'green',  desc: 'Vet care, rescue, shelter' },
  Community:          { icon: 'users',  tone: 'green',  desc: 'Events, local projects' },
  Nonprofit:          { icon: 'users',  tone: 'blue',   desc: 'Organizations, causes' },
  'Sports/Teams':     { icon: 'team',   tone: 'orange', desc: 'Athletics, travel, gear' },
  Other:              { icon: 'stack',  tone: 'violet', desc: 'Any other need' },
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

  // ── Image upload state ───────────────────────────────
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [dragging, setDragging]             = useState(false);
  const [uploadError, setUploadError]       = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlsRef  = useRef<string[]>([]);

  // Revoke all tracked blob URLs on unmount
  useEffect(() => {
    const refs = blobUrlsRef.current;
    return () => { refs.forEach(u => URL.revokeObjectURL(u)); };
  }, []);

  // Keep coverImageUrl synced with the first successfully uploaded image
  useEffect(() => {
    const first = uploadedImages.find(img => img.status === 'done');
    setForm(prev => ({ ...prev, coverImageUrl: first?.url ?? '' }));
  }, [uploadedImages]);

  // ────────────────────────────────────────────────────
  const upd = (k: keyof FormState, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const goalCents = Math.round((parseFloat(form.goal) || 0) * 100);
  const stepIdx   = WIZARD_STEPS.findIndex(s => s.key === step);
  const hasCover  = uploadedImages.some(img => img.status === 'done');

  const goNext = () => {
    setError('');
    if (step === 'media') {
      const stillUploading = uploadedImages.some(img => img.status === 'uploading');
      if (stillUploading) {
        setError('Please wait for all images to finish uploading before continuing.');
        return;
      }
    }
    const next = WIZARD_STEPS[stepIdx + 1];
    if (next) setStep(next.key);
  };

  const goPrev = () => {
    setError('');
    const prev = WIZARD_STEPS[stepIdx - 1];
    if (prev) setStep(prev.key);
  };

  // ── File upload ──────────────────────────────────────
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remaining = MAX_IMAGES - uploadedImages.length;
    if (remaining <= 0) {
      setUploadError(`Maximum ${MAX_IMAGES} images allowed.`);
      return;
    }

    const validFiles = Array.from(files)
      .filter(f => ALLOWED_IMG_TYPES.has(f.type) && f.size <= MAX_IMG_SIZE)
      .slice(0, remaining);

    const skipped = files.length - validFiles.length;
    if (validFiles.length === 0) {
      setUploadError('No valid images found. Use JPG, PNG, GIF, WebP, or AVIF under 10 MB.');
      return;
    }
    setUploadError(
      skipped > 0 ? `${skipped} file(s) skipped — invalid type or over 10 MB.` : '',
    );

    // Show blob previews immediately
    const newItems: UploadedImage[] = validFiles.map(f => {
      const blobUrl = URL.createObjectURL(f);
      blobUrlsRef.current.push(blobUrl);
      return {
        id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: blobUrl,
        name: f.name,
        status: 'uploading',
      };
    });
    setUploadedImages(prev => [...prev, ...newItems]);

    // Upload each file sequentially to the API
    for (let i = 0; i < validFiles.length; i++) {
      const file      = validFiles[i]!;
      const pendingId = newItems[i]!.id;
      const blobUrl   = newItems[i]!.url;

      try {
        const fd = new FormData();
        fd.append('file', file);

        const res  = await fetch('/api/upload/campaign-image', { method: 'POST', body: fd });
        const data = await res.json() as { url?: string; path?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Upload failed');

        // Replace blob URL with CDN URL
        URL.revokeObjectURL(blobUrl);
        blobUrlsRef.current = blobUrlsRef.current.filter(u => u !== blobUrl);

        setUploadedImages(prev =>
          prev.map(img =>
            img.id === pendingId
              ? { id: data.path!, url: data.url!, name: file.name, status: 'done' }
              : img,
          ),
        );
      } catch (e: unknown) {
        setUploadedImages(prev =>
          prev.map(img =>
            img.id === pendingId
              ? { ...img, status: 'error', errorMsg: e instanceof Error ? e.message : 'Upload failed' }
              : img,
          ),
        );
      }
    }
  }, [uploadedImages.length]);

  const removeImage = useCallback(async (img: UploadedImage) => {
    if (img.url.startsWith('blob:')) {
      URL.revokeObjectURL(img.url);
      blobUrlsRef.current = blobUrlsRef.current.filter(u => u !== img.url);
    }
    if (img.status === 'done') {
      // Fire-and-forget — frees storage in the background
      fetch('/api/upload/campaign-image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: img.id }),
      }).catch(() => undefined);
    }
    setUploadedImages(prev => prev.filter(i => i.id !== img.id));
  }, []);

  // ── AI generation ─────────────────────────────────────
  const runAi = async () => {
    setAiLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category:    form.category,
          goalAmount:  goalCents || 500000,
          beneficiary: form.beneficiaryName || 'the beneficiary',
          notes:       form.description || 'Help us write a compelling fundraiser.',
          tone:        'authentic',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'AI generation failed');
      setForm(prev => ({
        ...prev,
        title:       prev.title || (typeof data.title === 'string' ? data.title : prev.title),
        tagline:     prev.tagline || (typeof data.socialCaption === 'string' ? data.socialCaption : prev.tagline),
        description: prev.description.length > 80
          ? prev.description
          : (typeof data.story === 'string' ? data.story : prev.description),
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  // ── Publish ───────────────────────────────────────────
  const publish = async () => {
    if (form.title.trim().length < 3) {
      setError('Campaign title must be at least 3 characters.');
      return;
    }
    if (form.description.trim().length < 20) {
      setError('Campaign story must be at least 20 characters.');
      return;
    }
    if (goalCents < 100) {
      setError('Fundraising goal must be at least $1.00.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:                   form.title.trim(),
          tagline:                 form.tagline.trim() || undefined,
          description:             form.description.trim(),
          goalAmount:              goalCents,
          deadline:                form.deadline || null,
          category:                form.category,
          coverImageUrl:           form.coverImageUrl || null,
          imageUrls:               uploadedImages.filter(img => img.status === 'done').map(img => img.url),
          beneficiaryName:         form.beneficiaryName.trim() || undefined,
          beneficiaryRelationship: form.beneficiaryRelationship.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to publish campaign.');
      }
      setPublishedSlug(typeof data.slug === 'string' ? data.slug : '');
      setStep('live');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Publish failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Misc ─────────────────────────────────────────────
  const journeyState = (i: number): 'done' | 'active' | '' => {
    if (i === 0) return 'done';
    if (i === 1) return stepIdx <= 3 ? 'active' : 'done';
    if (i === 2) {
      if (step === 'live') return 'done';
      if (step === 'preview') return 'active';
      return '';
    }
    return '';
  };

  const goalDisplay = parseFloat(form.goal || '0').toLocaleString('en-US', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });

  return (
    <KindFundShell active="My Campaigns">
      <TopBar
        title="Create Campaign"
        subtitle="Launch a trusted fundraiser in minutes with AI Copilot."
        actions={
          <Link
            href="/dashboard/campaigns"
            style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3)', textDecoration: 'none' }}
          >
            ← My Campaigns
          </Link>
        }
      />

      <div className="kf-create-wizard">

        {/* ── Step progress track ── */}
        {step !== 'live' && (
          <div className="kf-step-track">
            {WIZARD_STEPS.map((s, i) => {
              const isDone   = i < stepIdx;
              const isActive = s.key === step;
              return (
                <div
                  key={s.key}
                  className={`kf-step-track-item${isActive ? ' active' : isDone ? ' done' : ''}`}
                >
                  <span className="kf-step-num">{isDone ? '✓' : s.num}</span>
                  {s.label}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Main layout ── */}
        {step !== 'live' ? (
          <div className="kf-create-layout">

            {/* ─── Left: wizard panel ─── */}
            <section className="kf-card kf-form-card">

              {/* AI banner — story step only */}
              {step === 'story' && (
                <div className="kf-ai-banner">
                  <KFIcon name="send" />
                  <div>
                    <strong>AI Copilot</strong>
                    <p>Automatically write your story, title, and social captions.</p>
                  </div>
                  <button type="button" onClick={runAi} disabled={aiLoading}>
                    {aiLoading ? 'Generating…' : 'Write with AI'}
                  </button>
                </div>
              )}

              <div className="kf-card-head">
                <div>
                  <h2>
                    {step === 'type'    && 'Choose Campaign Type'}
                    {step === 'details' && 'Campaign Details'}
                    {step === 'story'   && 'Your Story & Content'}
                    {step === 'media'   && 'Media & Trust Signals'}
                    {step === 'preview' && 'Preview Your Campaign'}
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--t3)', margin: '4px 0 0' }}>
                    {step === 'type'    && 'Select the category that best describes your fundraiser.'}
                    {step === 'details' && 'Enter your campaign title, goal, and beneficiary information.'}
                    {step === 'story'   && 'Write a compelling story — this is what donors read before giving.'}
                    {step === 'media'   && 'Upload photos to make your campaign 3× more effective.'}
                    {step === 'preview' && 'Review how your campaign will appear to donors before going live.'}
                  </p>
                </div>
              </div>

              {/* ── Step: Type ── */}
              {step === 'type' && (
                <div className="kf-type-grid">
                  {CAMPAIGN_CATEGORIES.map(cat => {
                    const meta = CATEGORY_META[cat] ?? { icon: 'stack', tone: 'violet', desc: '' };
                    return (
                      <button
                        key={cat}
                        type="button"
                        className={`kf-type-tile${form.category === cat ? ' selected' : ''}`}
                        onClick={() => upd('category', cat)}
                      >
                        <div className={`kf-square ${meta.tone}`}>
                          <KFIcon name={meta.icon} />
                        </div>
                        <strong>{cat}</strong>
                        <span>{meta.desc}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Step: Details ── */}
              {step === 'details' && (
                <div className="kf-form-panel">
                  <div className="kf-field">
                    <label>Campaign Title *</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={e => upd('title', e.target.value)}
                      placeholder="e.g. Help Sarah cover emergency medical bills"
                      maxLength={100}
                    />
                  </div>
                  <div className="kf-field">
                    <label>Fundraising Goal ($) *</label>
                    <input
                      type="number"
                      value={form.goal}
                      onChange={e => upd('goal', e.target.value)}
                      placeholder="25000"
                      min="1"
                      step="any"
                    />
                  </div>
                  <div className="kf-field">
                    <label>
                      Campaign Deadline{' '}
                      <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0, color: 'var(--t3)' }}>
                        — optional
                      </span>
                    </label>
                    <input
                      type="date"
                      value={form.deadline}
                      onChange={e => upd('deadline', e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="kf-field">
                      <label>Beneficiary Name</label>
                      <input
                        type="text"
                        value={form.beneficiaryName}
                        onChange={e => upd('beneficiaryName', e.target.value)}
                        placeholder="Jane Smith"
                        maxLength={120}
                      />
                    </div>
                    <div className="kf-field">
                      <label>Your Relationship</label>
                      <input
                        type="text"
                        value={form.beneficiaryRelationship}
                        onChange={e => upd('beneficiaryRelationship', e.target.value)}
                        placeholder="Sister, friend, myself…"
                        maxLength={120}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step: Story ── */}
              {step === 'story' && (
                <div className="kf-form-panel">
                  <div className="kf-field">
                    <label>
                      Short Tagline{' '}
                      <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0, color: 'var(--t3)' }}>
                        — one sentence that hooks donors
                      </span>
                    </label>
                    <input
                      type="text"
                      value={form.tagline}
                      onChange={e => upd('tagline', e.target.value)}
                      placeholder="A clear, emotional summary of your need"
                      maxLength={160}
                    />
                  </div>
                  <div className="kf-field">
                    <label>
                      Campaign Story *{' '}
                      <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0, color: 'var(--t3)' }}>
                        — min. 20 characters
                      </span>
                    </label>
                    <textarea
                      value={form.description}
                      onChange={e => upd('description', e.target.value)}
                      placeholder={
                        'Who needs help? What happened? Why now?\n' +
                        'How will the funds be used? What will change?'
                      }
                      rows={10}
                    />
                  </div>
                </div>
              )}

              {/* ── Step: Media ── */}
              {step === 'media' && (
                <div className="kf-form-panel">

                  {/* ── Upload drop zone ── */}
                  <div className="kf-field">
                    <label>
                      Campaign Photos{' '}
                      <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0, color: 'var(--t3)' }}>
                        — campaigns with photos raise 3× more
                      </span>
                    </label>

                    <div
                      className={`kf-upload-zone${dragging ? ' dragging' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={e => { e.preventDefault(); setDragging(false); }}
                      onDrop={e => {
                        e.preventDefault();
                        setDragging(false);
                        handleFileSelect(e.dataTransfer.files);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                      aria-label="Upload campaign images"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                        multiple
                        style={{ display: 'none' }}
                        onChange={e => handleFileSelect(e.target.files)}
                        onClick={e => { (e.target as HTMLInputElement).value = ''; }}
                      />
                      <div className="kf-upload-icon">
                        <KFIcon name="upload" />
                      </div>
                      <strong>
                        {dragging ? 'Release to upload' : 'Drop images here or click to browse'}
                      </strong>
                      <span>JPG, PNG, GIF, WebP, AVIF — up to {MAX_IMAGES} images · 10 MB each</span>
                    </div>

                    {uploadError && (
                      <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444', fontWeight: 700 }}>
                        {uploadError}
                      </p>
                    )}
                  </div>

                  {/* ── Image gallery ── */}
                  {uploadedImages.length > 0 && (
                    <div>
                      <p style={{
                        fontSize: 11, fontWeight: 900, letterSpacing: '.05em',
                        textTransform: 'uppercase', color: 'var(--t3)', margin: '0 0 10px',
                      }}>
                        Uploaded Photos ({uploadedImages.length} / {MAX_IMAGES})
                      </p>

                      <div className="kf-img-gallery">
                        {uploadedImages.map((img, i) => (
                          <div
                            key={img.id}
                            className={[
                              'kf-img-thumb',
                              i === 0 && img.status === 'done' ? 'cover' : '',
                              img.status === 'uploading'       ? 'uploading' : '',
                              img.status === 'error'           ? 'img-error' : '',
                            ].filter(Boolean).join(' ')}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt={img.name} />

                            {i === 0 && img.status === 'done' && (
                              <span className="kf-cover-badge">Cover</span>
                            )}

                            {img.status === 'uploading' && (
                              <div className="kf-thumb-overlay">
                                <div className="kf-upload-spinner" />
                              </div>
                            )}

                            {img.status === 'error' && (
                              <div className="kf-thumb-overlay kf-thumb-error">
                                <span>Failed</span>
                              </div>
                            )}

                            <button
                              type="button"
                              className="kf-img-remove"
                              onClick={e => { e.stopPropagation(); void removeImage(img); }}
                              aria-label={`Remove ${img.name}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>

                      <p style={{ fontSize: 12, color: 'var(--t3)', margin: '10px 0 0', lineHeight: 1.45 }}>
                        The first photo becomes your cover image. Remove and re-upload to reorder.
                      </p>
                    </div>
                  )}

                  {/* ── Trust signal checklist ── */}
                  <div style={{ borderTop: '1px solid var(--b1)', paddingTop: 16 }}>
                    <p style={{
                      fontSize: 11, fontWeight: 900, letterSpacing: '.05em',
                      textTransform: 'uppercase', color: 'var(--t3)', margin: '0 0 12px',
                    }}>
                      Trust Signal Checklist
                    </p>
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
                <div className="kf-preview-campaign">
                  <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 18 }}>
                    This is how your campaign appears to donors. Click{' '}
                    <strong>Launch Campaign</strong> when ready.
                  </p>

                  <div className="kf-preview-card">
                    <div
                      className="kf-preview-cover"
                      style={form.coverImageUrl ? {
                        backgroundImage: `url(${form.coverImageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      } : {}}
                    />
                    <div className="kf-preview-body">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span className="kf-pill violet" style={{ fontSize: 10 }}>{form.category}</span>
                        {form.beneficiaryName && (
                          <span style={{ fontSize: 12, color: 'var(--t3)' }}>
                            for {form.beneficiaryName}
                          </span>
                        )}
                      </div>
                      <h3>{form.title || 'Your Campaign Title'}</h3>
                      <p>
                        {(form.tagline || form.description).slice(0, 140) ||
                          'Your campaign story excerpt will appear here for donors to read.'}
                        {(form.tagline || form.description).length > 140 ? '…' : ''}
                      </p>
                      <div className="kf-preview-progress"><span /></div>
                      <div className="kf-preview-stats">
                        <span><strong>$0</strong> raised</span>
                        <span>of <strong>${goalDisplay}</strong> goal</span>
                        <span><strong>0</strong> donors</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div style={{
                  margin: '0 20px 16px', padding: '12px 14px', borderRadius: 9,
                  background: '#fff0f3', color: '#ef4444', fontSize: 13, fontWeight: 700,
                }}>
                  {error}
                </div>
              )}

              {/* Navigation */}
              <div className="kf-create-nav">
                <button
                  type="button"
                  className="kf-nav-back"
                  onClick={goPrev}
                  disabled={stepIdx === 0}
                >
                  ← Back
                </button>

                {step === 'preview' ? (
                  <button type="button" className="kf-nav-launch" onClick={publish} disabled={loading}>
                    {loading ? 'Launching…' : '🚀 Launch Campaign'}
                  </button>
                ) : (
                  <button type="button" className="kf-nav-next" onClick={goNext}>
                    Continue →
                  </button>
                )}
              </div>
            </section>

            {/* ─── Right: sidebar ─── */}
            <aside className="kf-create-side">
              <section className="kf-card">
                <div className="kf-card-head">
                  <h2>Your Progress</h2>
                </div>
                <div className="kf-trust-checklist">
                  <TrustRow label="Category selected"  done />
                  <TrustRow label="Title & goal set"   done={form.title.length >= 3 && goalCents >= 100} />
                  <TrustRow label="Story written"      done={form.description.length > 80} />
                  <TrustRow label="Cover photo added"  done={hasCover} />
                  <TrustRow label="Beneficiary named"  done={Boolean(form.beneficiaryName)} />
                </div>
              </section>

              <section className="kf-card">
                <div className="kf-card-head">
                  <h2>Tips to Raise More</h2>
                </div>
                <div style={{ padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { icon: 'chart', tip: 'Campaigns with a specific goal raise 89% more than vague asks.' },
                    { icon: 'send',  tip: 'Sharing in the first 24 hours drives 3× more donations.' },
                    { icon: 'doc',   tip: 'Stories with cover photos raise 3× more than text-only campaigns.' },
                  ].map(({ icon, tip }) => (
                    <div key={tip} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div className="kf-square violet" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }}>
                        <KFIcon name={icon} />
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{tip}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="kf-card" style={{ background: 'linear-gradient(135deg, #f7f2ff, #fff)' }}>
                <div className="kf-card-head">
                  <h2 style={{ fontSize: 15 }}>AI Copilot</h2>
                  <span className="kf-pill violet" style={{ fontSize: 10 }}>Free</span>
                </div>
                <div style={{ padding: '0 20px 18px', fontSize: 13, color: 'var(--t3)', lineHeight: 1.55 }}>
                  On the story step, use AI to automatically generate a polished story, title, and
                  social captions from your notes.
                </div>
              </section>
            </aside>
          </div>

        ) : (
          /* ── Success / Live screen ── */
          <section className="kf-card kf-form-card">
            <div className="kf-launch-success">
              <div className="kf-success-icon">
                <KFIcon name="check" />
              </div>
              <h2>🎉 Your Campaign is Live!</h2>
              <p>
                Congratulations! Your fundraiser is now live and ready to receive donations.
                Share it everywhere to reach your goal faster.
              </p>

              <div className="kf-launch-actions">
                {publishedSlug && (
                  <Link
                    href={`/campaigns/${publishedSlug}`}
                    className="kf-primary"
                    style={{
                      textDecoration: 'none', height: 48, display: 'inline-flex',
                      alignItems: 'center', gap: 8, padding: '0 28px', borderRadius: 10,
                    }}
                  >
                    <KFIcon name="send" /> View Live Campaign
                  </Link>
                )}
                <Link
                  href="/dashboard/campaigns"
                  style={{
                    height: 48, display: 'inline-flex', alignItems: 'center',
                    padding: '0 28px', borderRadius: 10, border: '1px solid var(--b2)',
                    background: '#fff', color: 'var(--t1)', fontWeight: 700, textDecoration: 'none',
                  }}
                >
                  Manage Campaigns
                </Link>
              </div>

              <div style={{ borderTop: '1px solid var(--b1)', marginTop: 28, paddingTop: 24 }}>
                <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 800, color: 'var(--t3)' }}>
                  Share your campaign
                </p>
                <div className="kf-share-row">
                  {[
                    { label: 'Copy Link', icon: 'link'  },
                    { label: 'Facebook',  icon: 'users' },
                    { label: 'Twitter/X', icon: 'send'  },
                    { label: 'WhatsApp',  icon: 'chat'  },
                    { label: 'Email',     icon: 'doc'   },
                  ].map(({ label, icon }) => (
                    <button key={label} type="button" className="kf-share-btn">
                      <KFIcon name={icon} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
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
    </KindFundShell>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function TrustRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className={`kf-trust-row${done ? ' done' : ''}`}>
      <span className="tr-dot">{done ? '✓' : ''}</span>
      {label}
    </div>
  );
}
