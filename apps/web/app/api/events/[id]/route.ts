import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { isAdmin } from '../../../../lib/roles';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  status: z.enum(['draft', 'published', 'completed', 'cancelled']).optional(),
  title: z.string().trim().min(4).max(140).optional(),
  location: z.string().trim().max(200).nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

async function loadOwned(id: string, userId: string, email?: string | null) {
  const { data: event } = await supabaseAdmin
    .from('fundraising_events')
    .select('id, campaign_id')
    .eq('id', id)
    .maybeSingle();
  if (!event) return { event: null, allowed: false };
  if (await isAdmin(userId, email)) return { event, allowed: true };
  if (!event.campaign_id) return { event, allowed: false };
  const { data: campaign } = await supabaseAdmin.from('campaigns').select('user_id').eq('id', event.campaign_id).maybeSingle();
  return { event, allowed: campaign?.user_id === userId };
}

// PATCH /api/events/:id — publish/cancel/edit (owner of linked campaign, or admin).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });

  const { event, allowed } = await loadOwned(id, user.id, user.email);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const d = parsed.data;
  const update: Record<string, unknown> = {};
  if (d.status !== undefined) update.status = d.status;
  if (d.title !== undefined) update.title = d.title;
  if (d.location !== undefined) update.location = d.location;
  if (d.startsAt !== undefined) update.starts_at = d.startsAt;
  if (d.endsAt !== undefined) update.ends_at = d.endsAt;

  const { data: updated, error } = await supabaseAdmin
    .from('fundraising_events')
    .update(update)
    .eq('id', id)
    .select('id, title, slug, status, starts_at')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: updated });
}
