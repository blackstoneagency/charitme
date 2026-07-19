import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { sendCoOrganizerInviteEmail } from '../../../lib/email';

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
    .select('id, title, slug, user_id')
    .eq('id', campaignId)
    .single();

  if (campErr || !campaign) {
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  }
  if ((campaign as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: 'You do not own this campaign.' }, { status: 403 });
  }

  // Find the invitee by email via an indexed profiles lookup (case-insensitive).
  // Escape LIKE wildcards so an email is matched literally. This scales to any
  // user count, unlike listing every auth user (which silently missed users
  // beyond the first page).
  const emailPattern = email.replace(/([\\%_])/g, '\\$1');
  const { data: invitee } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('email', emailPattern)
    .maybeSingle();

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

  // Send co-organizer invite email (non-fatal)
  sendCoOrganizerInviteEmail({
    to: email,
    organizerName: user.email ?? 'The organizer',
    campaignTitle: (campaign as { title: string }).title,
    campaignSlug: (campaign as { slug?: string }).slug ?? campaignId,
    role,
  }).catch(() => {});

  return NextResponse.json({ ok: true, member: data }, { status: 201 });
}
