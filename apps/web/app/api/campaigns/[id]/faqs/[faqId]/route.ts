import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { createClient } from '../../../../../../lib/supabase-server';

const UpdateSchema = z.object({
  question:  z.string().trim().min(5).max(300).optional(),
  answer:    z.string().trim().min(5).max(2000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isPublic:  z.boolean().optional(),
});

async function verifyCampaignOwner(campaignId: string, userId: string) {
  const { data } = await supabaseAdmin.from('campaigns').select('id').eq('id', campaignId).eq('user_id', userId).single();
  return !!data;
}

// PATCH /api/campaigns/[id]/faqs/[faqId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; faqId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: campaignId, faqId } = await params;
  if (!await verifyCampaignOwner(campaignId, user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (parsed.data.question  !== undefined) updates.question   = parsed.data.question;
  if (parsed.data.answer    !== undefined) updates.answer     = parsed.data.answer;
  if (parsed.data.sortOrder !== undefined) updates.sort_order = parsed.data.sortOrder;
  if (parsed.data.isPublic  !== undefined) updates.is_public  = parsed.data.isPublic;

  const { data, error } = await supabaseAdmin
    .from('campaign_faqs')
    .update(updates)
    .eq('id', faqId)
    .eq('campaign_id', campaignId)
    .select('id, question, answer, sort_order, is_public')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ faq: data });
}

// DELETE /api/campaigns/[id]/faqs/[faqId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; faqId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: campaignId, faqId } = await params;
  if (!await verifyCampaignOwner(campaignId, user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supabaseAdmin
    .from('campaign_faqs')
    .delete()
    .eq('id', faqId)
    .eq('campaign_id', campaignId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
