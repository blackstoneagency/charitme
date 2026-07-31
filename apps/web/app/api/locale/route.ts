import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import {
  LOCALE_COOKIE,
  findMarketLocale,
  normalizeLocale,
  resolveMarketLocale,
} from '../../../lib/i18n';

// ─────────────────────────────────────────────────────────────────────────────
// Locale selection from the global footer picker.
//
// Two storage tiers, deliberately:
//   • a cookie, so an anonymous visitor's choice survives navigation and is
//     readable during SSR (localStorage is not);
//   • `profiles.locale` + `profiles.language` for signed-in users, so the choice
//     follows them across devices.
//
// The cookie is set in BOTH cases. A signed-in user whose session later expires
// should not silently revert to English mid-visit.
// ─────────────────────────────────────────────────────────────────────────────

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** PostgREST schema-cache miss / PostgreSQL undefined_column. */
function isMissingColumn(err: { code?: string; message?: string } | null): boolean {
  return err != null && (err.code === 'PGRST204' || err.code === '42703');
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ locale: null });

  const { data, error } = await supabaseAdmin
    .from('profiles').select('locale, language').eq('id', user.id).maybeSingle();

  // The `locale` column is optional until the migration lands; fall back to the
  // language column rather than reporting a failure the user cannot act on.
  if (error && !isMissingColumn(error)) {
    const { data: fallback } = await supabaseAdmin
      .from('profiles').select('language').eq('id', user.id).maybeSingle();
    return NextResponse.json({ locale: resolveMarketLocale(fallback?.language).tag });
  }

  const stored = (data as { locale?: string | null; language?: string | null } | null);
  return NextResponse.json({ locale: resolveMarketLocale(stored?.locale ?? stored?.language).tag });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const requested = (body as { locale?: unknown } | null)?.locale;

  // Only an exact, known market tag is accepted. Anything else is a 400 rather
  // than a silent coercion to English — a picker that appears to accept a choice
  // and then shows a different one is worse than a visible error.
  if (typeof requested !== 'string' || !findMarketLocale(requested)) {
    return NextResponse.json(
      { error: 'Unsupported locale', code: 'UNSUPPORTED_LOCALE' },
      { status: 400 },
    );
  }
  const locale = findMarketLocale(requested)!;

  const response = NextResponse.json({ locale: locale.tag, persisted: 'cookie' });
  response.cookies.set(LOCALE_COOKIE, locale.tag, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    httpOnly: false, // read by the client picker on hydration
    secure: process.env.NODE_ENV === 'production',
  });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return response;

  // Write the full tag and the primary subtag together. `language` is what the
  // dashboard settings dropdown and /api/settings validate against, so leaving
  // it stale would make the two screens disagree about the same person.
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ locale: locale.tag, language: normalizeLocale(locale.language) })
    .eq('id', user.id);

  if (!error) {
    return NextResponse.json({ locale: locale.tag, persisted: 'profile' }, { headers: response.headers });
  }

  if (isMissingColumn(error)) {
    // Migration 20260809000000 not applied yet — still persist what we can.
    const { error: langError } = await supabaseAdmin
      .from('profiles')
      .update({ language: normalizeLocale(locale.language) })
      .eq('id', user.id);
    if (!langError) {
      return NextResponse.json({ locale: locale.tag, persisted: 'language' }, { headers: response.headers });
    }
  }

  // The cookie is already set, so the choice holds for this browser. Say so
  // instead of reporting a flat success that overstates what was saved — this
  // is the write-failure-reported-as-success class the tracker keeps finding.
  return NextResponse.json(
    { locale: locale.tag, persisted: 'cookie', warning: 'Saved for this browser only.' },
    { status: 200, headers: response.headers },
  );
}
