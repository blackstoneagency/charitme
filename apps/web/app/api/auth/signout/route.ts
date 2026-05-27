import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';

/**
 * POST /api/auth/signout
 *
 * Called by:
 *  - SessionWatcher via navigator.sendBeacon on tab/browser close
 *  - LogoutButton via fetch for explicit sign-out
 *
 * Signs the user out server-side (revokes the refresh token on Supabase)
 * and clears all sb-* auth cookies from the browser.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });

  // Clear all sb-* auth cookies
  request.cookies.getAll().forEach(({ name }) => {
    if (name.startsWith('sb-')) {
      response.cookies.set(name, '', {
        maxAge: 0,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }
  });

  return response;
}
