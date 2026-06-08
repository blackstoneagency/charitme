import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { resend } from '../../../../lib/email';

const FROM = process.env.EMAIL_FROM ?? 'CharitMe <hello@charitme.com>';
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const inviteRow = invite as { id: string; token: string };
  const acceptUrl = `${ORIGIN}/beneficiary/accept?token=${inviteRow.token}`;

  // Send invite email
  if (resend) {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `You've been invited as a beneficiary — ${campaign.title}`,
      html: `<p>You've been invited to be the beneficiary of a CharitMe fundraiser: <strong>${campaign.title}</strong>.</p>
<p><a href="${acceptUrl}" style="background:#6c35ff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Accept Invitation</a></p>
<p>This link expires in 7 days.</p>`,
      text: `You've been invited as the beneficiary of "${campaign.title}".\n\nAccept here: ${acceptUrl}\n\nThis link expires in 7 days.`,
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, inviteId: inviteRow.id });
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
