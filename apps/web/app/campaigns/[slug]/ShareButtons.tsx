'use client';

import React, { useRef, useState } from 'react';

interface Props {
  campaignId: string;
  campaignUrl: string;
  campaignTitle: string;
  qrUrl: string;
  qrPosterId: string;
}

type Channel = 'facebook' | 'messenger' | 'linkedin' | 'twitter' | 'whatsapp' | 'email' | 'link';

// Messenger's Send dialog requires our own registered Facebook app whose
// domain whitelist includes this site — without one the dialog errors out,
// so the tile is hidden unless the app id is configured.
const FB_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

const TILES: { channel: Channel; label: string; iconText: string; iconBg: string; iconColor: string; getHref: (url: string, title: string) => string }[] = [
  {
    channel: 'facebook',
    label: 'Facebook',
    iconText: 'f',
    iconBg: '#e7f0ff',
    iconColor: '#1877f2',
    getHref: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  ...(FB_APP_ID ? [{
    channel: 'messenger' as Channel,
    label: 'Messenger',
    iconText: 'm',
    iconBg: '#e6f3ff',
    iconColor: '#0084ff',
    getHref: (url: string) => `https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(url)}`,
  }] : []),
  {
    channel: 'linkedin',
    label: 'LinkedIn',
    iconText: 'in',
    iconBg: '#e8f3fb',
    iconColor: '#0a66c2',
    getHref: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    channel: 'twitter',
    label: 'X / Twitter',
    iconText: '𝕏',
    iconBg: '#f0f0f0',
    iconColor: '#000',
    getHref: (url, title) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    channel: 'whatsapp',
    label: 'WhatsApp',
    iconText: '✓',
    iconBg: '#e9fbe9',
    iconColor: '#25d366',
    getHref: (url, title) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
  {
    channel: 'email',
    label: 'Email',
    iconText: '@',
    iconBg: '#f0edff',
    iconColor: '#6c35ff',
    getHref: (url, title) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`Please support: ${url}`)}`,
  },
];

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default function ShareButtons({ campaignId, campaignUrl, campaignTitle, qrUrl, qrPosterId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const embedInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  const embedCode = `<iframe src="${campaignUrl}/embed" width="400" height="500" style="border:0;border-radius:12px;max-width:100%" title="Donate to ${escapeAttr(campaignTitle)}"></iframe>`;

  const recordShare = (channel: Channel) => {
    void fetch('/api/share-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, channel }),
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(campaignUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      inputRef.current?.select();
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    recordShare('link');
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
    }).catch(() => {
      embedInputRef.current?.select();
      document.execCommand('copy');
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
    });
  };

  return (
    <div className="pc-quick-share" id="quick-share">
      <div className="pc-quick-share-header">
        <strong style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>Quick share</strong>
        <span style={{ fontSize: 12, color: 'var(--t3)' }}>📱 Share this campaign</span>
      </div>
      <div className="pc-quick-share-qr">
        <div className="pc-quick-share-platforms">
          {/* Copy link */}
          <div className="pc-share-copy">
            <input ref={inputRef} type="text" readOnly value={campaignUrl} aria-label="Campaign URL" />
            <button type="button" onClick={handleCopy} style={{ minWidth: 60 }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Social tiles */}
          <div className="pc-share-grid">
            {TILES.map(tile => (
              <a
                key={tile.channel}
                href={tile.getHref(campaignUrl, campaignTitle)}
                target={tile.channel === 'email' ? undefined : '_blank'}
                rel={tile.channel === 'email' ? undefined : 'noopener noreferrer'}
                className="pc-share-tile"
                onClick={() => recordShare(tile.channel)}
              >
                <span className="pc-share-tile-icon" style={{ background: tile.iconBg, color: tile.iconColor }}>
                  {tile.iconText}
                </span>
                {tile.label}
              </a>
            ))}
          </div>

          <div style={{ marginTop: 14 }}>
            <a
              href={`/api/campaigns/${qrPosterId}/qr-poster`}
              target="_blank"
              // 14px tall as a bare inline link, which fails WCAG 2.2 SC 2.5.8
              // (24px floor). It is a standalone control, not a link inside a
              // sentence, so the inline exception does not apply. This went
              // unmeasured for as long as it existed: the only routes rendering
              // this component are listed under a stub-fixture slug that 404s,
              // so every sweep skipped them.
              style={{
                display: 'inline-flex', alignItems: 'center', minHeight: 24,
                fontSize: 12, fontWeight: 700, color: 'var(--green-text)', textDecoration: 'none',
              }}
            >
              🖨 Download printable poster →
            </a>
          </div>

          <details className="pc-match-howto" style={{ marginTop: 14 }}>
            <summary>🔌 Embed this campaign on your website</summary>
            <p className="pc-match-note" style={{ margin: '8px 0' }}>
              Paste this code into your site to show a live donation widget for this campaign.
            </p>
            <div className="pc-share-copy">
              <input ref={embedInputRef} type="text" readOnly value={embedCode} aria-label="Embed code" />
              <button type="button" onClick={handleCopyEmbed} style={{ minWidth: 60 }}>
                {embedCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </details>
        </div>

        {/* QR code */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt={`QR code for ${campaignTitle}`}
            width={120}
            height={120}
            style={{ borderRadius: 10, border: '1px solid var(--b2)' }}
          />
          <span style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center' }}>Scan to donate</span>
        </div>
      </div>
    </div>
  );
}
