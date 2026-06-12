'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CampaignMenu({
  id,
  slug,
  title,
  status,
}: {
  id: string;
  slug: string;
  title: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const canToggleStatus = status === 'active' || status === 'paused';

  async function handleToggleStatus() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status === 'active' ? 'paused' : 'active' }),
      });
      if (!res.ok) throw new Error();
      setOpen(false);
      router.refresh();
    } catch {
      setError('Failed to update campaign status.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="campaign-menu-wrap" ref={rootRef}>
      <button
        type="button"
        className="campaign-menu"
        aria-label={`More options for ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        &hellip;
      </button>
      {open && (
        <div className="campaign-menu-dropdown" role="menu">
          <Link href={`/campaigns/${slug}`} role="menuitem" onClick={() => setOpen(false)}>View campaign</Link>
          <Link href={`/dashboard/campaigns/${id}/edit`} role="menuitem" onClick={() => setOpen(false)}>Edit campaign</Link>
          <Link href={`/dashboard/campaigns/${id}/share`} role="menuitem" onClick={() => setOpen(false)}>Share</Link>
          <Link href={`/dashboard/campaigns/${id}/analytics`} role="menuitem" onClick={() => setOpen(false)}>View analytics</Link>
          {canToggleStatus && (
            <button type="button" role="menuitem" onClick={() => void handleToggleStatus()} disabled={busy}>
              {busy ? 'Updating…' : status === 'active' ? 'Pause campaign' : 'Resume campaign'}
            </button>
          )}
          {error && <p className="campaign-menu-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
