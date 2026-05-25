'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { AI_COPILOT_ACTIONS, scoreCampaignQuality } from '../../lib/ai-platform';

const steps = ['Category', 'Goal', 'Beneficiary', 'Story', 'Media', 'Trust', 'AI optimization', 'Publish'];

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [form, setForm] = useState({
    category: 'Medical',
    goal: '',
    beneficiaryName: '',
    beneficiaryRelationship: '',
    title: '',
    tagline: '',
    description: '',
    coverImageUrl: '',
    evidenceNote: '',
    identityVerified: false,
    beneficiaryVerified: false,
  });

  const update = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const goalCents = Math.round((Number.parseFloat(form.goal) || 0) * 100);
  const quality = scoreCampaignQuality({ title: form.title, story: form.description, goalCents, hasMedia: Boolean(form.coverImageUrl) });

  const runAi = async () => {
    setAiLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.category,
          goalAmount: goalCents || 500000,
          beneficiary: form.beneficiaryName || 'the beneficiary',
          notes: form.description || form.evidenceNote || 'Help us write a clear fundraiser.',
          tone: 'authentic',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'AI generation failed');
      setForm((current) => ({
        ...current,
        title: current.title || data.title,
        tagline: current.tagline || data.socialCaption,
        description: current.description.length > 80 ? current.description : data.story,
      }));
      setAiOutput(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const publish = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          tagline: form.tagline,
          description: form.description,
          goalAmount: goalCents,
          deadline: null,
          category: form.category,
          coverImageUrl: form.coverImageUrl || null,
          beneficiaryName: form.beneficiaryName,
          beneficiaryRelationship: form.beneficiaryRelationship,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to publish campaign');
      router.push(`/campaigns/${data.slug}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Publish failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="container max-w-5xl">
        <div className="mb-8">
          <div className="text-sm font-black text-emerald-700">AI Campaign Copilot</div>
          <h1 className="mt-2 text-4xl font-black text-slate-950">Launch a trusted fundraiser in minutes.</h1>
          <p className="mt-3 max-w-2xl text-slate-600">Eight guided steps collect the story, trust, media, beneficiary, and AI optimization signals donors expect.</p>
        </div>

        <div className="mb-6 grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {steps.map((label, index) => (
            <button key={label} onClick={() => setStep(index)} className={`rounded-xl px-3 py-2 text-xs font-black ${index === step ? 'bg-emerald-600 text-white' : index < step ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500'}`}>
              {index + 1}. {label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {step === 0 && (
              <div>
                <h2 className="text-2xl font-black">Choose a category</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {CAMPAIGN_CATEGORIES.map((category) => (
                    <button key={category} onClick={() => update('category', category)} className={`rounded-2xl border p-4 text-left font-black ${form.category === category ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-700'}`}>
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && <Field label="Fundraising goal" value={form.goal} onChange={(value) => update('goal', value)} placeholder="25000" type="number" />}
            {step === 2 && (
              <div className="grid gap-4">
                <Field label="Beneficiary name" value={form.beneficiaryName} onChange={(value) => update('beneficiaryName', value)} placeholder="Jane Smith" />
                <Field label="Relationship to beneficiary" value={form.beneficiaryRelationship} onChange={(value) => update('beneficiaryRelationship', value)} placeholder="Sister, friend, nonprofit client..." />
              </div>
            )}
            {step === 3 && (
              <div className="grid gap-4">
                <Field label="Campaign title" value={form.title} onChange={(value) => update('title', value)} placeholder="Help Jane recover after emergency surgery" />
                <Field label="Short donor hook" value={form.tagline} onChange={(value) => update('tagline', value)} placeholder="A clear, authentic summary" />
                <TextArea label="Campaign story" value={form.description} onChange={(value) => update('description', value)} placeholder="Who needs help? What happened? Why now? How will funds be used?" />
              </div>
            )}
            {step === 4 && <Field label="Hero image or video URL" value={form.coverImageUrl} onChange={(value) => update('coverImageUrl', value)} placeholder="https://..." />}
            {step === 5 && (
              <div className="grid gap-4">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 font-bold"><input type="checkbox" checked={form.identityVerified} onChange={(e) => update('identityVerified', e.target.checked)} /> Organizer identity ready for verification</label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 font-bold"><input type="checkbox" checked={form.beneficiaryVerified} onChange={(e) => update('beneficiaryVerified', e.target.checked)} /> Beneficiary details ready for verification</label>
                <TextArea label="Receipt/proof note" value={form.evidenceNote} onChange={(value) => update('evidenceNote', value)} placeholder="List documents, receipts, links, or milestones you can provide." />
              </div>
            )}
            {step === 6 && (
              <div>
                <h2 className="text-2xl font-black">AI optimization</h2>
                <p className="mt-2 text-slate-600">Free AI generation is included for basic campaign creation.</p>
                <button onClick={runAi} disabled={aiLoading} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                  {aiLoading ? 'Generating...' : 'Generate with AI Copilot'}
                </button>
                {aiOutput && <pre className="mt-5 max-h-72 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-emerald-100">{aiOutput}</pre>}
              </div>
            )}
            {step === 7 && (
              <div>
                <h2 className="text-2xl font-black">Ready to publish</h2>
                <p className="mt-2 text-slate-600">Your campaign quality score is {quality}/100. You can publish now or go back and improve trust signals.</p>
                <button onClick={publish} disabled={loading} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                  {loading ? 'Publishing...' : 'Publish trusted campaign'}
                </button>
              </div>
            )}

            {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
            <div className="mt-8 flex justify-between">
              <button disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black disabled:opacity-40">Back</button>
              <button disabled={step === steps.length - 1} onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-40">Continue</button>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black">Copilot includes</h3>
            <div className="mt-4 space-y-2">
              {AI_COPILOT_ACTIONS.slice(0, 9).map((action) => <div key={action} className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{action}</div>)}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={8} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" />
    </label>
  );
}
