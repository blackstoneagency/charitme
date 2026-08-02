'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_WIDGET_OPTIONS,
  WIDGET_MIN_WIDTH,
  WIDGET_MAX_WIDTH,
  clampWidth,
  embedSnippet,
  widgetHeight,
  widgetPath,
  type WidgetOptions,
  type WidgetTheme,
} from '../../../../../lib/widget-embed';

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';

type Campaign = { id: string; title: string; slug: string };

const THEMES: { value: WidgetTheme; label: string; hint: string }[] = [
  { value: 'light', label: 'Light', hint: 'For pages with a white or pale background.' },
  { value: 'dark', label: 'Dark', hint: 'For pages with a dark background.' },
  { value: 'auto', label: 'Match visitor', hint: "Follows the visitor's own light/dark setting." },
];

const TOGGLES: { key: keyof WidgetOptions; label: string; hint: string }[] = [
  { key: 'showCover', label: 'Cover image', hint: 'Turn off for a compact sidebar widget.' },
  { key: 'showProgress', label: 'Progress bar', hint: 'Amount raised against your goal.' },
  { key: 'showDonorCount', label: 'Donor count', hint: 'Sits under the progress bar.' },
];

/**
 * Widget configurator (design #131).
 *
 * The preview is a real <iframe> pointed at the SAME url the snippet contains,
 * not a mock-up of one. A hand-drawn preview is the failure this page has to
 * avoid: it always looks right, including on the day the widget itself is
 * broken, and it drifts from the real widget the moment either side changes.
 * Both URLs come from `widgetPath`, so they cannot disagree.
 */
export default function WidgetPanel({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState('');
  const [options, setOptions] = useState<WidgetOptions>(DEFAULT_WIDGET_OPTIONS);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    void (async () => {
      const res = await fetch(`/api/campaigns/${campaignId}`).catch(() => null);
      if (!active) return;
      if (!res || res.status === 401) { router.push('/login'); return; }
      if (!res.ok) { setError('Could not load this campaign.'); return; }
      const data = await res.json() as Campaign;
      if (active) setCampaign({ id: data.id, title: data.title, slug: data.slug });
    })();
    return () => { active = false; };
  }, [campaignId, router]);

  const snippet = useMemo(
    () => (campaign ? embedSnippet(ORIGIN, campaign.slug, campaign.title, options) : ''),
    [campaign, options],
  );
  const previewSrc = campaign ? widgetPath(campaign.slug, options) : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked in some browsers and every insecure context. The
      // snippet is on screen in a selectable <textarea>, so this is not a dead
      // end — say so rather than failing silently.
      setError('Copying is blocked in this browser — select the code and copy it manually.');
    }
  }

  if (error && !campaign) {
    return <p style={{ color: 'var(--red-text)', fontSize: 14 }}>{error}</p>;
  }
  if (!campaign) {
    return <p style={{ color: 'var(--t3)', fontSize: 14 }}>Loading…</p>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,420px)', gap: 24, alignItems: 'start' }} className="widget-config">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18, minWidth: 0 }}>
        <section style={card}>
          <h2 style={cardTitle}>Appearance</h2>
          <div role="radiogroup" aria-label="Widget theme" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
            {THEMES.map((t) => (
              <label key={t.value} style={row(options.theme === t.value)}>
                <input
                  type="radio"
                  name="widget-theme"
                  value={t.value}
                  aria-label={t.label}
                  checked={options.theme === t.value}
                  onChange={() => setOptions((o) => ({ ...o, theme: t.value }))}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <strong style={{ display: 'block', fontSize: 14, color: 'var(--t1)' }}>{t.label}</strong>
                  <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>{t.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section style={card}>
          <h2 style={cardTitle}>What to show</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
            {TOGGLES.map((t) => {
              const disabled = t.key === 'showDonorCount' && !options.showProgress;
              return (
                <label key={t.key} style={{ ...row(false), opacity: disabled ? 0.55 : 1 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(options[t.key])}
                    disabled={disabled}
                    aria-label={t.label}
                    onChange={(e) => setOptions((o) => ({ ...o, [t.key]: e.target.checked }))}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <strong style={{ display: 'block', fontSize: 14, color: 'var(--t1)' }}>{t.label}</strong>
                    <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>
                      {/* The donor count lives inside the progress block, so it
                          cannot be shown on its own — say why rather than
                          leaving a checkbox that silently does nothing. */}
                      {disabled ? 'Needs the progress bar turned on.' : t.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <section style={card}>
          <h2 style={cardTitle}>Width</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range"
              min={WIDGET_MIN_WIDTH}
              max={WIDGET_MAX_WIDTH}
              step={10}
              value={options.width}
              aria-label="Widget width in pixels"
              onChange={(e) => setOptions((o) => ({ ...o, width: clampWidth(Number(e.target.value)) }))}
              style={{ flex: 1 }}
            />
            <output style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--t2)', minWidth: 56, textAlign: 'right' }}>
              {options.width}px
            </output>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--t3)', margin: '8px 0 0' }}>
            The snippet also carries <code>max-width:100%</code>, so the widget shrinks
            rather than overflowing on a narrow phone.
          </p>
        </section>

        <section style={card}>
          <h2 style={cardTitle}>Embed code</h2>
          <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 10px' }}>
            Paste this into any web page. Height is set from the options above, so
            there is no blank band under the widget.
          </p>
          <textarea
            readOnly
            value={snippet}
            rows={4}
            aria-label="Embed code"
            onFocus={(e) => e.currentTarget.select()}
            style={{
              width: '100%', fontFamily: 'var(--mono)', fontSize: 12.5, lineHeight: 1.5,
              padding: 12, borderRadius: 'var(--r)', border: '1px solid var(--b1)',
              background: 'var(--s2)', color: 'var(--t1)', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={copy} className="kf-primary" style={{ cursor: 'pointer' }}>
              {copied ? 'Copied ✓' : 'Copy embed code'}
            </button>
            <a
              href={`${ORIGIN}${previewSrc}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: 'var(--brand-text)', fontWeight: 600 }}
            >
              Open the widget in a new tab ↗
            </a>
          </div>
          {error && <p style={{ color: 'var(--red-text)', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
        </section>
      </div>

      <aside style={{ ...card, position: 'sticky', top: 16, minWidth: 0 }}>
        <h2 style={cardTitle}>Live preview</h2>
        <p style={{ fontSize: 12.5, color: 'var(--t3)', margin: '0 0 12px' }}>
          This is the real widget, loaded from the same URL as the code above — not
          a mock-up of it.
        </p>
        <div style={{ background: 'var(--s2)', border: '1px dashed var(--b1)', borderRadius: 'var(--rl)', padding: 16, display: 'flex', justifyContent: 'center' }}>
          <iframe
            key={previewSrc}
            src={previewSrc}
            width={options.width}
            height={widgetHeight(options)}
            title={`Preview of the donation widget for ${campaign.title}`}
            style={{ border: 0, maxWidth: '100%', borderRadius: 10, background: 'var(--s1)' }}
          />
        </div>
      </aside>
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'var(--s1)',
  border: '1px solid var(--b1)',
  borderRadius: 'var(--rl)',
  padding: 18,
};

const cardTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 750,
  color: 'var(--t1)',
  margin: '0 0 12px',
};

function row(active: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '18px minmax(0, 1fr)',
    gap: 10,
    alignItems: 'start',
    padding: '10px 12px',
    borderRadius: 'var(--r)',
    border: `1px solid ${active ? 'var(--brand-text)' : 'var(--b1)'}`,
    background: active ? 'var(--s2)' : 'transparent',
    cursor: 'pointer',
  };
}
