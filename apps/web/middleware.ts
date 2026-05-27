import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from './lib/auth-config';

const PROTECTED = ['/create', '/dashboard', '/profile', '/admin', '/campaigns'];
type CookieToSet = { name: string; value: string; options: CookieOptions };

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
            response.cookies.set(name, value, options)
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

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
