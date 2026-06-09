import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';
import { isSuppressed } from '../../../../../lib/marketing-engine';
import { sendMarketingEmail } from '../../../../../lib/email';

const CampaignSchema = z.object({
  name: z.string().min(1).max(160),
  campaign_type: z.enum(['email', 'sms', 'social', 'multichannel']).default('email'),
  goal: z.string().max(80).optional(),
  segment_id: z.string().uuid().optional().nullable(),
  template_id: z.string().uuid().optional().nullable(),
  subject: z.string().max(200).optional(),
  preview_text: z.string().max(200).optional(),
  body: z.string().max(20000).optional(),
  scheduled_at: z.string().datetime().optional().nullable(),
});

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('marketing_campaigns')
    .select('*, marketing_segments(name, member_count)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = CampaignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid campaign' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('marketing_campaigns')
    .insert({ ...parsed.data, created_by: admin.id, status: parsed.data.scheduled_at ? 'scheduled' : 'draft' })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id, action: 'campaign_created', entity: 'marketing_campaigns', entity_id: data.id,
    detail: { name: data.name, type: data.campaign_type },
  });
  return NextResponse.json({ campaign: data });
}

const ActionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['launch', 'pause', 'archive', 'send_test']),
  testEmail: z.string().email().optional(),
});

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  const { id, action, testEmail } = parsed.data;

  const { data: campaign } = await supabaseAdmin
    .from('marketing_campaigns')
    .select('*')
    .eq('id', id)
    .single();
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  if (action === 'send_test') {
    if (!testEmail) return NextResponse.json({ error: 'testEmail required' }, { status: 400 });
    const result = await sendMarketingEmail({
      to: testEmail,
      subject: `[TEST] ${campaign.subject ?? campaign.name}`,
      text: campaign.body ?? '(no body)',
      previewText: campaign.preview_text,
    });
    return NextResponse.json({ ok: true, sent: result.sent, detail: result.sent ? undefined : 'Email provider not configured — check RESEND_API_KEY' });
  }

  if (action === 'pause') {
    await supabaseAdmin.from('marketing_campaigns').update({ status: 'paused' }).eq('id', id);
    return NextResponse.json({ ok: true, status: 'paused' });
  }
  if (action === 'archive') {
    await supabaseAdmin.from('marketing_campaigns').update({ status: 'archived' }).eq('id', id);
    return NextResponse.json({ ok: true, status: 'archived' });
  }

  // ── launch: materialize recipients from segment, honor suppression ──
  if (!campaign.segment_id) return NextResponse.json({ error: 'Campaign needs a segment before launch' }, { status: 400 });
  const { data: members } = await supabaseAdmin
    .from('marketing_segment_members')
    .select('contact_id, marketing_contacts(id, email, status)')
    .eq('segment_id', campaign.segment_id)
    .limit(5000);

  const SEND_CAP = 200; // per-launch inline cap; larger sends repeat the launch call
  let sent = 0;
  let suppressed = 0;
  let failed = 0;

  for (const m of members ?? []) {
    const contact = m.marketing_contacts as unknown as { id: string; email: string | null; status: string; first_name?: string | null } | null;
    if (!contact?.email || contact.status !== 'active') { suppressed++; continue; }
    if (await isSuppressed(contact.email)) { suppressed++; continue; }
    if (sent >= SEND_CAP) break;

    // Skip recipients already sent in a previous launch of this campaign
    const { data: existing } = await supabaseAdmin
      .from('marketing_campaign_recipients')
      .select('status')
      .eq('campaign_id', id)
      .eq('contact_id', contact.id)
      .maybeSingle();
    if (existing && existing.status !== 'pending') continue;

    const personalized = (campaign.body ?? '')
      .replaceAll('{{first_name}}', contact.first_name || 'friend');
    const result = campaign.campaign_type === 'email'
      ? await sendMarketingEmail({
          to: contact.email,
          subject: (campaign.subject ?? campaign.name).replaceAll('{{first_name}}', contact.first_name || 'friend'),
          text: personalized,
          previewText: campaign.preview_text,
        })
      : { sent: false }; // sms/social rails need provider config — recorded as failed below

    await supabaseAdmin.from('marketing_campaign_recipients').upsert({
      campaign_id: id,
      contact_id: contact.id,
      status: result.sent ? 'sent' : 'bounced',
      sent_at: result.sent ? new Date().toISOString() : null,
    }, { onConflict: 'campaign_id,contact_id' });
    if (result.sent) sent++; else failed++;
  }

  await supabaseAdmin.from('marketing_campaigns').update({
    status: 'sent',
    sent_at: new Date().toISOString(),
    sent_count: (campaign.sent_count ?? 0) + sent,
  }).eq('id', id);
  await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id, action: 'campaign_launched', entity: 'marketing_campaigns', entity_id: id,
    detail: { sent, suppressed, failed },
  });
  return NextResponse.json({
    ok: true, status: 'sent', sent, suppressed, failed,
    detail: failed > 0 && sent === 0 ? 'No emails sent — check RESEND_API_KEY (email) or that the campaign type is email.' : undefined,
  });
}
