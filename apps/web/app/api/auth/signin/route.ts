import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { safeNextPath } from '../../../../lib/auth-config';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * GET /api/auth/signin?provider=google&next=<path>
 *
 * Server-side OAuth initiation — the SSR-safe PKCE pattern for Next.js.
 *
 * Why this exists:
 *   When the browser client calls supabase.auth.signInWithOAuth() it stores
 *   the PKCE code-verifier via document.cookie (JavaScript).  In some builds /
 *   environments the cookie is not reliably present when the callback route
 *   runs (different navigation contexts, cookie jar quirks, etc.), producing
 *   the "PKCE code verifier not found in storage" error.
 *
 * How this fixes it:
 *   1. The browser navigates here instead (a plain GET, no JS needed).
 *   2. createServerClient calls signInWithOAuth({ skipBrowserRedirect: true })
 *      which generates the code-verifier and stores it via setAll() — our
 *      server cookie handler.
 *   3. We write those cookies onto the redirect response's Set-Cookie headers.
 *   4. The browser follows the redirect to Google with the code-verifier
 *      already in its cookie jar as a server-set cookie.
 *   5. When Supabase redirects back to /api/auth/callback the cookie is
 *      reliably present in request.cookies and the exchange succeeds.
 */
function getRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = safeNextPath(searchParams.get('next'));
  const origin = getRequestOrigin(request);

  // Collect cookies Supabase wants to set (the PKCE code-verifier lives here)
  const pendingCookies: CookieToSet[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookies: CookieToSet[]) {
          // Buffer — we'll attach them to the redirect response below
          pendingCookies.push(...cookies);
        },
      },
    }
  );

  const callbackUrl = `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
      // CRITICAL: don't auto-redirect — we need to capture the cookies first
      skipBrowserRedirect: true,
    },
  });

  if (error ?? !data.url) {
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', error?.message ?? 'Could not initiate Google sign-in');
    return NextResponse.redirect(loginUrl);
  }

  // Redirect the browser to Google.  The code-verifier is set as an HTTP
  // Set-Cookie on THIS response, not via document.cookie, so it is always
  // in the browser's jar when the /api/auth/callback request fires.
  const response = NextResponse.redirect(data.url);
  pendingCookies.forEach(({ name, value, options }) => {
    // Keep the original options (don't strip maxAge — the verifier must
    // survive the full Google ↔ Supabase ↔ our-callback redirect chain)
    response.cookies.set(name, value, { ...options, sameSite: 'lax', path: '/' });
  });

  return response;
}
