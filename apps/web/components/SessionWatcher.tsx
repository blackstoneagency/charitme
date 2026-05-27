'use client';
/**
 * SessionWatcher
 *
 * Mounted once in the root layout. Handles two scenarios:
 *
 * 1. SESSION EXPIRY (while browser is open)
 *    Supabase fires SIGNED_OUT when the refresh token can no longer renew
 *    the access token.  We redirect to /login immediately so the user isn't
 *    left on a protected page with stale state.
 *
 * 2. BROWSER / TAB CLOSE
 *    We fire signOut() on `pagehide` (fires reliably on tab/window close,
 *    back-navigation, and page unload — unlike beforeunload which some
 *    browsers suppress).  The session cookies are already session-scoped
 *    (no maxAge) so the browser clears them on close anyway; this call
 *    also revokes the refresh token server-side for belt-and-suspenders.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase-browser';

export default function SessionWatcher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // ── 1. React to auth state changes ──────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_OUT') {
          router.push('/login');
        }
      },
    );

    // ── 2. Sign out when the tab / browser window is closed ─────────────
    // `pagehide` fires on:  tab close, window close, back/forward cache entry,
    //                        and page unload — more reliable than beforeunload.
    // We use `navigator.sendBeacon` so the request survives the page teardown.
    const handlePageHide = () => {
      // Best-effort: sign out on the server so the refresh token is revoked.
      // The cookies are already session-scoped and will be cleared by the
      // browser, but revoking the token prevents replay attacks.
      navigator.sendBeacon('/api/auth/signout');
    };

    window.addEventListener('pagehide', handlePageHide);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [router]);

  return null;
}
