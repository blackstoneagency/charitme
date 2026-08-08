'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Step 9 — Verification (optional).
//
// ⚠️ **This step does not upload anything, and that is deliberate.**
//
// `verification_documents` exists, but document intake is a reviewed process
// with its own route (/verification) — an identity document is not a wizard
// field, and collecting one here would mean either duplicating that review
// pipeline or storing a file nobody looks at. Either would be worse than
// pointing at the real thing.
//
// So this step does the honest version: it tells the organizer what verification
// is, what it changes for donors, and links to the process — and then lets them
// continue. Publishing is never blocked on it (see `required: false` in
// campaign-flow-core), because most campaigns are individuals for whom there is
// nothing to verify.
//
// The copy adapts to step 1's answer: a registered nonprofit has a genuine
// reason to verify, an individual mostly does not.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link';

export interface StepVerifyProps {
  /** From step 1 — 'personal' | 'nonprofit' | 'team'. */
  campaignPath: string;
  /** True when the organizer is signed in; guests have no account to verify. */
  signedIn: boolean;
}

const BENEFITS = [
  'A verified badge on your campaign page, which donors see before they give.',
  'Higher placement in search and category pages.',
  'Fewer holds on payouts, because the account behind them is already confirmed.',
];

export default function StepVerify({ campaignPath, signedIn }: StepVerifyProps) {
  const isNonprofit = campaignPath === 'nonprofit';

  return (
    <div className="cr2-verify-panel">
      <h2 className="cr2-step-q">
        {isNonprofit ? 'Verify your organisation' : 'Want a verified badge?'}
      </h2>
      <p className="cr2-step-help">
        {isNonprofit
          ? 'You told us this campaign is for a registered nonprofit. Verifying proves that to donors, and it is the single biggest trust signal on the page.'
          : 'Verification is optional. Most personal campaigns publish without it and do perfectly well — it is worth doing if you are raising a large amount or on behalf of an organisation.'}
      </p>

      <ul style={{ margin: '0 0 20px', padding: '0 0 0 20px', color: 'var(--t2)', fontSize: 14.5, lineHeight: 1.7 }}>
        {BENEFITS.map((benefit) => <li key={benefit}>{benefit}</li>)}
      </ul>

      <div
        style={{
          padding: '16px 18px',
          borderRadius: 14,
          border: '1.5px solid var(--b1)',
          background: 'var(--s2)',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--t1)', marginBottom: 6 }}>
          Verification happens outside the builder
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--t2)', margin: '0 0 14px' }}>
          It needs documents and a human review, so it is not something to rush through here.
          Your campaign can go live now and be verified afterwards — publishing first costs you
          nothing.
        </p>
        {signedIn ? (
          <Link
            href="/verification"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block', padding: '10px 16px', borderRadius: 10,
              border: '1.5px solid var(--b2)', color: 'var(--t1)',
              fontSize: 14, fontWeight: 800, textDecoration: 'none',
            }}
          >
            Start verification in a new tab →
          </Link>
        ) : (
          <p style={{ fontSize: 13.5, color: 'var(--t3)', margin: 0 }}>
            You will be able to start verification once your campaign is published and you have an
            account.
          </p>
        )}
      </div>

      <p style={{ color: 'var(--t3)', fontSize: 13, margin: '16px 0 0' }}>
        Press Continue to carry on — this step never blocks publishing.
      </p>
    </div>
  );
}
