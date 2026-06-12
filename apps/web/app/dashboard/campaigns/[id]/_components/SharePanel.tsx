'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';

type Campaign = { id: string; title: string; slug: string };

type ContentType = 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'whatsapp' | 'sms' | 'email' | 'update';

const CHANNELS: { type: ContentType; label: string; icon: string; color: string }[] = [
  { type: 'facebook', label: 'Facebook', icon: 'f', color: '#1877f2' },
  { type: 'twitter', label: 'X / Twitter', icon: 'X', color: '#000' },
  { type: 'instagram', label: 'Instagram', icon: '📸', color: '#e1306c' },
  { type: 'linkedin', label: 'LinkedIn', icon: 'in', color: '#0a66c2' },
  { type: 'whatsapp', label: 'WhatsApp', icon: '💬', color: '#25d366' },
  { type: 'sms', label: 'SMS', icon: '💬', color: '#34c759' },
  { type: 'email', label: 'Email', icon: '✉️', color: '#6c35ff' },
  { type: 'update', label: 'Campaign Update', icon: '📝', color: '#19b86a' },
];

export default function SharePanel({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [activeChannel, setActiveChannel] = useState<ContentType>('facebook');
  const [context, setContext] = useState('');
  const [content, setContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    void (async () => {
      const res = await fetch(`/api/campaigns/${campaignId}`).catch(() => null);
      if (!active) return;
      if (!res || res.status === 401) { router.push('/login'); return; }
      if (!res.ok) { setError('Could not load campaign.'); return; }
      const data = await res.json() as Campaign;
      if (active) setCampaign({ id: data.id, title: data.title, slug: data.slug });
    })();
    return () => { active = false; };
  }, [campaignId, router]);

  async function generate() {
    if (!campaign) return;
    setGenerating(true); setError(''); setContent('');
    try {
      const res = await fetch('/api/ai/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeChannel, campaignId, context: context.trim() || undefined }),
      });
      const data = await res.json() as { content?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Generation failed.'); return; }
      setContent(data.content ?? '');
    } catch { setError('Network error. Please try again.'); }
    finally { setGenerating(false); }
  }

  async function copy() {
    if (!content) return;
    await navigator.clipboard.writeText(content).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const campaignUrl = campaign ? `${ORIGIN}/campaigns/${campaign.slug}` : '';
  const utmUrl = (source: string) => `${campaignUrl}?utm_source=${source}&utm_medium=social&utm_campaign=organic`;

  // Build native share links
  const shareLinks: Record<string, string> = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(utmUrl('facebook'))}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(utmUrl('twitter'))}&text=${encodeURIComponent(campaign?.title ?? '')}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${campaign?.title ?? ''} ${utmUrl('whatsapp')}`)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(utmUrl('linkedin'))}`,
    email: `mailto:?subject=${encodeURIComponent(campaign?.title ?? '')}&body=${encodeURIComponent(`Please support: ${utmUrl('email')}`)}`,
  };

  if (!campaign) {
    return <div style={{ padding: '24px 0', color: 'var(--t3)', fontSize: 14 }}>Loading…</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 900 }}>
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: 'var(--t1)' }}>Share &amp; Grow</h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--t3)' }}>
          Share &ldquo;{campaign.title}&rdquo; and AI-generate content for every channel.
        </p>
      </div>

      {/* Quick share buttons with UTM */}
      <section className="kf-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 650, margin: '0 0 6px' }}>Share Links</h2>
        <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 16px' }}>UTM-tagged links so you can track which channel drives the most donations.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(shareLinks).map(([channel, url]) => {
            const ch = CHANNELS.find(c => c.type === channel);
            if (!ch) return null;
            return (
              <a key={channel} href={url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 10, background: ch.color, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                {ch.label}
              </a>
            );
          })}
          <button type="button" onClick={async () => {
            await navigator.clipboard.writeText(utmUrl('direct')).catch(() => undefined);
            setCopied(true); setTimeout(() => setCopied(false), 2000);
          }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 10, background: copied ? '#19b86a' : 'var(--s3)', color: copied ? '#fff' : 'var(--t1)', fontSize: 13, fontWeight: 700, border: '1px solid var(--b2)', cursor: 'pointer' }}>
            {copied ? '✓ Copied!' : '🔗 Copy Link'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--t3)', margin: '12px 0 0' }}>
          Campaign URL: <code style={{ fontSize: 11 }}>{campaignUrl}</code>
        </p>
      </section>

      {/* AI content generator */}
      <section className="kf-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 650, margin: '0 0 6px' }}>AI Content Generator</h2>
        <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 16px' }}>Generate ready-to-use posts, emails, and updates for any channel in one click.</p>

        {/* Channel selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {CHANNELS.map(ch => (
            <button key={ch.type} type="button" onClick={() => { setActiveChannel(ch.type); setContent(''); }}
              style={{ padding: '7px 16px', borderRadius: 20, border: '1.5px solid', borderColor: activeChannel === ch.type ? ch.color : 'var(--b2)', background: activeChannel === ch.type ? `${ch.color}15` : '#fff', color: activeChannel === ch.type ? ch.color : 'var(--t2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .1s' }}>
              {ch.label}
            </button>
          ))}
        </div>

        {/* Context input */}
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 14 }}>
          Extra context <span style={{ fontWeight: 400, color: 'var(--t3)' }}>optional — e.g. &ldquo;we just hit 50% of our goal&rdquo;</span>
          <input value={context} onChange={e => setContext(e.target.value)} maxLength={200} placeholder="Any specific message or milestone to include..."
            style={{ height: 42, border: '1.5px solid var(--b2)', borderRadius: 10, padding: '0 14px', fontSize: 14, outline: 'none' }} />
        </label>

        <button type="button" onClick={() => void generate()} disabled={generating}
          style={{ height: 44, padding: '0 28px', border: 0, borderRadius: 10, background: generating ? 'var(--b2)' : 'linear-gradient(135deg,#6c35ff,#4d1ee0)', color: '#fff', fontSize: 14, fontWeight: 650, cursor: generating ? 'wait' : 'pointer', marginBottom: 16 }}>
          {generating ? 'Generating…' : `Generate ${CHANNELS.find(c => c.type === activeChannel)?.label} Content`}
        </button>

        {error && <div style={{ padding: '10px 14px', background: '#fff0f3', border: '1px solid #fecdd3', borderRadius: 9, color: '#be123c', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>⚠ {error}</div>}

        {content && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--t2)', margin: 0 }}>Generated content:</p>
              <button type="button" onClick={() => void copy()}
                style={{ padding: '6px 16px', border: '1px solid var(--b2)', borderRadius: 8, background: copied ? '#19b86a' : '#fff', color: copied ? '#fff' : 'var(--t1)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={10}
              style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--b2)', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6, background: 'var(--s1)' }} />
          </div>
        )}
      </section>
    </div>
  );
}
