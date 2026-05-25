'use client';
import React, { useState } from 'react';
import { Btn } from '../../../components/ui';
import { MAX_DONATION_CENTS } from '@shared/fees';

export default function DonateButton({ campaignId, campaignTitle }: { campaignId: string; campaignTitle: string }) {
  const [amount, setAmount] = useState('25');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const presets = [10, 25, 50, 100];

  const handleDonate = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents < 100) {
      setError('Minimum donation is $1.00');
      return;
    }
    if (cents > MAX_DONATION_CENTS) {
      setError('Maximum donation is $1,000,000');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ campaignId, amountCents: cents, message, anonymous }),
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Preset amounts */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '4px' }}>Donor confidence</div>
        <p style={{ fontSize: '12px', color: 'var(--t3)', lineHeight: 1.45 }}>
          Your gift is processed by Stripe and tracked with campaign trust signals, payout status, and future impact updates.
        </p>
      </div>

      {/* Preset amounts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => setAmount(String(p))}
            style={{
              padding: '8px',
              border: `2px solid ${amount === String(p) ? 'var(--green)' : 'var(--b1)'}`,
              borderRadius: 'var(--r)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              background: amount === String(p) ? 'var(--green-light)' : '#fff',
              color: amount === String(p) ? 'var(--green-dark)' : 'var(--t2)',
              transition: 'all .15s',
            }}
          >
            ${p}
          </button>
        ))}
      </div>

      {/* Custom amount */}
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
          fontSize: '14px', color: 'var(--t3)', fontWeight: 600,
        }}>$</span>
        <input
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Other amount"
          style={{
            width: '100%',
            padding: '10px 12px 10px 24px',
            border: '1px solid var(--b1)',
            borderRadius: 'var(--r)',
            fontSize: '14px',
            outline: 'none',
          }}
        />
      </div>

      {/* Message */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Leave a message (optional)"
        rows={2}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid var(--b1)',
          borderRadius: 'var(--r)',
          fontSize: '14px',
          resize: 'none',
          fontFamily: 'var(--font)',
          outline: 'none',
        }}
      />

      {/* Anonymous toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--t2)' }}>
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          style={{ width: '16px', height: '16px', accentColor: 'var(--green)', cursor: 'pointer' }}
        />
        Donate anonymously
      </label>

      {error && <p style={{ fontSize: '13px', color: 'var(--red)' }}>{error}</p>}

      <Btn size="lg" loading={loading} onClick={handleDonate} style={{ width: '100%', justifyContent: 'center' }}>
        Donate ${amount || '0'} to {campaignTitle.slice(0, 20)}{campaignTitle.length > 20 ? '…' : ''}
      </Btn>

      <p style={{ fontSize: '11px', color: 'var(--t4)', textAlign: 'center' }}>
        Secured by Stripe · 5% platform fee applies
      </p>
    </div>
  );
}
