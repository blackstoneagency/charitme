import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';

const InviteSchema = z.object({
  campaignId: z.string().uuid('Invalid campaign ID'),
  email: z.string().email('Invalid email address').max(180),
  role: z.enum(['admin', 'member', 'viewer']),
});

// POST /api/team-members
// Invite a user to a campaign team by email.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { campaignId, email, role } = parsed.data;

  // Verify the current user owns this campaign
  const { data: campaign, error: campErr } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, user_id')
    .eq('id', campaignId)
    .single();

  if (campErr || !campaign) {
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  }
  if ((campaign as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: 'You do not own this campaign.' }, { status: 403 });
  }

  // Find the user profile by email
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const invitee = authUsers?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!invitee) {
    return NextResponse.json(
      { error: 'No account found with that email address. The user must sign up first.' },
      { status: 404 },
    );
  }

  // Check if already a member
  const { data: existing } = await supabaseAdmin
    .from('team_members')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('user_id', invitee.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'This user is already a team member.' }, { status: 409 });
  }

  // Insert team member
  const { data, error: insertError } = await supabaseAdmin
    .from('team_members')
    .insert({
      campaign_id: campaignId,
      user_id: invitee.id,
      role,
      created_at: new Date().toISOString(),
    })
    .select('id, campaign_id, user_id, role, created_at')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, member: data }, { status: 201 });
}
