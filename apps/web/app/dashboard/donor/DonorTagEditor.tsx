'use client';

import React, { useState } from 'react';

interface Props {
  email: string;
  fullName: string;
  initialTags: string[];
  lifetimeValueCents: number;
  lastDonation: string;
}

const TAG_COLORS = ['#6c35ff', '#19b86a', '#2f80ed', '#ec3fb4', '#f59e0b', 'var(--red-text)'];

function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

export default function DonorTagEditor({ email, fullName, initialTags, lifetimeValueCents, lastDonation }: Props) {
  const [tags, setTags] = useState(initialTags);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  if (!email) return <span style={{ color: 'var(--t3)', fontSize: 12 }}>—</span>;

  async function persist(nextTags: string[]) {
    setSaving(true);
    try {
      await fetch('/api/crm/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName,
          tags: nextTags,
          lifetimeValueCents,
          lastDonatedAt: lastDonation,
        }),
      });
    } catch {
      // best-effort tag sync
    } finally {
      setSaving(false);
    }
  }

  function addTag(raw: string) {
    const tag = raw.trim();
    setInput('');
    setEditing(false);
    if (!tag || tags.includes(tag)) return;
    const next = [...tags, tag];
    setTags(next);
    void persist(next);
  }

  function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    void persist(next);
  }

  return (
    <div style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {tags.map((tag) => {
        const color = tagColor(tag);
        return (
          <span key={tag} style={{
            fontSize: 11, fontWeight: 700, padding: '2px 6px 2px 8px', borderRadius: 12,
            // color-mix, not `${color}1a`. String-appending an alpha suffix only
            // works when every TAG_COLORS entry is a bare hex literal: the moment
            // one became `var(--red-text)` it produced `var(--red-text)1a`, which
            // is invalid CSS, so the chip lost its tint entirely and rendered as
            // bare text. color-mix accepts hex and custom properties alike.
            background: `color-mix(in srgb, ${color} 10%, transparent)`,
            color, display: 'flex', minWidth: 0, alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
          }}>
            {tag}
            <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color, fontSize: 12, padding: 0, lineHeight: 1 }}>
              ×
            </button>
          </span>
        );
      })}
      {editing ? (
        <input
          aria-label="Add a donor tag"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addTag(input); }
            if (e.key === 'Escape') { setInput(''); setEditing(false); }
          }}
          onBlur={() => addTag(input)}
          placeholder="Add tag…"
          style={{ fontSize: 11, border: '1px solid var(--b2)', borderRadius: 8, padding: '2px 6px', width: 84 }}
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} disabled={saving}
          style={{ fontSize: 11, color: 'var(--t3)', border: '1px dashed var(--b2)', borderRadius: 12, padding: '2px 8px', background: 'none', cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? '…' : '+ Tag'}
        </button>
      )}
    </div>
  );
}
