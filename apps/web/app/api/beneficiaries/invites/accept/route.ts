import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';

const Schema = z.object({ token: z.string().min(1) });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const { data: invite } = await supabaseAdmin
    .from('beneficiary_invites')
    .select('id, email, accepted_at, expires_at, campaign_id')
    .eq('token', parsed.data.token)
    .single();

  if (!invite) return NextResponse.json({ error: 'Invalid invite' }, { status: 404 });

  const inv = invite as { id: string; email: string; accepted_at: string | null; expires_at: string; campaign_id: string };

  if (inv.accepted_at) return NextResponse.json({ error: 'Invite already accepted' }, { status: 409 });
  if (new Date(inv.expires_at) < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 410 });

  // The invite names an email, and the accept screen shows it — "this invite is
  // for <email>". Nothing enforced that: the address was selected and then never
  // compared, so ANY signed-in user holding the token could accept an invite
  // addressed to someone else and be written onto the campaign as its
  // beneficiary. The token is emailed, but tokens get forwarded and links get
  // shared, and possession of a link is not identity.
  //
  // The error names the expected address, because the legitimate way to hit this
  // is signing up with a different address than the organizer invited.
  if (inv.email.trim().toLowerCase() !== (user.email ?? '').trim().toLowerCase()) {
    return NextResponse.json(
      {
        error: `This invite was sent to ${inv.email}. Sign in with that address to accept it.`,
        code: 'INVITE_EMAIL_MISMATCH',
      },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();

  // Mark invite as accepted
  const { error: inviteErr } = await supabaseAdmin.from('beneficiary_invites').update({
    accepted_at: now,
    beneficiary_id: user.id,
  }).eq('id', inv.id);
  if (inviteErr) {
    return NextResponse.json(
      { error: 'Could not accept the invite. Please try again.', code: 'INVITE_ACCEPT_FAILED' },
      { status: 500 },
    );
  }

  // Set user role to include beneficiary
  const { data: profile } = await supabaseAdmin.from('profiles').select('roles').eq('id', user.id).single();
  const currentRoles: string[] = Array.isArray((profile as { roles?: unknown })?.roles) ? (profile as { roles: string[] }).roles : ['donor'];
  if (!currentRoles.includes('beneficiary')) {
    // Logged, not fatal: nothing in the app currently branches on the
    // `beneficiary` role — access comes from `campaigns.beneficiary_profile_id`
    // below — so losing this costs a label, not the entitlement.
    const { error: roleErr } = await supabaseAdmin.from('profiles').update({
      roles: [...currentRoles, 'beneficiary'],
    }).eq('id', user.id);
    if (roleErr) {
      console.error('[beneficiaries/accept] role update failed', { user_id: user.id, message: roleErr.message });
    }
  }

  // Link campaign beneficiary. This is the write that actually makes someone a
  // beneficiary — the role above only decorates the profile. If it fails
  // silently the user still sees "You're set as a beneficiary!" while the
  // campaign has no beneficiary at all, and the invite is already marked
  // accepted so they cannot retry.
  const { error: linkErr } = await supabaseAdmin.from('campaigns').update({
    beneficiary_profile_id: user.id,
  }).eq('id', inv.campaign_id);
  if (linkErr) {
    console.error('[beneficiaries/accept] campaign link failed', {
      campaign_id: inv.campaign_id,
      beneficiary_id: user.id,
      invite_id: inv.id,
      message: linkErr.message,
    });
    return NextResponse.json(
      { error: 'Could not link you to the fundraiser. Please contact support.', code: 'BENEFICIARY_LINK_FAILED' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
