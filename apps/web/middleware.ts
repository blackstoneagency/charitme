import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from './lib/auth-config';

const PROTECTED = ['/dashboard', '/profile', '/admin'];
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

function contentSecurityPolicy(nonce: string, isEmbed: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.stripe.com",
    "frame-src 'self' https://checkout.stripe.com https://*.stripe.com https://www.youtube.com https://player.vimeo.com",
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com https://*.stripe.com",
    `frame-ancestors ${isEmbed ? '*' : "'self'"}`,
  ].join('; ');
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
  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            // Use session cookies so auth is cleared when the browser closes
            response.cookies.set(name, value, toSessionCookie(options))
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isProtected = PROTECTED.some((p) => path.startsWith(p));

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
    response.headers.delete('X-Frame-Options');
  } else {
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  }
  response.headers.set('Content-Security-Policy', contentSecurityPolicy(nonce, isEmbed));
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
