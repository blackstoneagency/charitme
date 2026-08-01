'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../lib/supabase-browser';
import { useT } from '../../components/LocaleProvider';

/**
 * Post-signup email verification.
 *
 * The resend is REAL — `supabase.auth.resend` re-sends the signup confirmation.
 * A static "check your inbox" screen with a decorative button is worse than no
 * page: the one thing a stuck visitor needs is another email, and a button that
 * does nothing sends them to support instead.
 */
export default function VerifyEmailClient({ email }: { email: string }) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function resend() {
    if (!email) {
      setState('error');
      setMessage(t('verify.no_email'));
      return;
    }
    setState('sending');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) {
        setState('error');
        // Rate limiting is the common case and is not a fault — say so plainly
        // rather than showing a generic failure that invites repeated retries.
        setMessage(/rate|limit|seconds/i.test(error.message) ? t('verify.rate_limited') : t('status.error_retry'));
        return;
      }
      setState('sent');
      setMessage(t('verify.resent'));
    } catch {
      setState('error');
      setMessage(t('status.error_retry'));
    }
  }

  return (
    <>
      <p style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.6, margin: '0 0 6px' }}>
        {email ? t('verify.sent_to') : t('verify.sent_generic')}
      </p>
      {email && (
        <p style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--t1)', margin: '0 0 18px', wordBreak: 'break-all' }}>
          {email}
        </p>
      )}
      <p style={{ fontSize: 14, color: 'var(--t3)', lineHeight: 1.55, margin: '0 0 26px' }}>
        {t('verify.check_spam')}
      </p>

      {message && (
        <p
          // Announced, because the outcome of pressing Resend is otherwise
          // invisible to a screen reader.
          role="status"
          aria-live="polite"
          style={{
            fontSize: 14, margin: '0 0 18px', padding: '10px 14px', borderRadius: 'var(--r)',
            background: state === 'error' ? 'var(--tint-red)' : 'var(--tint-green)',
            color: state === 'error' ? 'var(--red-text)' : 'var(--green-text)',
          }}
        >
          {message}
        </p>
      )}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={resend}
          disabled={state === 'sending'}
          style={{
            minHeight: 46, padding: '0 22px', borderRadius: 12, border: 'none',
            background: state === 'sending' ? 'var(--s3)' : 'var(--fill-brand)',
            color: state === 'sending' ? 'var(--t3)' : '#fff',
            font: 'inherit', fontSize: 15, fontWeight: 700,
            cursor: state === 'sending' ? 'not-allowed' : 'pointer',
          }}
        >
          {state === 'sending' ? t('status.loading') : t('verify.resend')}
        </button>
        <Link
          href="/login"
          style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 46, padding: '0 22px',
            borderRadius: 12, border: '1px solid var(--b2)', background: 'var(--s1)',
            color: 'var(--t1)', fontWeight: 650, fontSize: 15, textDecoration: 'none',
          }}
        >
          {t('verify.change_email')}
        </Link>
      </div>
    </>
  );
}
