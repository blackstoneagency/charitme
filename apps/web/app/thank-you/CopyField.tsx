'use client';

import React, { useRef, useState } from 'react';

/**
 * A read-only value with a copy button — the transaction id on step 9.
 *
 * The id is rendered as a real `<input readonly>` rather than a `<span>` on
 * purpose: `navigator.clipboard` needs a secure context and a user gesture, and
 * is simply absent in some embedded browsers. When it is missing the input can
 * still be selected and copied by hand, and the fallback path below selects it
 * for the donor. A `<span>` would leave them with a support reference they can
 * see and cannot take.
 */
export default function CopyField({ label, value, copyLabel, copiedLabel }: {
  label: string;
  value: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(() => {
        ref.current?.select();
        done();
      });
      return;
    }
    ref.current?.select();
    done();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, minWidth: 0 }}>
      <label htmlFor="tx-id" style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--t3)' }}>{label}</label>
      <div style={{ display: 'flex', minWidth: 0, gap: 8, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <input
          id="tx-id"
          ref={ref}
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          style={{
            flex: '1 1 200px', minWidth: 0, minHeight: 44, padding: '0 12px',
            border: '1px solid var(--b1)', borderRadius: 10, background: 'var(--s2)',
            color: 'var(--t2)', fontFamily: 'var(--mono, monospace)', fontSize: 13,
          }}
        />
        <button type="button" onClick={copy} className="kf-outline" style={{ minHeight: 44, flex: '0 0 auto' }}>
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      {/* Announced without stealing focus — the button's own label also changes,
          but a screen reader that has moved on would otherwise hear nothing. */}
      <span role="status" aria-live="polite" className="sr-only">{copied ? copiedLabel : ''}</span>
    </div>
  );
}
