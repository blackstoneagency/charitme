'use client';

import React from 'react';

/** Print / Save-as-PDF trigger. Hidden from the printed output via .no-print. */
export default function PrintButton() {
  return (
    <button
      type="button"
      className="no-print"
      onClick={() => window.print()}
      style={{
        fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
        color: '#fff', background: 'var(--violet, #6c35ff)', border: 'none',
        borderRadius: 'var(--r, 10px)', padding: '9px 18px',
      }}
    >
      Print / Save as PDF
    </button>
  );
}
