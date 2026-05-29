import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

const UpdateSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  tagline: z.string().max(160).nullable().optional(),
  description: z.string().min(20).optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  goalAmount: z.number().int().min(100).optional(),
  deadline: z.string().nullable().optional(),
  category: z.string().optional(),
  beneficiaryName: z.string().max(120).nullable().optional(),
  beneficiaryRelationship: z.string().max(120).nullable().optional(),
  videoUrl: z.string().url().nullable().optional(),
  location: z.string().max(120).nullable().optional(),
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

  const d = parsed.data;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (d.title)                          updates.title = d.title;
  if (d.tagline !== undefined)          updates.tagline = d.tagline;
  if (d.description)                    updates.description = d.description;
  if (d.status)                         updates.status = d.status;
  if (d.coverImageUrl !== undefined)    updates.cover_image_url = d.coverImageUrl;
  if (d.goalAmount !== undefined)       updates.goal_amount = d.goalAmount;
  if (d.deadline !== undefined)         updates.deadline = d.deadline;
  if (d.category)                       updates.category = d.category;
  if (d.beneficiaryName !== undefined)  updates.beneficiary_name = d.beneficiaryName;
  if (d.beneficiaryRelationship !== undefined) updates.beneficiary_relationship = d.beneficiaryRelationship;
  if (d.videoUrl !== undefined)         updates.video_url = d.videoUrl;
  if (d.location !== undefined)         updates.location = d.location;

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .update(updates)
    .eq('id', id)
    .select('id, slug')
    .single();

  if (error) {
    console.error('Campaign update failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json(data);
}
