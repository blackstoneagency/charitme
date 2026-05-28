import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).campaignId !== 'string' ||
    typeof (body as Record<string, unknown>).message !== 'string'
  ) {
    return NextResponse.json({ error: 'campaignId and message are required' }, { status: 400 });
  }

  const { campaignId, donorMessageId, message } = body as {
    campaignId: string;
    donorMessageId?: string;
    message: string;
  };

  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 5000) {
    return NextResponse.json(
      { error: 'Message must be between 1 and 5000 characters' },
      { status: 400 },
    );
  }

  // Verify the user owns this campaign
  const { data: campaign, error: campErr } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single();

  if (campErr || !campaign) {
    return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 404 });
  }

  // If donorMessageId is provided, verify it belongs to this campaign
  if (donorMessageId) {
    const { data: dm } = await supabaseAdmin
      .from('donor_messages')
      .select('id')
      .eq('id', donorMessageId)
      .eq('campaign_id', campaignId)
      .single();

    if (!dm) {
      return NextResponse.json(
        { error: 'Donor message not found in this campaign' },
        { status: 404 },
      );
    }
  }

  const { data: reply, error: insertErr } = await supabaseAdmin
    .from('campaign_owner_replies')
    .insert({
      campaign_id: campaignId,
      donor_message_id: donorMessageId ?? null,
      owner_id: user.id,
      message: trimmed,
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reply });
}
