'use client';

import React, { useRef, useState } from 'react';
import { SHARE_TARGETS, shareHref, type ShareTarget } from '../../../lib/donation-outcome-core';

const TILE: Readonly<Record<ShareTarget, { label: string; glyph: string; bg: string; fg: string }>> = {
  facebook: { label: 'Facebook', glyph: 'f', bg: '#e7f0ff', fg: '#0b4fb8' },
  twitter: { label: 'X', glyph: '𝕏', bg: '#ececec', fg: '#111' },
  linkedin: { label: 'LinkedIn', glyph: 'in', bg: '#e8f3fb', fg: '#0a66c2' },
  whatsapp: { label: 'WhatsApp', glyph: '✆', bg: '#e4f8e6', fg: '#0f7a33' },
  link: { label: 'Copy link', glyph: '⧉', bg: '#f0edff', fg: '#5a2ee0' },
};

/**
 * Step 11 of 12 — share your support.
 *
 * Every tile records a `share_events` row through the existing endpoint, which
 * is what makes this screen worth having: the campaign's own share analytics and
 * its referral attribution both read that table, so a share made here counts
 * exactly like one made from the campaign page. A share screen that only opened
 * a popup would look identical to the donor and be invisible to the fundraiser.
 *
 * ⚠️ Recording is fire-and-forget on purpose. `share_events` is analytics; a
 * failed insert must not block or delay the popup the donor just asked for.
 * Failures are already counted server-side.
 *
 * Channel names are the endpoint's vocabulary, not these tiles' labels — the
 * enum there has no 'x', so the X/Twitter tile records 'twitter'.
 */
export default function ShareSupport({
  campaignId,
  campaignUrl,
  message,
  copyLabel,
  copiedLabel,
}: {
  campaignId: string;
  campaignUrl: string;
  message: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [shareText, setShareText] = useState(message);

  const record = (channel: ShareTarget) => {
    void fetch('/api/share-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId,
        channel,
        utm_source: channel,
        utm_medium: 'post-donation-share',
      }),
    }).catch(() => { /* analytics must not interrupt the share */ });
  };

  const copy = () => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareText).then(done).catch(() => {
        areaRef.current?.select();
        if (document.execCommand('copy')) done();
      });
    } else {
      areaRef.current?.select();
      if (document.execCommand('copy')) done();
    }
    record('link');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18, minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, minWidth: 0 }}>
        {/* The label names the control; the hint is a sibling referenced by
            aria-describedby, so the accessible name stays short. */}
        <label htmlFor="share-message" style={{ fontSize: 13, fontWeight: 650, color: 'var(--t2)', textAlign: 'left' }}>
          Your message
        </label>
        <textarea
          id="share-message"
          ref={areaRef}
          value={shareText}
          onChange={(event) => setShareText(event.currentTarget.value)}
          aria-describedby="share-message-hint"
          rows={4}
          style={{
            width: '100%', minWidth: 0, padding: 12, resize: 'vertical',
            border: '1px solid var(--b1)', borderRadius: 12, background: 'var(--s2)',
            color: 'var(--t1)', fontSize: 14.5, lineHeight: 1.55, fontFamily: 'inherit',
          }}
        />
        <span id="share-message-hint" style={{ fontSize: 12.5, color: 'var(--t3)', textAlign: 'left' }}>
          Edit it however you like. Copy link copies exactly what is written here.
        </span>
      </div>

      <ul
        style={{
          listStyle: 'none', margin: 0, padding: 0, minWidth: 0,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 96px), 1fr))', gap: 10,
        }}
      >
        {SHARE_TARGETS.map((target) => {
          const tile = TILE[target];
          const href = shareHref(target, campaignUrl, shareText);
          const inner = (
            <>
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 38, height: 38, borderRadius: 999, background: tile.bg, color: tile.fg,
                  fontSize: 16, fontWeight: 800,
                }}
              >
                {tile.glyph}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--t2)' }}>
                {target === 'link' && copied ? copiedLabel : target === 'link' ? copyLabel : tile.label}
              </span>
            </>
          );

          return (
            <li key={target} style={{ minWidth: 0 }}>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => record(target)}
                  style={tileStyle}
                >
                  {inner}
                </a>
              ) : (
                <button type="button" onClick={copy} style={{ ...tileStyle, width: '100%', cursor: 'pointer', font: 'inherit' }}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <span role="status" aria-live="polite" className="sr-only">{copied ? copiedLabel : ''}</span>
    </div>
  );
}

const tileStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 8, minHeight: 88, minWidth: 0, padding: '12px 6px',
  border: '1px solid var(--b1)', borderRadius: 14, background: 'var(--s1)',
  textDecoration: 'none', textAlign: 'center',
};
