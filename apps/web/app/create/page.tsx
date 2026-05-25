'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Textarea, Select, Btn } from '../../components/ui';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    tagline: '',
    description: '',
    goal: '',
    deadline: '',
    category: 'Other',
    coverImageUrl: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          tagline: form.tagline,
          description: form.description,
          goalAmount: Math.round(parseFloat(form.goal) * 100),
          deadline: form.deadline || null,
          category: form.category,
          coverImageUrl: form.coverImageUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create campaign');
      router.push(`/campaigns/${data.slug}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--s1)', padding: '48px 24px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{
              flex: 1, height: '4px', borderRadius: '99px',
              background: s <= step ? 'var(--green)' : 'var(--s3)',
              transition: 'background .3s',
            }} />
          ))}
        </div>

        <div style={{
          background: '#fff',
          border: '1px solid var(--b1)',
          borderRadius: 'var(--rxl)',
          padding: '40px',
          boxShadow: 'var(--shadow)',
        }}>
          {step === 1 && (
            <>
              <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>Your campaign basics</h1>
              <p style={{ color: 'var(--t3)', fontSize: '14px', marginBottom: '28px' }}>
                Tell us what you&apos;re raising money for.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Input label="Campaign title *" value={form.title} onChange={set('title')} placeholder="e.g. Help rebuild after the flood" required maxLength={100} />
                <Input label="Short tagline" value={form.tagline} onChange={set('tagline')} placeholder="A one-sentence description" maxLength={160} />
                <Select label="Category *" value={form.category} onChange={set('category')}>
                  {CAMPAIGN_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>Tell your story</h1>
              <p style={{ color: 'var(--t3)', fontSize: '14px', marginBottom: '28px' }}>
                A compelling story increases donations significantly.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Textarea
                  label="Campaign description *"
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Share who you are, why you're raising money, and how it will be used…"
                  style={{ minHeight: '200px' }}
                />
                <Input
                  label="Cover image URL"
                  value={form.coverImageUrl}
                  onChange={set('coverImageUrl')}
                  placeholder="https://…"
                  hint="Link to a photo that represents your campaign"
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>Set your goal</h1>
              <p style={{ color: 'var(--t3)', fontSize: '14px', marginBottom: '28px' }}>
                You&apos;ll receive all donations even if you don&apos;t hit your goal.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Input
                  label="Fundraising goal (USD) *"
                  type="number"
                  min="1"
                  step="1"
                  value={form.goal}
                  onChange={set('goal')}
                  placeholder="5000"
                  hint="How much do you need to raise?"
                />
                <Input
                  label="End date (optional)"
                  type="date"
                  value={form.deadline}
                  onChange={set('deadline')}
                  hint="Leave blank for an open-ended campaign"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </>
          )}

          {error && <p style={{ fontSize: '13px', color: 'var(--red)', marginTop: '16px' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
            {step > 1 ? (
              <Btn variant="ghost" onClick={() => setStep(step - 1)}>Back</Btn>
            ) : (
              <div />
            )}
            {step < 3 ? (
              <Btn
                onClick={() => {
                  if (step === 1 && !form.title) { setError('Title is required'); return; }
                  if (step === 2 && !form.description) { setError('Description is required'); return; }
                  setError('');
                  setStep(step + 1);
                }}
              >
                Continue →
              </Btn>
            ) : (
              <Btn
                loading={loading}
                onClick={handleSubmit}
                disabled={!form.goal}
              >
                Launch campaign 🚀
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
