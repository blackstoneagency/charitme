'use client';
import React, { useMemo, useState } from 'react';
import { MAX_DONATION_CENTS, TIP_OPTIONS, donationTotal, donorTip, processingFee } from '@shared/fees';

export default function DonateButton({ campaignId, campaignTitle }: { campaignId: string; campaignTitle: string }) {
  const [amount, setAmount] = useState('50');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [coverProcessingFee, setCoverProcessingFee] = useState(true);
  const [tipPercent, setTipPercent] = useState(8);
  const [customTip, setCustomTip] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const amountCents = Math.round((Number.parseFloat(amount) || 0) * 100);
  const effectiveTipPercent = customTip ? Number.parseFloat(customTip) || 0 : tipPercent;
  const breakdown = useMemo(() => ({
    tip: donorTip(amountCents, effectiveTipPercent),
    processing: coverProcessingFee ? processingFee(amountCents + donorTip(amountCents, effectiveTipPercent)) : 0,
    total: donationTotal(amountCents, coverProcessingFee, effectiveTipPercent),
  }), [amountCents, coverProcessingFee, effectiveTipPercent]);

  const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  const handleDonate = async () => {
    if (Number.isNaN(amountCents) || amountCents < 100) {
      setError('Minimum donation is $1.00');
      return;
    }
    if (amountCents > MAX_DONATION_CENTS) {
      setError('Maximum donation is $1,000,000');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ campaignId, amountCents, message, anonymous, coverProcessingFee, tipPercent: effectiveTipPercent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to start checkout');
      window.location.href = data.url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="text-sm font-black text-emerald-800">0% mandatory platform fee</div>
        <p className="mt-1 text-xs leading-5 text-emerald-800">GiveRise is supported by optional donor tips. Every fee is shown before checkout.</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[25, 50, 100, 250].map((preset) => (
          <button key={preset} onClick={() => setAmount(String(preset))} className={`rounded-xl border px-3 py-2 text-sm font-black ${amount === String(preset) ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'}`}>
            ${preset}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-sm font-bold text-slate-700">Donation amount</span>
        <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-white px-3">
          <span className="font-black text-slate-500">$</span>
          <input className="w-full border-0 px-2 py-3 outline-none" type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </label>

      <div>
        <div className="text-sm font-bold text-slate-700">Optional GiveRise support tip</div>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {TIP_OPTIONS.map((option) => (
            <button key={option} onClick={() => { setTipPercent(option); setCustomTip(''); }} className={`rounded-xl border px-2 py-2 text-sm font-black ${!customTip && tipPercent === option ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'}`}>
              {option}%
            </button>
          ))}
        </div>
        <input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" placeholder="Custom tip percent" value={customTip} onChange={(e) => setCustomTip(e.target.value)} />
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-700">
        <input type="checkbox" checked={coverProcessingFee} onChange={(e) => setCoverProcessingFee(e.target.checked)} />
        Cover estimated processing fee
      </label>

      <textarea className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Leave a message (optional)" rows={2} />
      <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        Donate anonymously
      </label>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <div className="mb-2 font-black text-slate-950">Transparent breakdown</div>
        <div className="flex justify-between py-1"><span>Donation</span><span>{money(amountCents)}</span></div>
        <div className="flex justify-between py-1"><span>Processing fee coverage</span><span>{money(breakdown.processing)}</span></div>
        <div className="flex justify-between py-1"><span>Optional GiveRise tip</span><span>{money(breakdown.tip)}</span></div>
        <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-black"><span>Total</span><span>{money(breakdown.total)}</span></div>
      </div>

      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      <button disabled={loading} onClick={handleDonate} className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">
        {loading ? 'Opening secure checkout...' : `Donate to ${campaignTitle.slice(0, 28)}`}
      </button>
    </div>
  );
}
