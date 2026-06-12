'use client';

import React, { useState } from 'react';
import CommentLikeButton from './CommentLikeButton';

export interface WallComment {
  id: string;
  name: string;
  avatarUrl: string | null;
  anonymous: boolean;
  message: string;
  createdAt: string;
  likeCount: number;
  likedByUser: boolean;
  replies: { id: string; message: string; createdAt: string }[];
}

export default function CommentsList({
  campaignId,
  initialComments,
  isAuthenticated,
  loginNext,
}: {
  campaignId: string;
  initialComments: WallComment[];
  isAuthenticated: boolean;
  loginNext: string;
}) {
  const [comments, setComments] = useState(initialComments);
  const [offset, setOffset] = useState(initialComments.length);
  const [hasMore, setHasMore] = useState(initialComments.length >= 8);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/messages?limit=8&offset=${offset}`);
      const data: { comments: WallComment[]; hasMore: boolean } = await res.json();
      setComments((prev) => [...prev, ...(data.comments ?? [])]);
      setOffset(offset + (data.comments?.length ?? 0));
      setHasMore(!!data.hasMore);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  if (comments.length === 0) {
    return (
      <p style={{ fontSize: 14, color: 'var(--t3)', margin: 0 }}>
        Be the first to leave a message of support.
      </p>
    );
  }

  return (
    <>
      <div className="pc-comment-list">
        {comments.map((msg) => {
          const initials = msg.anonymous ? 'A' : (msg.name?.[0] ?? 'D');
          return (
            <div key={msg.id} className="pc-comment">
              <div className="pc-comment-avatar" style={{ backgroundImage: (!msg.anonymous && msg.avatarUrl) ? `url(${msg.avatarUrl})` : undefined }}>
                {(msg.anonymous || !msg.avatarUrl) && initials}
              </div>
              <div className="pc-comment-body">
                <div className="pc-comment-name">
                  {msg.name}
                  <span className="pc-comment-date">
                    {new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="pc-comment-text">{msg.message}</div>
                <div style={{ marginTop: 6 }}>
                  <CommentLikeButton
                    campaignId={campaignId}
                    messageId={msg.id}
                    initialCount={msg.likeCount}
                    initialLiked={msg.likedByUser}
                    isAuthenticated={isAuthenticated}
                    loginNext={loginNext}
                  />
                </div>
                {msg.replies.map((reply) => (
                  <div key={reply.id} className="pc-comment-reply">
                    <span className="pc-comment-reply-badge">Organizer</span>
                    <span className="pc-comment-reply-text">{reply.message}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button type="button" className="pc-loadmore" onClick={() => void loadMore()} disabled={loading}>
          {loading ? 'Loading…' : 'Load more comments'}
        </button>
      )}
    </>
  );
}
