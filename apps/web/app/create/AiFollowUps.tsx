'use client';

import React, { useEffect, useRef, useState } from 'react';
import { followUpPlan, type FollowUpForm } from '../../lib/campaign-followups';

// One-question-at-a-time follow-ups shown after the AI drafts a campaign, filling
// the human facts the AI can't infer (who it's for, relationship, timing). Pure
// question logic lives in lib/campaign-followups.ts. Answers flow straight into the
// wizard form via `onAnswer`, so the draft updates live and the next question is
// derived from the updated form. Themed (CSS vars) + mobile-first.
export default function AiFollowUps({
  form,
  onAnswer,
}: {
  form: FollowUpForm;
  onAnswer: (field: keyof FollowUpForm, value: string) => void;
}) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const remaining = followUpPlan(form).filter((q) => !skipped.has(q.id));
  const current = remaining[0] ?? null;

  // Move focus to each new question's field as it appears — the same guidance
  // autoFocus gave, done accessibly (no autoFocus prop, focus follows the flow).
  const currentId = current?.id;
  useEffect(() => { inputRef.current?.focus(); }, [currentId]);

  const answer = (value: string) => {
    if (!current) return;
    onAnswer(current.field, value);
    setDraft('');
  };
  const skip = () => {
    if (!current) return;
    if (current.skipValue !== undefined) onAnswer(current.field, current.skipValue);
    setSkipped((prev) => new Set(prev).add(current.id));
    setDraft('');
  };

  const wrap: React.CSSProperties = {
    marginTop: 16, padding: '18px 18px 16px', borderRadius: 16,
    border: '1.5px solid var(--b2, #e2d9ff)', background: 'var(--s2, #f5f0ff)',
  };

  if (!current) {
    return (
      <div style={wrap}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14.5, color: 'var(--green-dark, #047857)' }}>
          <span>✓</span> All set — your draft has everything we need. Continue when you&apos;re ready.
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 13px', borderRadius: 10,
    border: '1.5px solid var(--b1, #e8ecf4)', background: 'var(--s1, #fff)',
    color: 'var(--t1, #1a1a2e)', fontSize: 15, fontFamily: 'inherit', outline: 'none',
  };
  const continueBtn = (disabled: boolean) => (
    <button
      type="button"
      onClick={() => answer(draft.trim())}
      disabled={disabled}
      style={{ marginTop: 10, padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--violet, #6c35ff)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }}
    >
      Continue
    </button>
  );

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 12.5, letterSpacing: '.03em', color: 'var(--violet, #6c35ff)' }}>
          ✨ A FEW QUICK QUESTIONS
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3, #64748b)' }}>
          {remaining.length} left
        </span>
      </div>

      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1, #1a1a2e)' }}>{current.question}</div>
      {current.help && (
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--t3, #64748b)' }}>{current.help}</p>
      )}

      <div style={{ marginTop: 12 }}>
        {current.kind === 'choice' && current.options && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {current.options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => answer(o.value)}
                style={{ padding: '9px 15px', borderRadius: 999, border: '1.5px solid var(--b2, #e2d9ff)', background: 'var(--s1, #fff)', color: 'var(--t1, #1a1a2e)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {current.kind === 'text' && (
          <div>
            <input ref={inputRef} type="text" value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 120))} placeholder="Type your answer…" style={inputStyle} />
            {continueBtn(draft.trim().length === 0)}
          </div>
        )}

        {current.kind === 'money' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--t3, #64748b)' }}>$</span>
              <input ref={inputRef} type="number" min="1" step="1" inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="5000" style={inputStyle} />
            </div>
            {continueBtn(!(Number.parseFloat(draft) > 0))}
          </div>
        )}

        {current.kind === 'date' && (
          <div>
            <input type="date" value={draft} onChange={(e) => setDraft(e.target.value)} style={inputStyle} />
            {continueBtn(draft.trim().length === 0)}
          </div>
        )}
      </div>

      {current.skippable && (
        <button
          type="button"
          onClick={skip}
          style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--t3, #64748b)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
        >
          I&apos;m not sure — skip this
        </button>
      )}
    </div>
  );
}
