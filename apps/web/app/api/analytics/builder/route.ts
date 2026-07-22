import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { parseBuilderEvent } from '../../../../lib/builder-analytics';

// Campaign-builder funnel analytics ingest. Append-only; never blocks the UI, so
// it returns 204 on success and swallows storage errors (analytics must not break
// the wizard). Captures the user id when logged in (guests are anonymous).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = parseBuilderEvent(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
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
