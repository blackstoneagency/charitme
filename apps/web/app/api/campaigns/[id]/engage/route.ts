import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { canManageCampaign } from '../../../../../lib/auth';
import { sendMarketingEmail } from '../../../../../lib/email';
import { isSuppressed, resolveContact, trackEvent } from '../../../../../lib/marketing-engine';
import {
  aggregateSupporters,
  filterTargets,
  personalize,
  sendsRemainingToday,
  ORGANIZER_TEMPLATES,
  type DonationRow,
} from '../../../../../lib/organizer-marketing';

const Schema = z.object({
  templateKey: z.enum(['thank_recent', 'update_blast', 'lapsed_nudge', 'monthly_upgrade']),
  targetGroup: z.enum(['recent_donors', 'all_donors', 'lapsed_donors', 'one_time_donors']),
  // Organizers may edit body within limits but the structure stays template-based
  customBody: z.string().max(4000).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { templateKey, targetGroup, customBody } = parsed.data;

  // Ownership
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug, user_id')
    .eq('id', id)
    .single();
  if (!campaign || !(await canManageCampaign(user, campaign.user_id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Daily rate limit per campaign
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const { data: todaySends } = await supabaseAdmin
    .from('organizer_sends')
    .select('created_at')
    .eq('campaign_id', id)
    .gte('created_at', dayStart.toISOString());
  if (sendsRemainingToday((todaySends ?? []).map(s => s.created_at)) <= 0) {
    return NextResponse.json({ error: 'Daily send limit reached for this campaign (2/day). Try again tomorrow.' }, { status: 429 });
  }

  const template = ORGANIZER_TEMPLATES.find(t => t.key === templateKey)!;
  const bodyText = customBody?.trim() || template.body;

  // Build targets from live donations
  const { data: donations } = await supabaseAdmin
    .from('donations')
    .select('donor_id, amount_cents, created_at, anonymous, offline_donor_email, offline_donor_name, profiles:donor_id(email, full_name)')
    .eq('campaign_id', id)
    .eq('status', 'completed')
    .limit(2000);

  const rows: DonationRow[] = (donations ?? []).map((d) => {
    const profile = d.profiles as unknown as { email: string | null; full_name: string | null } | null;
    return {
      donor_id: d.donor_id,
      amount_cents: d.amount_cents,
      created_at: d.created_at,
      anonymous: d.anonymous,
      email: profile?.email ?? d.offline_donor_email ?? null,
      name: profile?.full_name ?? d.offline_donor_name ?? null,
    };
  });
  const targets = filterTargets(aggregateSupporters(rows), targetGroup);
  if (targets.length === 0) {
    return NextResponse.json({ error: 'No reachable donors in that group.' }, { status: 400 });
  }

  const { data: organizerProfile } = await supabaseAdmin
    .from('profiles').select('full_name').eq('id', user.id).single();
  const organizerName = organizerProfile?.full_name ?? 'Your organizer';
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';
  const campaignUrl = `${origin}/campaigns/${campaign.slug}`;

  let sent = 0;
  let suppressed = 0;
  const SEND_CAP = 300;

  for (const t of targets.slice(0, SEND_CAP)) {
    if (!t.email) { suppressed++; continue; }
    if (await isSuppressed(t.email)) { suppressed++; continue; }
    const vars = {
      firstName: t.anonymous ? 'friend' : (t.name.split(' ')[0] || 'friend'),
      campaignTitle: campaign.title,
      campaignUrl,
      organizerName,
    };
    const result = await sendMarketingEmail({
      to: t.email,
      subject: personalize(template.subject, vars),
      text: personalize(bodyText, vars),
      previewText: campaign.title,
    });
    if (result.sent) sent++; else suppressed++;
  }

  const { data: record } = await supabaseAdmin.from('organizer_sends').insert({
    campaign_id: id,
    organizer_id: user.id,
    template_key: templateKey,
    target_group: targetGroup,
    subject: template.subject,
    body: bodyText,
    recipient_count: targets.length,
    sent_count: sent,
    suppressed_count: suppressed,
    status: sent === 0 ? 'failed' : suppressed > 0 ? 'partial' : 'sent',
  }).select('id').single();

  // Feed the marketing event stream (organizer engagement is a strong platform signal)
  try {
    const contactId = await resolveContact({ email: user.email ?? undefined, userId: user.id, clientType: 'organizer' });
    if (contactId) {
      await trackEvent({ contactId, eventType: 'organizer_send', campaignId: id, metadata: { templateKey, targetGroup, sent } });
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({
    ok: true,
    sendId: record?.id,
    sent,
    suppressed,
    detail: sent === 0 ? 'No emails were sent — the email provider may not be configured.' : undefined,
  });
}
