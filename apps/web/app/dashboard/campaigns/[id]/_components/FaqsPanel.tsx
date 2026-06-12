'use client';

import React, { useState, useEffect } from 'react';

type FAQ = { id: string; question: string; answer: string; sort_order: number; is_public?: boolean };

export default function FaqsPanel({ campaignId }: { campaignId: string }) {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newQ, setNewQ] = useState('');
  const [newA, setNewA] = useState('');

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    void (async () => {
      // Load FAQs (owners/admins also receive private ones)
      const res = await fetch(`/api/campaigns/${campaignId}/faqs`).catch(() => null);
      if (!active) return;
      if (res?.ok) {
        const d = await res.json() as { faqs?: FAQ[] };
        if (active) setFaqs(d.faqs ?? []);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [campaignId]);

  async function generateWithAI() {
    setGenerating(true); setError('');
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/faqs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generateAI: true }),
      });
      const data = await res.json() as { faqs?: FAQ[]; error?: string };
      if (!res.ok) { setError(data.error ?? 'Generation failed.'); return; }
      setFaqs(prev => [...prev, ...(data.faqs ?? [])]);
    } catch { setError('Network error. Please try again.'); }
    finally { setGenerating(false); }
  }

  async function addFAQ() {
    if (!newQ.trim() || !newA.trim()) { setError('Both question and answer are required.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/faqs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: newQ.trim(), answer: newA.trim(), sortOrder: faqs.length }),
      });
      const data = await res.json() as { faq?: FAQ; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to add.'); return; }
      if (data.faq) { setFaqs(prev => [...prev, data.faq!]); setNewQ(''); setNewA(''); }
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  async function deleteFAQ(id: string) {
    setFaqs(prev => prev.filter(f => f.id !== id));
    await fetch(`/api/campaigns/${campaignId}/faqs/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }

  if (loading) {
    return <div style={{ padding: '24px 0', color: 'var(--t3)', fontSize: 14 }}>Loading…</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: 'var(--t1)' }}>Campaign FAQs</h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--t3)' }}>
            Answer common donor questions. Shown publicly on your campaign page.
          </p>
        </div>
        <button type="button" onClick={() => void generateWithAI()} disabled={generating}
          style={{ height: 40, padding: '0 18px', border: 0, borderRadius: 10, background: generating ? 'var(--b2)' : 'linear-gradient(135deg,#6c35ff,#4d1ee0)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: generating ? 'wait' : 'pointer' }}>
          {generating ? '✨ Generating…' : '✨ AI Generate FAQs'}
        </button>
      </div>

      {error && <div style={{ padding: '12px 16px', background: '#fff0f3', border: '1px solid #fecdd3', borderRadius: 10, color: '#be123c', fontSize: 14, fontWeight: 600 }}>⚠ {error}</div>}

      {/* Existing FAQs */}
      {faqs.length > 0 && (
        <section className="kf-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 650, margin: '0 0 16px' }}>Current FAQs ({faqs.length})</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {faqs.map((faq, i) => (
              <div key={faq.id} style={{ padding: '14px 16px', border: '1px solid var(--b2)', borderRadius: 10, background: 'var(--s1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: 13, color: 'var(--t1)', display: 'block', marginBottom: 4 }}>Q: {faq.question}</strong>
                    <span style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.5 }}>A: {faq.answer}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--t3)', padding: '2px 8px', background: 'var(--s2)', borderRadius: 6 }}>#{i + 1}</span>
                    <button type="button" onClick={() => void deleteFAQ(faq.id)}
                      title="Delete FAQ"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 16, padding: '2px 4px', lineHeight: 1 }}>
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add FAQ form */}
      <section className="kf-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 650, margin: '0 0 16px' }}>Add a Question</h2>
        <div style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: '#26335c' }}>
            Question
            <input value={newQ} onChange={e => setNewQ(e.target.value)} maxLength={300}
              placeholder="e.g. How will the funds be used?" style={{ height: 42, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 12px', fontSize: 14 }} />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 700, color: '#26335c' }}>
            Answer
            <textarea value={newA} onChange={e => setNewA(e.target.value)} rows={4} maxLength={2000}
              placeholder="Provide a clear, honest answer…" style={{ border: '1px solid var(--b2)', borderRadius: 9, padding: '10px 12px', fontSize: 14, resize: 'vertical', lineHeight: 1.6 }} />
          </label>
          <button type="button" onClick={() => void addFAQ()} disabled={saving || !newQ.trim() || !newA.trim()}
            style={{ height: 44, border: 0, borderRadius: 10, background: saving ? 'var(--b2)' : 'linear-gradient(135deg,#6c35ff,#4d1ee0)', color: '#fff', fontWeight: 650, fontSize: 14, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Adding…' : 'Add FAQ'}
          </button>
        </div>
      </section>

      {faqs.length === 0 && !generating && (
        <div style={{ padding: '32px 24px', textAlign: 'center', background: 'var(--s2)', borderRadius: 14, border: '1px solid var(--b2)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>❓</div>
          <p style={{ fontWeight: 700, margin: '0 0 6px' }}>No FAQs yet</p>
          <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 16px' }}>Click &ldquo;AI Generate FAQs&rdquo; to create relevant questions automatically, or add your own above.</p>
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.6 }}>
        💡 FAQs appear on your public campaign page. They help donors understand where money goes and build trust.
      </p>
    </div>
  );
}
