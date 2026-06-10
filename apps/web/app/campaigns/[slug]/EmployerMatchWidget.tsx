'use client';

import React, { useState } from 'react';
import { searchEmployerMatch } from '../../../lib/employer-matching';

export default function EmployerMatchWidget() {
  const [query, setQuery] = useState('');
  const results = searchEmployerMatch(query);
  const searched = query.trim().length >= 2;

  return (
    <div className="pc-match">
      <div className="pc-match-head">
        <span style={{ fontSize: 22 }}>💼</span>
        <div>
          <b>Double your donation</b>
          <span>Many employers match employee gifts dollar-for-dollar — completely free, no extra signup.</span>
        </div>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your employer's name…"
        aria-label="Search for your employer's donation matching program"
        className="pc-match-input"
      />

      {searched && (
        results.length > 0 ? (
          <div className="pc-match-results">
            {results.map((r) => (
              <div key={r.name} className="pc-match-result">
                <span className="pc-match-result-name">{r.name}</span>
                <span className="pc-match-result-ratio">{r.typicalRatio}</span>
              </div>
            ))}
            <p className="pc-match-note">
              🎉 Great news — after you donate, request a match through your company&apos;s giving or HR portal
              (often Benevity, YourCause, or similar) using your CharitMe email receipt.
            </p>
          </div>
        ) : (
          <p className="pc-match-note">
            We don&apos;t have &ldquo;{query}&rdquo; in our directory yet — many employers still match even if not listed.
            Search your company intranet for &ldquo;matching gift&rdquo; or &ldquo;employee giving&rdquo;, or ask your HR team.
          </p>
        )
      )}

      <details className="pc-match-howto">
        <summary>How employer matching works</summary>
        <ol>
          <li>Donate to this campaign and save your CharitMe email receipt.</li>
          <li>Submit a matching gift request through your employer&apos;s giving platform or HR team.</li>
          <li>Your company reviews and sends a matching donation directly to the campaign&apos;s organizer.</li>
        </ol>
      </details>
    </div>
  );
}
