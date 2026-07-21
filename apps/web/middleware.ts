import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from './lib/auth-config';

const PROTECTED = ['/create', '/dashboard', '/profile', '/admin'];
// Public exceptions that fall UNDER a protected prefix. The campaign path chooser
// must be viewable before sign-in (mirrors the already-public /ai-campaign entry) —
// login is still required once the visitor actually starts the wizard at /create.
const PUBLIC_EXCEPTIONS = ['/create/choose-path'];
type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Convert a persistent auth cookie into a session cookie by removing
 * maxAge / expires.  The browser will clear it when the window closes.
 * Deletion cookies must pass through unchanged — Supabase deletes the
 * PKCE code-verifier after a successful exchange using either maxAge:0
 * or expires: past-date, so both forms need to be detected.
 */
function toSessionCookie(options: CookieOptions): CookieOptions {
  const { maxAge, expires } = options;
  if (typeof maxAge === 'number' && maxAge <= 0) return options;
  if (expires instanceof Date && expires.getTime() <= Date.now()) return options;
  if (typeof expires === 'string' && new Date(expires).getTime() <= Date.now()) return options;
  const { maxAge: _m, expires: _e, ...rest } = options;
  void _m; void _e;
  return rest;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // ── OAuth safety net ──────────────────────────────────────────────────
  // When Supabase's `redirectTo` URL isn't in the project's Allowed Redirect
  // URLs list, Supabase falls back to the Site URL and appends ?code= there
  // (e.g. the homepage instead of /api/auth/callback).  Catch it here and
  // forward to the real callback handler so the session is always exchanged.
  const code = request.nextUrl.searchParams.get('code');
  if (code && path !== '/api/auth/callback') {
    const next = safeNextPath(request.nextUrl.searchParams.get('next'));
    const callbackUrl = new URL('/api/auth/callback', request.url);
    callbackUrl.searchParams.set('code', code);
    callbackUrl.searchParams.set('next', next);
    return NextResponse.redirect(callbackUrl);
  }

  // ── Session refresh + protected-route guard ───────────────────────────
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            // Use session cookies so auth is cleared when the browser closes
            response.cookies.set(name, value, toSessionCookie(options))
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isProtected =
    PROTECTED.some((p) => path.startsWith(p)) && !PUBLIC_EXCEPTIONS.some((p) => path === p);

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', path);
    return NextResponse.redirect(loginUrl);
  }

  // ── Security headers ─────────────────────────────────────────────────
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Framing / clickjacking protection.
  // Campaign embed widgets (`/campaigns/<slug>/embed`) are meant to be
  // iframed on third-party sites, so they must stay frame-able by anyone.
  // Every other route is locked to same-origin framing. We use the modern
  // `frame-ancestors` CSP directive (which supersedes X-Frame-Options) and
  // keep X-Frame-Options only for non-embed routes as a legacy fallback.
  const isEmbed = /^\/campaigns\/[^/]+\/embed\/?$/.test(path);
  if (isEmbed) {
    response.headers.set('Content-Security-Policy', 'frame-ancestors *');
    response.headers.delete('X-Frame-Options');
  } else {
    response.headers.set('Content-Security-Policy', "frame-ancestors 'self'");
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  }
  // Strict-Transport-Security (HSTS) — only set in production to avoid
  // locking out local dev environments
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
