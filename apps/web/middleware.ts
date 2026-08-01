import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from './lib/auth-config';
import { LOCALE_COOKIE, LOCALE_HEADER, isSupportedMarketLocale, negotiateMarketLocale, resolveMarketLocale } from './lib/i18n';

const PROTECTED = ['/create', '/dashboard', '/profile', '/admin'];
// Public exceptions that fall UNDER a protected prefix. The campaign path chooser
// must be viewable before sign-in (mirrors the already-public /ai-campaign entry) —
// login is still required once the visitor actually starts the wizard at /create.
const PUBLIC_EXCEPTIONS = ['/create/choose-path'];
type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Ceiling on the per-request session refresh.
 *
 * This middleware runs on EVERY non-API request, and `supabase.auth.getUser()` is
 * a network round-trip. Unguarded, a slow or unreachable Supabase auth endpoint
 * stalls every page load for as long as the fetch takes to give up (measured at
 * ~7s against an unreachable host) — the whole site inherits the latency of one
 * dependency. Capping it keeps a degraded dependency from becoming a degraded
 * site: public pages render immediately, and protected pages fail SAFE by
 * treating the timeout as "not signed in", which redirects to login rather than
 * granting access.
 */
const AUTH_REFRESH_TIMEOUT_MS = 3_000;

/** Resolve the session user, giving up after AUTH_REFRESH_TIMEOUT_MS. */
async function getUserWithTimeout(
  supabase: { auth: { getUser: () => Promise<{ data: { user: unknown | null } }> } },
): Promise<{ user: unknown | null; timedOut: boolean }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<{ user: null; timedOut: true }>((resolve) => {
      timer = setTimeout(() => resolve({ user: null, timedOut: true }), AUTH_REFRESH_TIMEOUT_MS);
    });
    const lookup = supabase.auth.getUser().then((r) => ({ user: r.data.user ?? null, timedOut: false as const }));
    return await Promise.race([lookup, timeout]);
  } catch {
    // Network/DNS failure — same fail-safe as a timeout.
    return { user: null, timedOut: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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

const MFA_CHALLENGE_PATH = '/login/mfa';

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
  const nonce = btoa(crypto.randomUUID()).replace(/=/g, '');
  const isEmbed = /^\/campaigns\/[^/]+\/embed\/?$/.test(path);
  const supabaseOrigin = (() => {
    try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin; } catch { return 'https://*.supabase.co'; }
  })();
  const frameAncestors = isEmbed ? 'frame-ancestors *' : "frame-ancestors 'self'";
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com https://checkout.stripe.com`,
    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://loremflickr.com https://picsum.photos https://fastly.picsum.photos",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin} https://*.supabase.co https://api.stripe.com https://*.stripe.com wss://*.supabase.co`,
    "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com",
    "worker-src 'self' blob:",
    frameAncestors,
  ].join('; ');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-pathname', path);

  // ── Automatic locale detection ─────────────────────────────────────────────
  //
  // `negotiateLocale` already existed but was called from nowhere, so the site
  // could only ever be English until a visitor found the footer picker. This is
  // the wiring that makes detection automatic.
  //
  // An explicit choice (the cookie the picker writes) always wins; otherwise
  // Accept-Language decides — that header IS the operating system's language
  // setting as the browser reports it. Resolved BEFORE render, so the first
  // response is already in the visitor's language: no redirect, no flash of
  // English, no client-side swap.
  //
  // Deliberately not a /de/ URL prefix: every link, canonical URL, sitemap entry
  // and share link in this product is locale-free, and prefixing would rewrite
  // all of them and split each campaign's SEO across eleven paths.
  const storedLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const marketLocale = isSupportedMarketLocale(storedLocale)
    ? resolveMarketLocale(storedLocale)
    : negotiateMarketLocale(request.headers.get('accept-language'));
  requestHeaders.set(LOCALE_HEADER, marketLocale.tag);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);
  const nextResponse = () => NextResponse.next({ request: { headers: requestHeaders } });
  let response = nextResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = nextResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            // Use session cookies so auth is cleared when the browser closes
            response.cookies.set(name, value, toSessionCookie(options))
          );
        },
      },
    }
  );

  const { user, timedOut: authTimedOut } = await getUserWithTimeout(supabase);

  const isProtected =
    PROTECTED.some((p) => path.startsWith(p)) && !PUBLIC_EXCEPTIONS.some((p) => path === p);

  if (isProtected && !user) {
    // Includes the auth-timeout case: deny rather than risk serving a protected
    // page to an unauthenticated visitor because the check could not complete.
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', path);
    return NextResponse.redirect(loginUrl);
  }

  // ── Second-factor gate ───────────────────────────────────────────────
  // Enrolling TOTP previously protected nothing: Supabase issues a password
  // sign-in at aal1, and nothing in the app ever refused an aal1 session, so
  // "Two-Factor Authentication — add an extra layer of security" was decorative
  // and an attacker holding only the password signed in unchallenged.
  //
  // `nextLevel` is 'aal2' ONLY when the user has a verified factor, so accounts
  // without 2FA are never affected by this branch. `/login/mfa` is exempt or the
  // redirect would loop, and a failure to read the level is treated as "do not
  // challenge" so a Supabase hiccup cannot lock people out of their accounts.
  if (isProtected && user && path !== MFA_CHALLENGE_PATH) {
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        const mfaUrl = new URL(MFA_CHALLENGE_PATH, request.url);
        mfaUrl.searchParams.set('next', path);
        return NextResponse.redirect(mfaUrl);
      }
    } catch {
      // Fail open: an unreachable auth service must not bar a signed-in user.
      response.headers.set('X-Mfa-Check', 'error');
    }
  }

  // Surface degraded auth for observability without leaking anything to the page.
  if (authTimedOut) response.headers.set('X-Auth-Refresh', 'timeout');

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
  if (isEmbed) {
    response.headers.set('Content-Security-Policy', contentSecurityPolicy);
    response.headers.delete('X-Frame-Options');
  } else {
    response.headers.set('Content-Security-Policy', contentSecurityPolicy);
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
