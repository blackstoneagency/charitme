'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

export default function CommentLikeButton({
  campaignId,
  messageId,
  initialCount,
  initialLiked,
  isAuthenticated,
  loginNext,
}: {
  campaignId: string;
  messageId: string;
  initialCount: number;
  initialLiked: boolean;
  isAuthenticated: boolean;
  loginNext: string;
}) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(loginNext)}`);
      return;
    }
    if (loading) return;
    setLoading(true);
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => c + (nextLiked ? 1 : -1));
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/messages/${messageId}/like`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { liked: boolean; count: number };
      setLiked(data.liked);
      setCount(data.count);
    } catch {
      setLiked(!nextLiked);
      setCount((c) => c - (nextLiked ? 1 : -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike this comment' : 'Like this comment'}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        border: 'none', background: 'none',
        // Measured 23.1x18 with `padding: 0` — under the WCAG 2.2 (2.5.8) 24px
        // minimum. The negative margin keeps the button drawn exactly where it
        // was while the touch target grows around it.
        padding: '4px 6px', margin: '-4px -6px', minHeight: 24, minWidth: 24,
        fontSize: 12, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
        color: liked ? '#ec4899' : 'var(--t3)',
      }}
    >
      <span aria-hidden="true">{liked ? '♥' : '♡'}</span>
      {count}
    </button>
  );
}
