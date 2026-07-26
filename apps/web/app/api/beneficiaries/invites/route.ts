import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { sendBeneficiaryInviteEmail } from '../../../../lib/email';

const InviteSchema = z.object({
  campaignId: z.string().uuid(),
  email: z.string().email(),
});

// POST /api/beneficiaries/invites — create and send a beneficiary invite
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { campaignId, email } = parsed.data;

  // Verify the user owns this campaign
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug, user_id')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Campaign not found or not owned by you' }, { status: 404 });

  // Create invite
  const { data: invite, error } = await supabaseAdmin
    .from('beneficiary_invites')
    .insert({ campaign_id: campaignId, invited_by: user.id, email })
    .select('id, token')
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  const inviteRow = invite as { id: string; token: string };

  // Get organizer name
  const { data: organizer } = await supabaseAdmin.from('profiles').select('full_name').eq('id', user.id).single();

  // Send invite email using the proper template
  // The invite row is the real artifact — its token stays valid whether or not the
  // email goes out, so a failed send is not a failed request. But it must be
  // REPORTED, otherwise the organizer is told an invite was delivered to someone
  // who will never hear about it. `emailed` lets the UI offer the link instead.
  const { sent: emailed } = await sendBeneficiaryInviteEmail({
    to: email,
    organizerName: organizer?.full_name ?? 'Your fundraiser organizer',
    campaignTitle: campaign.title,
    campaignSlug: campaign.slug,
    inviteToken: inviteRow.token,
  }).catch(() => ({ sent: false }));

  return NextResponse.json({ ok: true, inviteId: inviteRow.id, emailed });
}

// GET /api/beneficiaries/invites?token=... — look up invite by token (for accept flow)
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const { data: invite } = await supabaseAdmin
    .from('beneficiary_invites')
    .select('id, campaign_id, email, accepted_at, expires_at, campaigns:campaign_id(title, slug)')
    .eq('token', token)
    .single();

  if (!invite) return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });

  const inv = invite as unknown as { id: string; expires_at: string; accepted_at: string | null; email: string; campaign_id: string; campaigns: { title: string; slug: string } };

  if (new Date(inv.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 410 });
  }

  return NextResponse.json({ invite: inv });
}
