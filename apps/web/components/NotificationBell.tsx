'use client';

import { useState, useEffect } from 'react';

// Inline bell SVG — avoids importing KFIcon which is in the parent file
function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="kf-icon"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/**
 * Fetches the unread donor-message count from /api/notifications/count
 * and renders the bell badge ONLY when count > 0.
 * Runs once on mount — no polling needed for this use-case.
 */
export default function NotificationBell() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/notifications/count')
      .then(r => r.json())
      .then((d: { count?: number }) => setCount(d.count ?? 0))
      .catch(() => setCount(0));
  }, []);

  return (
    <button
      className="kf-icon-btn"
      aria-label={count ? `${count} unread messages` : 'Notifications'}
      type="button"
    >
      <BellIcon />
      {count !== null && count > 0 && (
        <span>{count > 99 ? '99+' : count}</span>
      )}
    </button>
  );
}
