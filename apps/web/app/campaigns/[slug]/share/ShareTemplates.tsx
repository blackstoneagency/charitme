'use client';

import React, { useState } from 'react';
import { SHARE_TEMPLATES } from '../../../../lib/share-page-core';

/**
 * Copyable, EDITABLE suggested messages.
 *
 * A supporter facing an empty box usually sends nothing. These are a starting
 * point, not a script — every one is a real textarea the person can rewrite
 * before it goes out under their own name, which is why none of them assert
 * anything about the campaign the platform cannot stand behind.
 */
export default function ShareTemplates({
  campaignTitle,
  campaignUrl,
}: {
  campaignTitle: string;
  campaignUrl: string;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(SHARE_TEMPLATES.map((t) => [t.id, t.build(campaignTitle, campaignUrl)])),
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState('');

  async function copy(id: string) {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(drafts[id] ?? '');
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
    } catch {
      // Clipboard is blocked in every insecure context. The text is on screen and
      // selectable, so say that rather than failing silently or faking success.
      setCopyError('Copying is blocked here — select the message and copy it manually.');
    }
  }

  function reset(id: string) {
    const template = SHARE_TEMPLATES.find((t) => t.id === id);
    if (template) setDrafts((d) => ({ ...d, [id]: template.build(campaignTitle, campaignUrl) }));
  }

  return (
    <section aria-labelledby="share-templates-heading" style={{ minWidth: 0 }}>
      <h2 id="share-templates-heading" style={headingStyle}>Say it in your words</h2>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--t3)', maxWidth: 640 }}>
        A message from someone you know works better than a link on its own. Edit
        any of these before you send it — they are a starting point, not a script.
      </p>

      {copyError && (
        <p role="status" style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--red-text)' }}>{copyError}</p>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
        {SHARE_TEMPLATES.map((template) => {
          const draft = drafts[template.id] ?? '';
          const edited = draft !== template.build(campaignTitle, campaignUrl);
          return (
            <li key={template.id} style={cardStyle}>
              <div style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 750, color: 'var(--t1)' }}>{template.label}</h3>
                <span style={{ fontSize: 11.5, color: 'var(--t3)', fontWeight: 650 }}>
                  {template.medium === 'short' ? 'Good for a text' : 'Good for email or a post'}
                </span>
              </div>

              <label style={{ display: 'block' }}>
                <span className="sr-only">Message: {template.label}</span>
                <textarea
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [template.id]: e.target.value }))}
                  rows={3}
                  style={textareaStyle}
                />
              </label>

              <div style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
                <button type="button" onClick={() => void copy(template.id)} className="kf-primary" style={{ minHeight: 44 }}>
                  {copiedId === template.id ? 'Copied ✓' : 'Copy message'}
                </button>
                {edited && (
                  <button type="button" onClick={() => reset(template.id)} style={linkButtonStyle}>
                    Reset to suggested
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const headingStyle: React.CSSProperties = {
  margin: '0 0 6px', fontSize: 19, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.01em',
};
const cardStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10,
  padding: 16, border: '1px solid var(--b1)', borderRadius: 'var(--rl)',
  background: 'var(--s1)', minWidth: 0,
};
const textareaStyle: React.CSSProperties = {
  width: '100%', minWidth: 0, maxWidth: '100%', padding: 11, fontSize: 14,
  fontFamily: 'inherit', lineHeight: 1.55, color: 'var(--t1)', background: 'var(--s2)',
  border: '1px solid var(--b1)', borderRadius: 'var(--r)', resize: 'vertical',
};
const linkButtonStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 650, color: 'var(--brand-text)', background: 'none',
  border: 'none', padding: '10px 0', minHeight: 44, cursor: 'pointer', textDecoration: 'underline',
};
