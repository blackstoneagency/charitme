import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase-server';
import { MAX_DRAFTS_PER_USER } from '../../../../lib/campaign-draft';
import { CAMPAIGN_BUILDER_SCHEMA_VERSION } from '../../../../lib/campaign-builder-model';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';

export const dynamic = 'force-dynamic';

// Cross-device, multi-draft store for the /create wizard. Deliberately uses the
// anon+cookies server client (NOT supabaseAdmin) so Postgres RLS enforces
// ownership — a user can only ever read or write their own drafts, even if this
// handler has a bug.

const DraftInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
  step: z.string().max(40).default('basics'),
  storyMode: z.string().max(40).default('guided'),
  builderPath: z.enum(['ai', 'guided']).default('guided'),
  schemaVersion: z.number().int().min(1).max(1000).default(CAMPAIGN_BUILDER_SCHEMA_VERSION),
  sourceContext: z.record(z.string(), z.unknown()).default({}),
  form: z.record(z.string(), z.unknown()),
  images: z.array(z.object({
    url: z.string().url().max(2000),
    name: z.string().max(300).default(''),
    storagePath: z.string().max(500).default(''),
  })).max(20).default([]),
  ts: z.number().finite().nonnegative().default(0),
});

// GET          → list the user's drafts (metadata only, newest first)
// GET ?id=<id> → one draft in full
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkRateLimitDurable(`campaign-draft-read:${user.id}`, 120, 60_000))) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const id = req.nextUrl.searchParams.get('id');

  if (id) {
    const { data, error } = await supabase
      .from('campaign_wizard_drafts')
      .select('id, title, step, story_mode, builder_path, schema_version, source_context, form, images, client_ts, updated_at')
      .eq('id', id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
    if (!data) return new NextResponse(null, { status: 204 });
    return NextResponse.json({ draft: data });
  }

  const { data, error } = await supabase
    .from('campaign_wizard_drafts')
    .select('id, title, step, story_mode, builder_path, schema_version, source_context, form, images, client_ts, updated_at')
    .order('updated_at', { ascending: false })
    .limit(MAX_DRAFTS_PER_USER);
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  const drafts = (data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    step: d.step,
    updated_at: d.updated_at,
    client_ts: d.client_ts,
    imageCount: Array.isArray(d.images) ? d.images.length : 0,
  }));

  // The most recent draft comes back in full so a returning organizer can resume
  // in one round-trip; the rest are metadata for the picker.
  const latest = data && data.length > 0 ? data[0] : null;
  return NextResponse.json({ drafts, latest: latest ?? null });
}

// PUT → create or update a draft. Without an id a new draft is created (subject
// to MAX_DRAFTS_PER_USER); with one, that draft is updated in place.
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkRateLimitDurable(`campaign-draft:${user.id}`, 120, 60_000))) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const parsed = DraftInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid draft', issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const derivedTitle = d.title ?? (typeof d.form.title === 'string' ? d.form.title.slice(0, 200) : null);

  const row = {
    user_id: user.id,
    title: derivedTitle,
    step: d.step,
    story_mode: d.storyMode,
    builder_path: d.builderPath,
    schema_version: d.schemaVersion,
    source_context: d.sourceContext,
    form: d.form,
    images: d.images,
    client_ts: Math.round(d.ts),
  };

  if (d.id) {
    // Scoped by user_id as well as id: RLS already enforces this, but making the
    // ownership explicit means a wrong id can never touch another user's row.
    const { data, error } = await supabase
      .from('campaign_wizard_drafts')
      .update(row)
      .eq('id', d.id)
      .eq('user_id', user.id)
      .lte('client_ts', row.client_ts)
      .select('id')
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
    if (data) return NextResponse.json({ ok: true, id: data.id });
    const { data: existing, error: existingError } = await supabase
      .from('campaign_wizard_drafts')
      .select('id, client_ts')
      .eq('id', d.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
    if (existing) return NextResponse.json({ ok: true, id: existing.id, stale: true });
    // Fall through: the id no longer exists (e.g. deleted on another device), so
    // create a fresh draft rather than silently dropping the user's work.
  }

  // Same fail-open shape as the API-key allowance: `count ?? 0` on a failed read
  // is zero, so the cap silently stops applying.
  const { count, error: countError } = await supabase
    .from('campaign_wizard_drafts')
    .select('id', { count: 'exact', head: true });
  if (countError) {
    return NextResponse.json(
      { error: 'We could not check your saved drafts right now. Please try again.', code: 'DRAFT_COUNT_UNAVAILABLE' },
      { status: 503 },
    );
  }
  if ((count ?? 0) >= MAX_DRAFTS_PER_USER) {
    return NextResponse.json(
      { error: `You can keep up to ${MAX_DRAFTS_PER_USER} drafts. Finish or delete one to start another.`, code: 'DRAFT_LIMIT' },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from('campaign_wizard_drafts')
    .insert(row)
    .select('id')
    .single();
  if (error || !data) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}

// DELETE ?id=<id> → remove one draft. Without an id, every draft is left alone
// (deleting everything by accident is far worse than a no-op).
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkRateLimitDurable(`campaign-draft-delete:${user.id}`, 60, 60_000))) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required', code: 'ID_REQUIRED' }, { status: 400 });

  const { error } = await supabase
    .from('campaign_wizard_drafts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
