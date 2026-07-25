'use client';

import { useEffect } from 'react';

// Last-resort boundary: catches errors thrown by the ROOT layout itself (which
// the segment-level app/error.tsx cannot). It replaces the whole document, so
// it renders its own <html>/<body> and uses inline styles only — no dependency
// on the app's global CSS (which never loaded if the root layout failed).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif', background: '#0e0520', color: '#f4f2fb', minHeight: '100vh' }}>
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 16 }} aria-hidden="true">⚠️</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 10px' }}>Something went wrong</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: '#c9c2e0', margin: '0 0 28px' }}>
              CharitMe hit an unexpected error. Please try again — if it keeps happening, head back to the homepage.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{ border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, padding: '11px 22px', borderRadius: 10, background: '#6c35ff', color: '#fff' }}
              >
                Try again
              </button>
              {/* Hard navigation (not next/link) is intentional here: a full
                  reload recovers from a broken root-layout state. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                style={{ textDecoration: 'none', fontWeight: 700, fontSize: 14, padding: '11px 22px', borderRadius: 10, background: 'transparent', color: '#f4f2fb', border: '1px solid rgba(255,255,255,.25)' }}
              >
                Back to home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
