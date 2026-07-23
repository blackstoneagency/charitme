import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { safeNextPath } from '../../../../lib/auth-config';
import { ensureUserProfile } from '../../../../lib/profile-sync';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Strip maxAge/expires so auth cookies become session-scoped (browser-close
 * clears them).  Deletion cookies must pass through unchanged — otherwise the
 * PKCE code-verifier cookie is not properly cleared after the exchange.
 *
 * A cookie is a deletion signal when EITHER:
 *   • maxAge is 0 or negative, OR
 *   • expires is a past date (Date object in the past, or ISO string ≤ now)
 */
function toSessionCookie(options: CookieOptions): CookieOptions {
  const { maxAge, expires } = options;
  // Keep deletion cookies intact
  if (typeof maxAge === 'number' && maxAge <= 0) return options;
  if (expires instanceof Date && expires.getTime() <= Date.now()) return options;
  if (typeof expires === 'string' && new Date(expires).getTime() <= Date.now()) return options;
  // Strip expiry so the session cookie dies with the browser
  const { maxAge: _m, expires: _e, ...rest } = options;
  void _m; void _e;
  return rest;
}

function getRequestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));
  const origin = getRequestOrigin(request);

  // Build the redirect response FIRST so we can set cookies directly on it.
  // Using next/headers `cookies()` + `NextResponse.redirect` loses the cookie
  // because they are different response objects. Attaching to the redirect
  // response ensures the session cookie actually reaches the browser.
  const redirectResponse = NextResponse.redirect(new URL(next, origin));

  if (!code) return redirectResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      cookies: {
        // Read cookies from the incoming request
        getAll() { return request.cookies.getAll(); },
        // Write cookies directly onto the redirect response (as session cookies)
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, toSessionCookie(options));
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'Authentication could not be completed');
    return NextResponse.redirect(loginUrl);
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'Could not confirm your signed-in user');
    return NextResponse.redirect(loginUrl);
  }

  try {
    await ensureUserProfile(user);
  } catch {
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'Your account could not be prepared. Please try again.');
    return NextResponse.redirect(loginUrl);
  }

  return redirectResponse;
}
