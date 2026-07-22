'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CharitMeShell, TopBar } from '../../../components/CharitMeApp';
import { createClient } from '../../../lib/supabase-browser';

type Message = { role: 'user' | 'assistant'; content: string };
type Campaign = { id: string; title: string };

const STARTERS = [
  'How do I get my first 10 donors?',
  'Write me a Facebook post for my campaign.',
  'What should my first update say?',
  'How do I thank donors effectively?',
  'Why is my campaign not converting visitors?',
  'What donation amounts should I suggest?',
];

export default function AiCoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('campaigns').select('id, title').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => {
        const list = (data ?? []) as Campaign[];
        setCampaigns(list);
        if (list.length > 0) setSelectedCampaign(list[0]!.id);
      });
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          messages: newMessages,
          campaignId: selectedCampaign || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: err.error ?? 'Something went wrong. Please try again.' },
        ]);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: full },
        ]);
      }
    } catch (e) {
      if ((e as { name?: string }).name !== 'AbortError') {
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: 'Connection error. Please try again.' },
        ]);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [messages, loading, selectedCampaign]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send(input);
    }
  };

  const selectedTitle = campaigns.find(c => c.id === selectedCampaign)?.title;

  return (
    <CharitMeShell active="AI Coach">
      <TopBar
        title="AI Fundraising Coach"
        subtitle="Get expert fundraising advice, content, and strategy — powered by AI."
      />

      <div className="kf-flow-pad" style={{ display: 'flex', height: 'calc(100vh - 140px)', flexDirection: 'column' }}>

        {/* Campaign selector */}
        {campaigns.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 0', borderBottom: '1px solid var(--b1)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3)', whiteSpace: 'nowrap' }}>Campaign context:</span>
            <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}
              style={{ height: 36, border: '1px solid var(--b2)', borderRadius: 8, padding: '0 12px', fontSize: 13, maxWidth: 280, background: 'var(--s1, #fff)', color: 'var(--t1)' }}>
              <option value="">No campaign selected</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            {selectedTitle && (
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>Coach will personalise advice for this campaign.</span>
            )}
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 16 }}>

          {messages.length === 0 && (
            <div style={{ padding: '24px 0' }}>
              <div style={{ display: 'flex', gap: 14, marginBottom: 24, alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,var(--violet),#ec3fb4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  🤖
                </div>
                <div style={{ background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: '4px 14px 14px 14px', padding: '14px 18px', maxWidth: 480, fontSize: 14, lineHeight: 1.6, color: 'var(--t1)' }}>
                  Hi! I&apos;m your CharitMe AI Fundraising Coach. I can help you raise more money, write posts, craft emails, and grow your campaign. What do you need help with today?
                </div>
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
                Quick starters
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {STARTERS.map(s => (
                  <button key={s} type="button" onClick={() => void send(s)}
                    style={{ padding: '8px 16px', borderRadius: 20, border: '1px solid var(--b2)', background: 'var(--s1, #fff)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--t1)', transition: 'border-color .15s' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: msg.role === 'user' ? 'var(--violet)' : 'linear-gradient(135deg,var(--violet),#ec3fb4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: '#fff', fontWeight: 700,
              }}>
                {msg.role === 'user' ? 'U' : '🤖'}
              </div>
              <div style={{
                background: msg.role === 'user' ? 'var(--s2, rgba(109,53,255,.14))' : 'var(--s2)',
                border: '1px solid var(--b2)',
                borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                padding: '12px 16px', maxWidth: '72%', fontSize: 14, lineHeight: 1.65, color: 'var(--t1)',
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content || (loading && i === messages.length - 1 ? (
                  <span style={{ opacity: 0.5 }}>Thinking…</span>
                ) : '')}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ borderTop: '1px solid var(--b1)', paddingTop: 16, paddingBottom: 24, background: 'var(--s1, #fff)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask me anything about fundraising… (Cmd+Enter to send)"
              rows={2}
              disabled={loading}
              style={{
                flex: 1, border: '1.5px solid var(--b2)', borderRadius: 12,
                padding: '12px 14px', fontSize: 14, fontFamily: 'inherit',
                resize: 'none', outline: 'none', lineHeight: 1.5,
                background: 'var(--s1, #fff)',
              }}
            />
            <button type="button" onClick={() => void send(input)} disabled={loading || !input.trim()}
              style={{
                height: 48, width: 48, border: 0, borderRadius: 12, flexShrink: 0,
                background: loading || !input.trim() ? 'var(--b2)' : 'linear-gradient(135deg,var(--violet),#4d1ee0)',
                color: '#fff', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>
              {loading ? '…' : '↑'}
            </button>
            {loading && (
              <button type="button" onClick={() => abortRef.current?.abort()}
                style={{ height: 48, padding: '0 16px', border: '1px solid var(--b2)', borderRadius: 12, background: 'var(--s1, #fff)', fontSize: 13, cursor: 'pointer', color: 'var(--t2)', fontWeight: 700 }}>
                Stop
              </button>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--t3)', margin: '8px 0 0' }}>
            AI Coach · Cmd+Enter to send · Advice is for guidance only; consult professionals for legal/financial matters.
          </p>
        </div>
      </div>
    </CharitMeShell>
  );
}
