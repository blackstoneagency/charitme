import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { getUser } from '../../../../lib/auth';
import { dashboardNavigationFor } from '../../../../lib/persona-navigation';
import { parseNavOverride } from '../../../../lib/nav-customization-core';
import { loadShellSession } from '../../../../lib/shell-session-server';

/**
 * One person's own left-navigation layout.
 *
 * ⚠️ The identity comes from the SESSION, never from the request body. A
 * `user_id` accepted from the client would let anyone rewrite another person's
 * sidebar — the RLS policy on `user_nav_preferences` says "your own row", and
 * this route must not hand `supabaseAdmin` (which bypasses RLS) a different id.
 *
 * ⚠️ Submitted hrefs are filtered against the caller's OWN persona navigation.
 * The composer already refuses to introduce a link, so this is defence in depth
 * rather than the only guard — but it also keeps the stored row meaningful
 * instead of accumulating hrefs that can never match anything.
 */

export const dynamic = 'force-dynamic';

/**
 * The hrefs the CALLER's own persona navigation contains.
 *
 * Via `loadShellSession` rather than a role passed in: it resolves the role from
 * the live session exactly as the shell does, so this filter can never disagree
 * with the sidebar it is filtering for.
 */
async function currentNavHrefs(): Promise<Set<string>> {
  const session = await loadShellSession();
  return new Set(dashboardNavigationFor(session.navRole).map((item) => item.href));
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('user_nav_preferences')
    .select('hidden, item_order')
    .eq('user_id', user.id)
    .maybeSingle();

  // 42P01 = the migration is not applied yet. This repo applies migrations by
  // owner action rather than on deploy, so "no table" must read as "nothing
  // customized" and not as a 500 on a settings screen.
  if (error && error.code !== '42P01') {
    return NextResponse.json({ error: 'Could not load your navigation' }, { status: 500 });
  }

  const row = data as { hidden?: unknown; item_order?: unknown } | null;
  const override = parseNavOverride({ hidden: row?.hidden, order: row?.item_order });
  return NextResponse.json({
    hidden: override.hidden ?? [],
    order: override.order ?? [],
  });
}

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const submitted = parseNavOverride(body);
  const allowed = await currentNavHrefs();
  const hidden = (submitted.hidden ?? []).filter((href) => allowed.has(href));
  const order = (submitted.order ?? []).filter((href) => allowed.has(href));

  // Refuse a layout that would leave no navigation at all. The composer also
  // enforces this, so a stored "hide everything" would render harmlessly — but
  // storing it would still tell the settings screen the user hid everything,
  // which is not what they would then see.
  if (hidden.length >= allowed.size && allowed.size > 0) {
    return NextResponse.json(
      { error: 'At least one navigation item must stay visible' },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin
    .from('user_nav_preferences')
    .upsert(
      { user_id: user.id, hidden, item_order: order, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json(
        { error: 'Navigation preferences are not available yet' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'Could not save your navigation' }, { status: 500 });
  }

  return NextResponse.json({ hidden, order });
}
