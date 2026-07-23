'use client';

import { useEffect, useState } from 'react';
import { MARKETING_OPT_OUT_STORAGE_KEY } from '../lib/marketing-consent';

export default function PrivacyPreferences(): JSX.Element {
  const [optedOut, setOptedOut] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setOptedOut(window.localStorage.getItem(MARKETING_OPT_OUT_STORAGE_KEY) === 'true');
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function updatePreference(): void {
    const next = optedOut !== true;
    if (next) window.localStorage.setItem(MARKETING_OPT_OUT_STORAGE_KEY, 'true');
    else window.localStorage.removeItem(MARKETING_OPT_OUT_STORAGE_KEY);
    setOptedOut(next);
  }

  return (
    <div style={{ border: '1px solid var(--b2)', borderRadius: 8, padding: 20, margin: '24px 0' }}>
      <h2 style={{ marginTop: 0 }}>Privacy preferences</h2>
      <p>
        CharitMe uses first-party analytics to understand which public pages and campaigns are useful.
        It does not use advertising cookies or sell visitor data.
      </p>
      <button
        type="button"
        onClick={updatePreference}
        style={{ minHeight: 44, padding: '10px 16px', borderRadius: 6, border: '1px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)', fontWeight: 700, cursor: 'pointer' }}
      >
        {optedOut ? 'Allow anonymous analytics' : 'Opt out of anonymous analytics'}
      </button>
      <p aria-live="polite" style={{ color: 'var(--t3)', fontSize: 13, marginBottom: 0 }}>
        {optedOut ? 'Anonymous analytics is disabled on this browser.' : 'Anonymous analytics is enabled on this browser.'}
      </p>
    </div>
  );
}
