import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { guardSuperAdmin, logSuperAdminAction } from '../../../../../lib/super-admin';

const CreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().max(1000).optional().nullable(),
  level: z.enum(['info', 'success', 'warning', 'critical']).default('info'),
  link_url: z.string().trim().max(400).optional().nullable(),
  link_label: z.string().trim().max(80).optional().nullable(),
  active: z.boolean().default(false),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
});
const UpdateSchema = CreateSchema.partial().extend({ id: z.string().uuid() });

export async function POST(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .insert({ ...parsed.data, created_by: guard.user.id })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  await logSuperAdminAction(guard.user.id, 'announcement.create', 'announcements', data.id, {});
  return NextResponse.json({ ok: true, row: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const { id, ...patch } = parsed.data;
  const { data, error } = await supabaseAdmin.from('announcements').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  await logSuperAdminAction(guard.user.id, 'announcement.update', 'announcements', id, {});
  return NextResponse.json({ ok: true, row: data });
}

export async function DELETE(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const { error } = await supabaseAdmin.from('announcements').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  await logSuperAdminAction(guard.user.id, 'announcement.delete', 'announcements', id, {});
  return NextResponse.json({ ok: true });
}
