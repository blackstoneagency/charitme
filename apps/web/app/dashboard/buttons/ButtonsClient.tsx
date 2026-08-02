'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BUTTON_TYPES,
  parseButtonConfig,
  toWidgetOptions,
  describeButtonType,
  requiresCampaign,
  type ButtonType,
} from '../../../lib/embedded-buttons-core';
import { embedSnippet } from '../../../lib/widget-embed';

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';

type Campaign = { id: string; title: string; slug: string };
type SavedButton = {
  id: string;
  label: string;
  button_type: string;
  campaign_id: string | null;
  config: unknown;
  created_at: string;
};

/**
 * Saved embed buttons — the persistent form of the per-campaign widget
 * configurator, which builds a snippet and forgets it.
 *
 * The snippet for a saved button is rebuilt from its stored config through the
 * SAME `embedSnippet` the configurator uses, so a saved button and a freshly
 * configured one cannot render differently.
 */
export default function ButtonsClient({
  campaigns,
  initialButtons,
  loadFailed,
}: {
  campaigns: Campaign[];
  initialButtons: SavedButton[];
  loadFailed: boolean;
}) {
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [buttonType, setButtonType] = useState<ButtonType>('donate');
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const needsCampaign = requiresCampaign(buttonType);
  const canSubmit = label.trim().length > 0 && (!needsCampaign || campaignId) && !busy;

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/embedded-buttons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          buttonType,
          campaignId: needsCampaign ? campaignId : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error ?? 'Could not save that.'); return; }
      setLabel('');
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/embedded-buttons', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) setError('Could not delete that button.');
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function copy(id: string, snippet: string) {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard is blocked in every insecure context. The snippet is on screen
      // and selectable, so say that rather than failing silently.
      setError('Copying is blocked here — select the code and copy it manually.');
    }
  }

  function snippetFor(button: SavedButton): string | null {
    const campaign = campaigns.find((c) => c.id === button.campaign_id);
    // Without a campaign there is no page to embed. Rendering a snippet anyway
    // would hand out a broken iframe.
    if (!campaign) return null;
    return embedSnippet(ORIGIN, campaign.slug, campaign.title, toWidgetOptions(parseButtonConfig(button.config)));
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 22, maxWidth: 780 }}>
      <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, padding: 18, border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)' }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 750, color: 'var(--t1)' }}>New button</h2>

        <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5 }}>
          <span style={labelStyle}>Label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Support our work" maxLength={60} style={inputStyle} required />
        </label>

        <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5 }}>
          <span style={labelStyle}>Type</span>
          <select value={buttonType} onChange={(e) => setButtonType(e.target.value as ButtonType)} style={inputStyle}>
            {BUTTON_TYPES.map((t) => <option key={t} value={t}>{describeButtonType(t)}</option>)}
          </select>
        </label>

        {needsCampaign && (
          <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5 }}>
            <span style={labelStyle}>Campaign</span>
            {campaigns.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--t3)' }}>
                {/* Said rather than shown as an empty select whose every
                    submission would be refused. */}
                You have no campaigns yet — a donation button needs one to send
                money to. <a href="/create">Start a campaign</a> and this turns on.
              </span>
            ) : (
              <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} style={inputStyle}>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            )}
          </label>
        )}

        {error && <p style={{ color: 'var(--red-text)', fontSize: 13, margin: 0 }}>{error}</p>}

        <div>
          <button type="submit" className="kf-primary" disabled={!canSubmit} style={{ cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.6 }}>
            {busy ? 'Saving…' : 'Save button'}
          </button>
        </div>
      </form>

      <section>
        <h2 style={{ fontSize: 15, fontWeight: 750, color: 'var(--t1)', margin: '0 0 10px' }}>Saved buttons</h2>
        {loadFailed ? (
          <p style={{ fontSize: 14, color: 'var(--red-text)' }}>
            We could not load your buttons. That is a read failure, not an empty list.
          </p>
        ) : initialButtons.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--t3)' }}>None yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
            {initialButtons.map((button) => {
              const snippet = snippetFor(button);
              return (
                <li key={button.id} style={{ padding: 14, border: '1px solid var(--b1)', borderRadius: 'var(--r)', background: 'var(--s1)', minWidth: 0 }}>
                  <div style={{ display: 'flex', minWidth: 0, gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14.5, color: 'var(--t1)' }}>{button.label}</strong>
                    <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--t3)' }}>
                      {describeButtonType(button.button_type as ButtonType)}
                    </span>
                  </div>
                  {snippet ? (
                    <>
                      <textarea
                        readOnly
                        value={snippet}
                        rows={3}
                        aria-label={`Embed code for ${button.label}`}
                        onFocus={(e) => e.currentTarget.select()}
                        style={{
                          width: '100%', minWidth: 0, marginTop: 8, padding: 10,
                          fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.5,
                          color: 'var(--t1)', background: 'var(--s2)',
                          border: '1px solid var(--b1)', borderRadius: 'var(--r)', resize: 'vertical',
                        }}
                      />
                      <div style={{ display: 'flex', minWidth: 0, gap: 14, marginTop: 8 }}>
                        <button type="button" onClick={() => void copy(button.id, snippet)} style={linkButton('var(--brand-text)')}>
                          {copiedId === button.id ? 'Copied ✓' : 'Copy embed code'}
                        </button>
                        <button type="button" onClick={() => void remove(button.id)} disabled={busy} style={linkButton('var(--red-text)')}>
                          Delete
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 12.5, color: 'var(--t3)', margin: '8px 0' }}>
                        This button has no campaign attached, so there is no page to
                        embed. Delete it and create a new one.
                      </p>
                      <button type="button" onClick={() => void remove(button.id)} disabled={busy} style={linkButton('var(--red-text)')}>
                        Delete
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 650, color: 'var(--t2)' };
const inputStyle: React.CSSProperties = {
  width: '100%', minWidth: 0, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit',
  color: 'var(--t1)', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--r)',
};
const linkButton = (color: string): React.CSSProperties => ({
  fontSize: 12, fontWeight: 600, color, background: 'none', border: 'none',
  padding: 0, cursor: 'pointer', textDecoration: 'underline',
});
