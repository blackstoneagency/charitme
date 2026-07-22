'use client';

import React, { useState } from 'react';
import {
  STORY_SECTIONS,
  composeStory,
  sectionsFromText,
  sectionsFilled,
  TONE_PRESETS,
  type StorySections,
  type StorySectionId,
} from '../../lib/story-scaffold';

// Guided four-section story authoring mode. Owns its own section state (seeded
// once from the current freeform story so nothing is clobbered), and composes
// every keystroke back into the single `description` field via onCompose. Tone
// presets drive an AI rewrite through the parent (onPickTone → runAi(tone)).
// Pure logic lives in lib/story-scaffold.ts. Themed + mobile-first.
export default function StorySectionsEditor({
  initialStory,
  onCompose,
  onPickTone,
  aiBusy,
}: {
  initialStory: string;
  onCompose: (story: string) => void;
  onPickTone: (aiTone: string) => void;
  aiBusy: boolean;
}) {
  const [sections, setSections] = useState<StorySections>(() => sectionsFromText(initialStory));

  const update = (id: StorySectionId, value: string) => {
    const next = { ...sections, [id]: value };
    setSections(next);
    onCompose(composeStory(next));
  };

  const filled = sectionsFilled(sections);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t2, #475569)' }}>
          Build your story section by section
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: filled === 4 ? 'var(--green-dark, #047857)' : 'var(--t3, #64748b)' }}>
          {filled}/4 sections
        </span>
      </div>

      {STORY_SECTIONS.map((sec, i) => {
        const done = (sections[sec.id]?.trim().length ?? 0) >= 15;
        return (
          <div key={sec.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label htmlFor={`cr-sec-${sec.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                flexShrink: 0, width: 20, height: 20, borderRadius: 999, fontSize: 11, fontWeight: 900,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--green, #059669)' : 'var(--s3, #e5e9f0)',
                color: done ? '#fff' : 'var(--t3, #94a3b8)',
              }}>
                {done ? '✓' : i + 1}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1, #1a1a2e)' }}>{sec.label}</span>
            </label>
            <textarea
              id={`cr-sec-${sec.id}`}
              value={sections[sec.id]}
              onChange={(e) => update(sec.id, e.target.value)}
              placeholder={sec.prompt}
              style={{ minHeight: 74 }}
            />
            <span style={{ fontSize: 12, color: 'var(--t3, #64748b)' }}>{sec.hint}</span>
          </div>
        );
      })}

      <div style={{ borderTop: '1px solid var(--b1, #e8ecf4)', paddingTop: 12 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--t2, #475569)', marginBottom: 8 }}>
          ✨ Rewrite in a tone
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TONE_PRESETS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onPickTone(t.tone)}
              disabled={aiBusy}
              title={t.description}
              style={{
                padding: '7px 13px', borderRadius: 999, cursor: aiBusy ? 'default' : 'pointer',
                border: '1.5px solid var(--b1, #e8ecf4)', background: 'var(--s2, #f8fafc)',
                fontSize: 13, fontWeight: 700, color: 'var(--t1, #1a1a2e)', fontFamily: 'inherit',
                opacity: aiBusy ? 0.55 : 1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--t3, #64748b)', marginTop: 8 }}>
          Uses AI to rewrite what you&apos;ve written — your words, a new voice. You can always edit after.
        </span>
      </div>
    </div>
  );
}
