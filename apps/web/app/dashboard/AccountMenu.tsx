'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function AccountMenu({ name, email }: { name: string; email: string | null }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const initials = name.split(/\s+/).filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <div className="dash-account" ref={rootRef}>
      <button
        type="button"
        className="dash-photo"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      />
      {open && (
        <div className="dash-account-menu" role="menu">
          <div className="dash-account-head">
            <span className="dash-account-avatar">{initials}</span>
            <div>
              <strong>{name}</strong>
              {email && <small>{email}</small>}
            </div>
          </div>
          <Link href="/profile" role="menuitem" onClick={() => setOpen(false)}>View Profile</Link>
          <Link href="/dashboard/settings" role="menuitem" onClick={() => setOpen(false)}>Account Settings</Link>
          <Link href="/login" role="menuitem" onClick={() => setOpen(false)}>Switch Account</Link>
          <button type="button" role="menuitem" className="dash-account-signout" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      )}
    </div>
  );
}
