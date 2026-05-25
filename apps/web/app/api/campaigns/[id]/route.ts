import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

const UpdateSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  tagline: z.string().max(160).optional(),
  description: z.string().min(20).optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
  coverImageUrl: z.string().url().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (campaign.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (parsed.data.title) updates.title = parsed.data.title;
  if (parsed.data.tagline !== undefined) updates.tagline = parsed.data.tagline;
  if (parsed.data.description) updates.description = parsed.data.description;
  if (parsed.data.status) updates.status = parsed.data.status;
  if (parsed.data.coverImageUrl !== undefined) updates.cover_image_url = parsed.data.coverImageUrl;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .update(updates)
    .eq('id', id)
    .select('id, slug')
    .single();

  if (error) {
    console.error('Campaign update failed', error);
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }

  return NextResponse.json(data);
}
