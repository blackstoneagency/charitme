import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { resend } from '../../../lib/email';

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.eli54u.com';
const FROM   = process.env.EMAIL_FROM ?? 'CharitMe <hello@eli54u.com>';

const InviteSchema = z.object({
  campaignId:        z.string().uuid(),
  beneficiaryEmail:  z.string().email(),
  beneficiaryName:   z.string().trim().min(2).max(120),
  message:           z.string().max(500).optional(),
});

// POST /api/beneficiaries — invite a beneficiary to receive payouts for a campaign
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { campaignId, beneficiaryEmail, beneficiaryName, message } = parsed.data;

  // Verify campaign ownership
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug, user_id, beneficiary_name')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  // Get organizer profile
  const { data: organizer } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single();

  const organizerName = (organizer as { full_name: string | null } | null)?.full_name ?? 'The campaign organizer';

  // Generate a secure invite token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  // Store invite in verification_documents as a simple record
  // (A full beneficiary_invites table would be added in a schema migration)
  try {
    await supabaseAdmin
      .from('verification_documents')
      .insert({
        user_id:      user.id,
        campaign_id:  campaignId,
        doc_type:     'legal',
        storage_path: `beneficiary-invites/${token}`,
        notes:        JSON.stringify({
          type:              'beneficiary_invite',
          token,
          beneficiaryEmail,
          beneficiaryName,
          expiresAt,
        }),
        is_public: false,
        verified:  false,
      });
  } catch { /* non-fatal — send email anyway */ }

  // Update campaign with beneficiary name
  await supabaseAdmin
    .from('campaigns')
    .update({ beneficiary_name: beneficiaryName, updated_at: new Date().toISOString() })
    .eq('id', campaignId);

  // Send invite email
  const acceptUrl = `${ORIGIN}/beneficiary/accept?token=${token}&campaign=${campaignId}`;
  const campaignUrl = `${ORIGIN}/campaigns/${campaign.slug}`;

  if (resend) {
    await resend.emails.send({
      from: FROM,
      to: beneficiaryEmail,
      subject: `${organizerName} invited you to receive funds from "${campaign.title}"`,
      html: `<!DOCTYPE html>
<html lang="en">
<body style="font-family:-apple-system,sans-serif;background:#f5f5f7;padding:32px 16px;margin:0">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)">
  <tr><td style="background:linear-gradient(135deg,#6c35ff,#4d1ee0);padding:24px 32px">
    <div style="font-size:22px;font-weight:900;color:#fff">💚 CharitMe</div>
    <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px">Beneficiary Invitation</div>
  </td></tr>
  <tr><td style="padding:28px 32px">
    <p style="font-size:16px;font-weight:700;color:#1a1a2e;margin:0 0 10px">Hi ${beneficiaryName.split(' ')[0]},</p>
    <p style="font-size:14px;color:#64748b;margin:0 0 16px;line-height:1.7">
      <strong style="color:#1a1a2e">${organizerName}</strong> has created a fundraiser called
      <strong style="color:#1a1a2e">"${campaign.title}"</strong> and has invited you to receive
      the funds raised. Once you accept, you'll connect your bank account to receive payouts.
    </p>
    ${message ? `<div style="background:#f7f2ff;border-radius:12px;padding:14px 18px;margin-bottom:16px;font-size:14px;color:#334064;font-style:italic">"${message.replace(/</g,'&lt;')}"</div>` : ''}
    <div style="background:#f0fff8;border-radius:12px;padding:14px 18px;margin-bottom:20px">
      <div style="font-size:12px;color:#065f46;font-weight:700;text-transform:uppercase;margin-bottom:6px">What happens next</div>
      <ul style="font-size:13px;color:#065f46;margin:0;padding:0 0 0 16px;line-height:1.8">
        <li>Click "Accept Invitation" below</li>
        <li>Create or sign in to your CharitMe account</li>
        <li>Connect your bank account via Stripe</li>
        <li>Start receiving payouts when donations come in</li>
      </ul>
    </div>
    <a href="${acceptUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#6c35ff,#4d1ee0);color:#fff;font-size:15px;font-weight:800;padding:16px;border-radius:10px;text-decoration:none;margin-bottom:14px">
      Accept Invitation →
    </a>
    <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0">
      This invitation expires in 7 days. <a href="${campaignUrl}" style="color:#6c35ff">View the campaign</a>
    </p>
  </td></tr>
  <tr><td style="background:#f8f9fc;padding:16px 32px;text-align:center;border-top:1px solid #f0f0f0">
    <p style="font-size:11px;color:#94a3b8;margin:0">© ${new Date().getFullYear()} CharitMe</p>
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`,
      text: `Hi ${beneficiaryName},\n\n${organizerName} invited you to receive funds from "${campaign.title}".\n\nAccept here: ${acceptUrl}\n\nThis link expires in 7 days.\n\n© ${new Date().getFullYear()} CharitMe`,
    }).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    message: `Invitation sent to ${beneficiaryEmail}`,
    expiresAt,
  }, { status: 201 });
}
