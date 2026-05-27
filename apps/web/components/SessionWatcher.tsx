'use client';
/**
 * SessionWatcher
 *
 * Mounted once in the root layout. Listens for Supabase SIGNED_OUT events
 * (token expiry, explicit sign-out) and redirects to /login immediately so
 * the user isn't left on a protected page with stale state.
 *
 * Browser-close logout is handled entirely by session-scoped cookies
 * (no maxAge / expires) set in middleware.ts and api/auth/callback —
 * the browser discards them when the window closes without any JS needed.
 *
 * NOTE: We intentionally do NOT use pagehide + sendBeacon here.
 * pagehide fires on ALL hard navigations (not just tab/window close),
 * which deletes the PKCE code-verifier cookie and breaks Google OAuth.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase-browser';

export default function SessionWatcher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_OUT') {
          router.push('/login');
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
