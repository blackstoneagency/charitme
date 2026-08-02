import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { isAdmin } from '../../../../lib/roles';
import {
  NOTE_TARGET_TYPES,
  NOTE_MAX_LENGTH,
  isValidNoteBody,
  sortNotes,
} from '../../../../lib/admin-notes-core';

/**
 * The reader and writer `admin_notes` never had.
 *
 * The table's policy is `admin_notes_admin_all` — `is_admin()` for USING and
 * WITH CHECK — and these handlers use the service-role client, which bypasses
 * it. So `isAdmin()` here is not a fast path in front of the database's
 * decision; it is the decision. Every handler calls it first and returns 401
 * before touching a row.
 */

const TargetSchema = z.object({
  targetType: z.enum(NOTE_TARGET_TYPES),
  targetId: z.string().uuid(),
});

const CreateSchema = TargetSchema.extend({
  body: z.string().min(1).max(NOTE_MAX_LENGTH),
  internal: z.boolean().optional(),
  pinned: z.boolean().optional(),
});

const PatchSchema = z.object({
  id: z.string().uuid(),
  pinned: z.boolean(),
});

const DeleteSchema = z.object({ id: z.string().uuid() });

async function requireAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (!(await isAdmin(user.id, user.email))) return null;
  return user;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await requireAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const parsed = TargetSchema.safeParse({
    targetType: request.nextUrl.searchParams.get('targetType'),
    targetId: request.nextUrl.searchParams.get('targetId'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'targetType and targetId required', code: 'INVALID_INPUT' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('admin_notes')
    .select('id, target_type, target_id, body, internal, pinned, created_at, author_id')
    .eq('target_type', parsed.data.targetType)
    .eq('target_id', parsed.data.targetId)
    .limit(200);
  if (error) {
    console.warn('[admin-notes] read failed', { code: error.code });
    return NextResponse.json({ error: 'Notes unavailable', code: 'READ_FAILED' }, { status: 503 });
  }

  // Author names in one batched lookup rather than one per note.
  const authorIds = [...new Set((data ?? []).map((n) => n.author_id).filter((id): id is string => Boolean(id)))];
  const authors = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', authorIds);
    for (const p of profiles ?? []) {
      authors.set(p.id as string, (p.full_name as string | null) ?? (p.email as string | null) ?? 'Unknown');
    }
  }

  return NextResponse.json({
    notes: sortNotes(data ?? []).map((n) => ({
      ...n,
      // A note whose author was deleted still has to render. "Unknown" is
      // honest; dropping the note would hide a moderation decision.
      authorName: n.author_id ? authors.get(n.author_id) ?? 'Unknown' : 'System',
    })),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await requireAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid note', code: 'INVALID_INPUT' }, { status: 400 });
  }
  if (!isValidNoteBody(parsed.data.body)) {
    return NextResponse.json({ error: 'A note needs a body', code: 'EMPTY_BODY' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('admin_notes')
    .insert({
      target_type: parsed.data.targetType,
      target_id: parsed.data.targetId,
      body: parsed.data.body.trim(),
      // Defaults to internal, matching the column default. A note is private
      // unless someone explicitly says otherwise — the reverse default leaks
      // moderation reasoning to the person being moderated.
      internal: parsed.data.internal ?? true,
      pinned: parsed.data.pinned ?? false,
      author_id: user.id,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[admin-notes] insert failed', { code: error.code });
    return NextResponse.json({ error: 'Could not save', code: 'WRITE_FAILED' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const user = await requireAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'id and pinned required', code: 'INVALID_INPUT' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('admin_notes')
    .update({ pinned: parsed.data.pinned, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id);
  if (error) return NextResponse.json({ error: 'Could not update', code: 'WRITE_FAILED' }, { status: 503 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const user = await requireAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const parsed = DeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'id required', code: 'INVALID_INPUT' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('admin_notes').delete().eq('id', parsed.data.id);
  if (error) return NextResponse.json({ error: 'Could not delete', code: 'WRITE_FAILED' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
