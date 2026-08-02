'use client';

import React, { useState } from 'react';

interface Props {
  campaignId: string;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTED_QUESTIONS = [
  'Is this campaign verified?',
  'How is my donation used?',
  'Is my donation tax-deductible?',
  'When does this campaign end?',
];

export default function CampaignAssistant({ campaignId }: Props) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ask = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setQuestion('');
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/campaign-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, question: trimmed }),
      });
      const data: { answer?: string; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong — please try again.');
      setMessages((prev) => [...prev, { role: 'assistant', text: data.answer ?? '' }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 14, padding: '20px 22px', marginTop: 16 }}>
      <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>💬</span>
        <strong style={{ fontSize: 15, fontWeight: 900, color: 'var(--t1)' }}>Ask about this campaign</strong>
      </div>
      <p style={{ fontSize: 13, color: 'var(--t3)', margin: '6px 0 14px' }}>
        Get instant answers about this campaign&apos;s goal, verification, and how donations are used.
      </p>

      {messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                fontSize: 13.5,
                lineHeight: 1.5,
                padding: '10px 14px',
                borderRadius: 10,
                maxWidth: '92%',
                ...(m.role === 'user'
                  ? { background: 'var(--s2, #f1f5f9)', color: 'var(--t1)', fontWeight: 700, alignSelf: 'flex-end' }
                  : { background: 'rgba(108,53,255,.06)', color: 'var(--t2)', alignSelf: 'flex-start' }),
              }}
            >
              {m.role === 'assistant' && <span style={{ marginRight: 6 }}>✨</span>}
              {m.text}
            </div>
          ))}
          {loading && (
            <div style={{ fontSize: 13, color: 'var(--t3)', padding: '10px 14px' }}>✨ Thinking…</div>
          )}
        </div>
      )}

      {messages.length === 0 && (
        <div style={{ display: 'flex', minWidth: 0, gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {SUGGESTED_QUESTIONS.map((sq) => (
            <button
              key={sq}
              type="button"
              onClick={() => ask(sq)}
              disabled={loading}
              style={{
                fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 20,
                border: '1.5px solid var(--b2, #e2e8f0)', background: 'var(--s1, #fff)',
                color: 'var(--t2)', cursor: loading ? 'default' : 'pointer',
              }}
            >
              {sq}
            </button>
          ))}
        </div>
      )}

      {error && <p style={{ fontSize: 12.5, color: 'var(--red, #be123c)', margin: '0 0 10px' }}>{error}</p>}

      <form onSubmit={(e) => { e.preventDefault(); ask(question); }} style={{ display: 'flex', minWidth: 0, gap: 8 }}>
        <input
          type="text"
          aria-label="Ask a question about this campaign"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about this campaign…"
          maxLength={300}
          disabled={loading}
          style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--b1, #e2e8f0)', borderRadius: 10, fontSize: 13.5, outline: 'none' }}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          style={{
            padding: '10px 18px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13.5,
            background: 'var(--violet, #6c35ff)', color: '#fff', cursor: loading ? 'default' : 'pointer',
            opacity: loading || !question.trim() ? 0.6 : 1,
          }}
        >
          Ask
        </button>
      </form>
    </div>
  );
}
