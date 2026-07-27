import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { parseBuilderEvent } from '../../../../lib/builder-analytics';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';

// Campaign-builder funnel analytics ingest. Append-only; never blocks the UI, so
// it returns 204 on success and swallows storage errors (analytics must not break
// the wizard). Captures the user id when logged in (guests are anonymous).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = parseBuilderEvent(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Unauthenticated insert, so bound it. This was the ONLY public mutating route
  // in the API without a limit (signout is idempotent; the Stripe webhook must
  // stay unlimited because Stripe retries and a dropped delivery loses a
  // donation — it is protected by signature verification instead).
  //
  // 240/min per IP is deliberately loose: the wizard legitimately fires an event
  // per step and per field interaction, and analytics must never get in a real
  // organizer's way. It still stops an anonymous flood from bloating the table.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!(await checkRateLimitDurable(`builder-analytics:${ip}`, 240, 60_000))) {
    // Analytics is best-effort — drop silently rather than surface an error to a
    // user who is mid-wizard and did nothing wrong.
    return new NextResponse(null, { status: 204 });
  }

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch { /* anon */ }

  try {
    await supabaseAdmin.from('campaign_builder_events').insert({
      session_id: parsed.value.session_id,
      user_id: userId,
      path: parsed.value.path,
      step: parsed.value.step,
      event: parsed.value.event,
      meta: parsed.value.meta,
    });
  } catch { /* analytics is best-effort */ }

  return new NextResponse(null, { status: 204 });
}
