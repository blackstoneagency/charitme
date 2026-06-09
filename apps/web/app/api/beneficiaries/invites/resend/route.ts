import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { sendBeneficiaryInviteEmail } from '../../../../../lib/email';

const Schema = z.object({ inviteId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'inviteId required' }, { status: 400 });

  const { data: invite } = await supabaseAdmin
    .from('beneficiary_invites')
    .select('id, email, token, accepted_at, expires_at, campaign_id, campaigns:campaign_id(title, slug, user_id)')
    .eq('id', parsed.data.inviteId)
    .single();

  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });

  type InviteRow = { id: string; email: string; token: string; accepted_at: string | null; expires_at: string; campaign_id: string; campaigns: { title: string; slug: string; user_id: string } | null };
  const inv = invite as unknown as InviteRow;

  // Only the campaign owner can resend
  const camp = inv.campaigns;
  if (!camp || camp.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (inv.accepted_at) {
    return NextResponse.json({ error: 'Invite already accepted' }, { status: 409 });
  }

  // Extend expiry by 7 days from now
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin.from('beneficiary_invites').update({ expires_at: newExpiry }).eq('id', inv.id);

  // Send invite email
  const { data: organizer } = await supabaseAdmin.from('profiles').select('full_name').eq('id', user.id).single();
  await sendBeneficiaryInviteEmail({
    to: inv.email,
    organizerName: organizer?.full_name ?? 'Your fundraiser organizer',
    campaignTitle: camp.title,
    campaignSlug: camp.slug,
    inviteToken: inv.token,
  }).catch(() => {});

  return NextResponse.json({ ok: true, expiresAt: newExpiry });
}
