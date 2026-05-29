'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { KindFundShell, TopBar, KFIcon } from '../../../../../components/KindFundApp';
import { createClient } from '../../../../../lib/supabase-browser';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';

type Campaign = {
  id: string;
  title: string;
  slug: string;
  tagline: string | null;
  description: string;
  goal_amount: number;
  deadline: string | null;
  category: string;
  cover_image_url: string | null;
  beneficiary_name: string | null;
  beneficiary_relationship: string | null;
  status: string;
  video_url: string | null;
  location: string | null;
};

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export default function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    tagline: '',
    description: '',
    goal: '',
    deadline: '',
    category: 'Medical',
    beneficiaryName: '',
    beneficiaryRelationship: '',
    coverImageUrl: '',
    videoUrl: '',
    location: '',
  });
  const [originalSlug, setOriginalSlug] = useState('');

  // Resolve params (Next 15 async params)
  useEffect(() => {
    params.then(({ id }) => setCampaignId(id));
  }, [params]);

  // Load campaign data
  useEffect(() => {
    if (!campaignId) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      supabase
        .from('campaigns')
        .select('id,title,slug,tagline,description,goal_amount,deadline,category,cover_image_url,beneficiary_name,beneficiary_relationship,status,video_url,location')
        .eq('id', campaignId)
        .eq('user_id', user.id)
        .single()
        .then(({ data, error: err }) => {
          if (err || !data) { router.push('/dashboard/campaigns'); return; }
          const c = data as Campaign;
          setOriginalSlug(c.slug);
          setForm({
            title: c.title,
            tagline: c.tagline ?? '',
            description: c.description,
            goal: String((c.goal_amount / 100).toFixed(0)),
            deadline: c.deadline ? c.deadline.slice(0, 10) : '',
            category: c.category,
            beneficiaryName: c.beneficiary_name ?? '',
            beneficiaryRelationship: c.beneficiary_relationship ?? '',
            coverImageUrl: c.cover_image_url ?? '',
            videoUrl: (c.video_url as string | null) ?? '',
            location: (c.location as string | null) ?? '',
          });
          setLoading(false);
        });
    });
  }, [campaignId, router]);

  const upd = (k: keyof typeof form, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleImageUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0]!;
    if (!file.type.startsWith('image/')) { setUploadError('Please upload an image file.'); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadError('Image must be under 10 MB.'); return; }

    setUploadState('uploading');
    setUploadError('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload/campaign-image', { method: 'POST', body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      upd('coverImageUrl', data.url!);
      setUploadState('done');
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
      setUploadState('error');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (form.title.trim().length < 3) { setError('Title must be at least 3 characters.'); return; }
    if (form.description.trim().length < 20) { setError('Story must be at least 20 characters.'); return; }
    const goalCents = Math.round(parseFloat(form.goal) * 100);
    if (goalCents < 100) { setError('Goal must be at least $1.00.'); return; }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          tagline: form.tagline.trim() || undefined,
          description: form.description.trim(),
          goalAmount: goalCents,
          deadline: form.deadline || null,
          category: form.category,
          coverImageUrl: form.coverImageUrl || null,
          beneficiaryName: form.beneficiaryName.trim() || undefined,
          beneficiaryRelationship: form.beneficiaryRelationship.trim() || undefined,
          videoUrl: form.videoUrl.trim() || null,
          location: form.location.trim() || null,
        }),
      });

      const data = await res.json() as { id?: string; slug?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to save changes.');
      setSuccess('Changes saved successfully!');
      if (data.slug && data.slug !== originalSlug) setOriginalSlug(data.slug);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <KindFundShell active="My Campaigns">
        <TopBar title="Edit Campaign" subtitle="Loading…" />
        <div style={{ padding: '32px', color: 'var(--t3)' }}>Loading campaign…</div>
      </KindFundShell>
    );
  }

  return (
    <KindFundShell active="My Campaigns">
      <TopBar
        title="Edit Campaign"
        subtitle="Update your campaign details. Changes are live immediately."
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            {originalSlug && (
              <Link href={`/campaigns/${originalSlug}`} target="_blank" className="kf-outline"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <KFIcon name="send" /> Preview
              </Link>
            )}
            <Link href={`/dashboard/campaigns/${campaignId}`} className="kf-outline"
              style={{ textDecoration: 'none' }}>
              ← Back
            </Link>
          </div>
        }
      />

      <div style={{ padding: '0 32px 40px', maxWidth: 720, display: 'grid', gap: 20 }}>
        {error && (
          <div style={{ padding: '12px 16px', background: '#fff0f3', border: '1px solid #fecdd3', borderRadius: 10, color: '#be123c', fontSize: 14, fontWeight: 600 }}>
            ⚠ {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '12px 16px', background: '#f0fff8', border: '1px solid #bbf7d0', borderRadius: 10, color: '#065f46', fontSize: 14, fontWeight: 600 }}>
            ✓ {success}
          </div>
        )}

        {/* Basic info */}
        <section className="kf-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 18px' }}>Campaign Details</h2>
          <div style={{ display: 'grid', gap: 16 }}>
            <Field label="Campaign Title *">
              <input value={form.title} onChange={e => upd('title', e.target.value)} maxLength={100} placeholder="Help Sarah cover emergency medical bills" />
            </Field>
            <Field label="Short Tagline">
              <input value={form.tagline} onChange={e => upd('tagline', e.target.value)} maxLength={160} placeholder="One sentence that hooks donors" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Fundraising Goal ($) *">
                <input type="number" value={form.goal} onChange={e => upd('goal', e.target.value)} min="1" placeholder="25000" />
              </Field>
              <Field label="Deadline (optional)">
                <input type="date" value={form.deadline} onChange={e => upd('deadline', e.target.value)} />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Category">
                <select value={form.category} onChange={e => upd('category', e.target.value)}>
                  {CAMPAIGN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Location (optional)">
                <input value={form.location} onChange={e => upd('location', e.target.value)} placeholder="New York, NY" />
              </Field>
            </div>
          </div>
        </section>

        {/* Beneficiary */}
        <section className="kf-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 18px' }}>Beneficiary</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Beneficiary Name">
              <input value={form.beneficiaryName} onChange={e => upd('beneficiaryName', e.target.value)} placeholder="Jane Smith" />
            </Field>
            <Field label="Your Relationship">
              <input value={form.beneficiaryRelationship} onChange={e => upd('beneficiaryRelationship', e.target.value)} placeholder="Sister, friend, myself…" />
            </Field>
          </div>
        </section>

        {/* Story */}
        <section className="kf-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 18px' }}>Campaign Story</h2>
          <Field label="Story *">
            <textarea value={form.description} onChange={e => upd('description', e.target.value)} rows={12}
              placeholder="Who needs help? What happened? How will funds be used?" />
          </Field>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--t3)' }}>{form.description.length} characters</p>
        </section>

        {/* Media */}
        <section className="kf-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 18px' }}>Media</h2>
          <div style={{ display: 'grid', gap: 16 }}>
            <Field label="Cover Photo">
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {form.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.coverImageUrl} alt="Cover" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--b2)' }} />
                )}
                <div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => void handleImageUpload(e.target.files)} />
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="kf-outline" style={{ height: 36, padding: '0 16px', fontSize: 13 }}>
                    {uploadState === 'uploading' ? 'Uploading…' : form.coverImageUrl ? 'Replace Image' : 'Upload Image'}
                  </button>
                  {uploadError && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#be123c' }}>{uploadError}</p>}
                </div>
              </div>
            </Field>

            <Field label="Video URL (YouTube or Vimeo)">
              <input value={form.videoUrl} onChange={e => upd('videoUrl', e.target.value)}
                placeholder="https://youtube.com/watch?v=..." type="url" />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--t3)' }}>
                Paste a YouTube or Vimeo link — it will appear as an embedded video on your campaign page.
              </p>
            </Field>
          </div>
        </section>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" onClick={handleSave} disabled={saving}
            style={{
              height: 48, padding: '0 32px', border: 0, borderRadius: 10,
              background: saving ? '#c0b8e8' : 'linear-gradient(135deg,#6c35ff,#4d1ee0)',
              color: '#fff', fontWeight: 800, fontSize: 14, cursor: saving ? 'wait' : 'pointer',
            }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <Link href={`/dashboard/campaigns/${campaignId}`}
            style={{ height: 48, padding: '0 24px', border: '1px solid var(--b2)', borderRadius: 10, background: '#fff', color: 'var(--t1)', fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Cancel
          </Link>
        </div>
      </div>
    </KindFundShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 750, color: '#26335c' }}>
      {label}
      {children}
    </label>
  );
}
