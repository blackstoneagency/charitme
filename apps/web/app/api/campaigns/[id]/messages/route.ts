import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { checkRateLimit } from '../../../../../lib/rate-limit';

const Schema = z.object({
  message: z.string().trim().min(1).max(1000),
  anonymous: z.boolean().optional(),
});

// POST /api/campaigns/[id]/messages
// Lets a signed-in user leave a public "words of support" comment on a
// campaign — the same donor_messages wall shown in the Comments section.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!checkRateLimit(`donor-message:${user.id}`, 10, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const { id: campaignId } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { message, anonymous } = parsed.data;

  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('donor_messages')
    .insert({
      campaign_id: campaignId,
      donor_id: user.id,
      message,
      anonymous: !!anonymous,
      visibility: 'public',
    })
    .select('id, message, anonymous, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment: data });
}
