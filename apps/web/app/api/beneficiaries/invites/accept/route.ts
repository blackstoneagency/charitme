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

  const now = new Date().toISOString();

  // Mark invite as accepted
  await supabaseAdmin.from('beneficiary_invites').update({
    accepted_at: now,
    beneficiary_id: user.id,
  }).eq('id', inv.id);

  // Set user role to include beneficiary
  const { data: profile } = await supabaseAdmin.from('profiles').select('roles').eq('id', user.id).single();
  const currentRoles: string[] = Array.isArray((profile as { roles?: unknown })?.roles) ? (profile as { roles: string[] }).roles : ['donor'];
  if (!currentRoles.includes('beneficiary')) {
    await supabaseAdmin.from('profiles').update({
      roles: [...currentRoles, 'beneficiary'],
    }).eq('id', user.id);
  }

  // Link campaign beneficiary
  await supabaseAdmin.from('campaigns').update({
    beneficiary_profile_id: user.id,
  }).eq('id', inv.campaign_id);

  return NextResponse.json({ ok: true });
}
