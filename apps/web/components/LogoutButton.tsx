'use client';
import { useState } from 'react';
import { KFIcon } from './KindFundApp';

/**
 * Signs the user out by hitting the server-side signout endpoint,
 * which (a) revokes the refresh token on Supabase and (b) clears the
 * HttpOnly sb-* session cookies the middleware set.
 *
 * We then do a full hard-navigate to /login so the browser sends a new
 * request with the now-empty cookies — middleware sees no session and
 * the login page starts clean. Using window.location.href (not
 * router.push) ensures there is no leftover React state from the
 * previous session.
 *
 * NOTE: We do NOT call supabase.auth.signOut() on the browser client
 * here — the server route handles revocation. The browser client's own
 * SIGNED_OUT listener in SessionWatcher is sufficient for cases where
 * the token expires while the tab is open.
 */
export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } finally {
      // Hard redirect — picks up the cookie deletions and resets React state
      window.location.href = '/login';
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      aria-label="Sign out"
      className="kf-logout-btn"
    >
      <KFIcon name="logout" />
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
