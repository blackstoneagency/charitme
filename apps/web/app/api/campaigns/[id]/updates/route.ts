import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { canManageCampaign } from '../../../../../lib/auth';
import { resend } from '../../../../../lib/email';

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';
const FROM   = process.env.EMAIL_FROM ?? 'CharitMe <hello@charitme.com>';

const Schema = z.object({
  title:        z.string().max(200).optional(),
  body:         z.string().trim().min(10).max(10000),
  aiGenerated:  z.boolean().optional(),
  notifyDonors: z.boolean().default(true),
  scheduledAt:  z.string().datetime().nullable().optional(), // ISO datetime — null = publish now
});

// POST /api/campaigns/[id]/updates
// Creates a campaign update and optionally emails all donors who opted in.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: campaignId } = await params;

  // Verify ownership (campaign owner or platform admin)
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug, user_id')
    .eq('id', campaignId)
    .single();

  if (!campaign || !(await canManageCampaign(user, campaign.user_id))) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { title, body: updateBody, aiGenerated, notifyDonors, scheduledAt } = parsed.data;
  const isScheduled = Boolean(scheduledAt && new Date(scheduledAt) > new Date());

  // Insert the update
  const { data: update, error: insertErr } = await supabaseAdmin
    .from('campaign_updates')
    .insert({
      campaign_id:  campaignId,
      user_id:      user.id,
      title:        title?.trim() || null,
      body:         updateBody,
      ai_generated: aiGenerated ?? false,
      // Only set published_at if publishing now (not scheduled)
      published_at: isScheduled ? null : new Date().toISOString(),
      scheduled_at: isScheduled ? scheduledAt : null,
    })
    .select('id, title, body, created_at, scheduled_at')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // If scheduled, return early — emails sent when cron/scheduler publishes it
  if (isScheduled) {
    return NextResponse.json({ ok: true, update, scheduled: true, scheduledAt }, { status: 201 });
  }

  // Email donors immediately (fire-and-forget — non-blocking)
  if (notifyDonors && resend) {
    void (async () => {
      try {
        // Notify everyone who supported or saved this campaign — non-anonymous
        // donors plus anyone who saved/followed it for updates.
        const [{ data: donations }, { data: savers }] = await Promise.all([
          supabaseAdmin
            .from('donations')
            .select('donor_id')
            .eq('campaign_id', campaignId)
            .eq('status', 'completed')
            .eq('anonymous', false)
            .not('donor_id', 'is', null),
          supabaseAdmin
            .from('saved_campaigns')
            .select('user_id')
            .eq('campaign_id', campaignId),
        ]);

        const donorIds = [...new Set([
          ...(donations ?? []).map(d => (d as { donor_id: string }).donor_id).filter(Boolean),
          ...(savers ?? []).map(s => (s as { user_id: string }).user_id).filter(Boolean),
        ])];
        if (donorIds.length === 0) return;

        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id, email, full_name, notification_updates')
          .in('id', donorIds);

        const campaignUrl = `${ORIGIN}/campaigns/${campaign.slug}`;
        const updateTitle = title?.trim() || `Update from ${campaign.title}`;
        const year = new Date().getFullYear();

        for (const profile of (profiles ?? []) as { id: string; email: string | null; full_name: string | null; notification_updates: boolean | null }[]) {
          if (!profile.email) continue;
          if (profile.notification_updates === false) continue; // donor opted out of campaign update emails
          const firstName = profile.full_name?.split(' ')[0] ?? 'Supporter';

          await resend.emails.send({
            from: FROM,
            to: profile.email,
            subject: `${updateTitle} — ${campaign.title}`,
            html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,sans-serif;background:#f5f5f7;padding:32px 16px;margin:0">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#6c35ff,#4d1ee0);padding:24px 32px">
        <div style="font-size:22px;font-weight:900;color:#fff">💚 CharitMe</div>
        <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px">Campaign Update</div>
      </td></tr>
      <tr><td style="padding:28px 32px">
        <p style="font-size:15px;font-weight:700;color:#1a1a2e;margin:0 0 6px">Hi ${firstName},</p>
        <p style="font-size:14px;color:#64748b;margin:0 0 20px">There&apos;s a new update from <strong style="color:#1a1a2e">${campaign.title}</strong>.</p>
        <div style="background:#f7f2ff;border-radius:12px;padding:18px 22px;margin-bottom:20px">
          ${title ? `<h2 style="font-size:16px;font-weight:900;color:#4d1ee0;margin:0 0 10px">${title.replace(/</g,'&lt;')}</h2>` : ''}
          <div style="font-size:14px;color:#334064;line-height:1.7;white-space:pre-wrap">${updateBody.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>
        </div>
        <a href="${campaignUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#6c35ff,#4d1ee0);color:#fff;font-size:14px;font-weight:700;padding:14px;border-radius:10px;text-decoration:none">View Campaign Updates</a>
      </td></tr>
      <tr><td style="background:#f8f9fc;padding:16px 32px;text-align:center;border-top:1px solid #f0f0f0">
        <p style="font-size:11px;color:#94a3b8;margin:0">© ${year} CharitMe · <a href="${ORIGIN}/profile" style="color:#94a3b8">Manage email preferences</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`,
            text: `Hi ${firstName},\n\nNew update from "${campaign.title}":\n\n${title ? `${title}\n\n` : ''}${updateBody}\n\nView campaign: ${campaignUrl}\n\n© ${year} CharitMe`,
          }).catch(() => undefined); // silent per-email failure
        }
      } catch { /* silent — email send failure must not affect response */ }
    })();
  }

  return NextResponse.json({ ok: true, update }, { status: 201 });
}

// GET /api/campaigns/[id]/updates — public read
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;

  const { data, error } = await supabaseAdmin
    .from('campaign_updates')
    .select('id, title, body, ai_generated, created_at, published_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ updates: data ?? [] });
}
