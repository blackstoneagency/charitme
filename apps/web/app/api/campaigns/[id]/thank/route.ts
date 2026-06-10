import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { canManageCampaign } from '../../../../../lib/auth';
import { resend } from '../../../../../lib/email';

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';
const FROM = process.env.EMAIL_FROM ?? 'CharitMe <hello@charitme.com>';

const Schema = z.object({
  message: z.string().trim().min(10).max(2000),
  donationIds: z.array(z.string().uuid()).min(1).max(100).optional(),
  // if donationIds is omitted, send to ALL donors on this campaign
});

// POST /api/campaigns/[id]/thank
// Sends a personalised thank-you email from the organiser to donors.
// Rate: max 100 per call; enforced by Zod above + send in batch.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: campaignId } = await params;

  // ── Verify campaign ownership (owner or platform admin) ──────────────────
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug, user_id')
    .eq('id', campaignId)
    .single();

  if (!campaign || !(await canManageCampaign(user, campaign.user_id))) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { message, donationIds } = parsed.data;

  // ── Fetch organiser profile ───────────────────────────────────────────────
  const { data: organiser } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();
  const organiserName = (organiser as { full_name: string | null } | null)?.full_name ?? 'The organiser';

  // ── Fetch donation + donor records ───────────────────────────────────────
  let query = supabaseAdmin
    .from('donations')
    .select('id, donor_id, amount_cents, anonymous, message')
    .eq('campaign_id', campaignId)
    .eq('status', 'completed')
    .eq('anonymous', false);

  if (donationIds && donationIds.length > 0) {
    query = query.in('id', donationIds);
  } else {
    query = query.limit(100);
  }

  const { data: donations } = await query;

  if (!donations || donations.length === 0) {
    return NextResponse.json({ error: 'No eligible donations found', sent: 0 }, { status: 400 });
  }

  // Resolve donor profiles
  const donorIds = [...new Set(
    (donations as { donor_id: string | null }[])
      .map(d => d.donor_id)
      .filter((id): id is string => !!id),
  )];

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', donorIds);

  type ProfileRow = { id: string; full_name: string | null; email: string | null };
  const profileMap = new Map<string, ProfileRow>(
    ((profiles ?? []) as ProfileRow[]).map(p => [p.id, p]),
  );

  // ── Send thank-you emails ─────────────────────────────────────────────────
  if (!resend) {
    return NextResponse.json({ error: 'Email service not configured. Set RESEND_API_KEY.', sent: 0 }, { status: 503 });
  }

  const campaignUrl = `${ORIGIN}/campaigns/${campaign.slug}`;
  const year = new Date().getFullYear();
  let sent = 0;
  const failed: string[] = [];

  for (const donation of donations as { id: string; donor_id: string | null; amount_cents: number }[]) {
    if (!donation.donor_id) continue;
    const profile = profileMap.get(donation.donor_id);
    if (!profile?.email) continue;

    const donorFirstName = profile.full_name?.split(' ')[0] ?? 'Friend';
    const donatedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(donation.amount_cents / 100);

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>A thank-you from ${organiserName}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7;padding:32px 16px;margin:0">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#6c35ff,#4d1ee0);padding:28px 32px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:#fff">💚 CharitMe</div>
        <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px">Personal thank-you from ${organiserName.replace(/</g, '&lt;')}</div>
      </td></tr>
      <tr><td style="padding:32px">
        <p style="font-size:16px;font-weight:700;color:#1a1a2e;margin:0 0 12px">Dear ${donorFirstName.replace(/</g, '&lt;')},</p>
        <p style="font-size:14px;color:#64748b;line-height:1.7;margin:0 0 20px">${message.replace(/\n/g, '<br>').replace(/</g, '&lt;')}</p>
        <div style="background:#f7f2ff;border-radius:12px;padding:16px 20px;margin-bottom:20px">
          <div style="font-size:12px;color:#8c73cc;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Your donation</div>
          <div style="font-size:28px;font-weight:900;color:#4d1ee0;margin-top:4px">${donatedAmount}</div>
          <div style="font-size:13px;color:#64748b;margin-top:4px">to ${campaign.title.replace(/</g, '&lt;')}</div>
        </div>
        <a href="${campaignUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#6c35ff,#4d1ee0);color:#fff;font-size:14px;font-weight:700;padding:14px;border-radius:10px;text-decoration:none">View Campaign Updates</a>
      </td></tr>
      <tr><td style="background:#f8f9fc;padding:16px 32px;text-align:center;border-top:1px solid #f0f0f0">
        <p style="font-size:11px;color:#94a3b8;margin:0">© ${year} CharitMe · <a href="${ORIGIN}" style="color:#94a3b8">${ORIGIN.replace('https://', '')}</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

    try {
      await resend.emails.send({
        from: FROM,
        to: profile.email,
        subject: `A thank-you from ${organiserName} 💚`,
        html,
        text: `Dear ${donorFirstName},\n\n${message}\n\nView campaign: ${campaignUrl}\n\n© ${year} CharitMe`,
      });
      sent++;
    } catch {
      failed.push(donation.id);
    }
  }

  return NextResponse.json({ ok: true, sent, failed: failed.length });
}

// GET /api/campaigns/[id]/thank
// Lists thankable (completed, non-anonymous) donations with donor names —
// powers the Thank Donors panel for both organizers and admins.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: campaignId } = await params;

  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug, user_id')
    .eq('id', campaignId)
    .single();

  if (!campaign || !(await canManageCampaign(user, campaign.user_id))) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const { data: donations } = await supabaseAdmin
    .from('donations')
    .select('id, amount_cents, created_at, anonymous, donor_id')
    .eq('campaign_id', campaignId)
    .eq('status', 'completed')
    .eq('anonymous', false)
    .order('created_at', { ascending: false })
    .limit(200);

  const donList = (donations ?? []) as { id: string; amount_cents: number; created_at: string; anonymous: boolean; donor_id: string | null }[];
  const donorIds = [...new Set(donList.map(d => d.donor_id).filter((x): x is string => !!x))];

  const profileMap = new Map<string, string>();
  if (donorIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', donorIds);
    for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) {
      profileMap.set(p.id, p.full_name ?? 'Donor');
    }
  }

  return NextResponse.json({
    campaign: { id: campaign.id, title: campaign.title, slug: campaign.slug },
    donations: donList.map(d => ({
      ...d,
      donor_name: d.donor_id ? (profileMap.get(d.donor_id) ?? 'Donor') : 'Donor',
    })),
  });
}
