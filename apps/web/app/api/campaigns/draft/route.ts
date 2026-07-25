import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

// Cross-device draft for the /create wizard. Deliberately uses the anon+cookies
// server client (NOT supabaseAdmin) so Postgres RLS enforces ownership — a user
// can only ever read or write their own row, even if this handler has a bug.

const DraftInput = z.object({
  step: z.string().max(40).default('type'),
  storyMode: z.string().max(40).default('guided'),
  form: z.record(z.unknown()),
  images: z.array(z.object({ url: z.string().url().max(2000), name: z.string().max(300).default('') })).max(20).default([]),
  ts: z.number().finite().nonnegative().default(0),
});

// GET → the signed-in user's saved draft (204 when there isn't one).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('campaign_wizard_drafts')
    .select('step, story_mode, form, images, client_ts, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  if (!data) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ draft: data });
}

// PUT → upsert the draft. Idempotent; one row per user.
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = DraftInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid draft', issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const { error } = await supabase
    .from('campaign_wizard_drafts')
    .upsert({
      user_id: user.id,
      step: d.step,
      story_mode: d.storyMode,
      form: d.form,
      images: d.images,
      client_ts: Math.round(d.ts),
    }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// DELETE → clear the draft once the campaign is created (or the user discards it).
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase.from('campaign_wizard_drafts').delete().eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
