import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { formatMoneyShort } from '@shared/currencies';

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';

// GET /api/campaigns/[id]/qr-poster
// Returns an SVG/HTML poster page suitable for printing that includes
// the campaign title, QR code, and call-to-action.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug, tagline, raised_amount, goal_amount, cover_image_url')
    .eq('id', id)
    .eq('status', 'active')
    .single();

  if (!campaign) {
    return new NextResponse('Campaign not found', { status: 404 });
  }

  const { data: launchSettings } = await supabaseAdmin
    .from('campaign_launch_settings')
    .select('currency')
    .eq('campaign_id', campaign.id)
    .maybeSingle();
  const currency = launchSettings?.currency ?? 'usd';

  const campaignUrl = `${ORIGIN}/campaigns/${campaign.slug}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(campaignUrl)}&color=6c35ff&bgcolor=ffffff&margin=12`;
  const pct = campaign.goal_amount > 0
    ? Math.min(100, Math.round((campaign.raised_amount / campaign.goal_amount) * 100))
    : 0;
  const raised = formatMoneyShort(campaign.raised_amount, currency);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Donate to ${campaign.title} — CharitMe</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: letter portrait; margin: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #fff;
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh; padding: 40px 24px;
    }
    .poster {
      width: 500px; max-width: 100%;
      border: 2px solid #e0d5ff; border-radius: 24px;
      overflow: hidden; box-shadow: 0 8px 40px rgba(108,53,255,.12);
    }
    .poster-header {
      background: linear-gradient(135deg, #6c35ff, #4d1ee0);
      padding: 24px 28px 20px;
      color: #fff;
    }
    .poster-logo { font-size: 20px; font-weight: 900; letter-spacing: -.03em; margin-bottom: 12px; }
    .poster-title { font-size: 22px; font-weight: 800; line-height: 1.25; }
    .poster-tagline { font-size: 14px; opacity: .85; margin-top: 6px; }
    .poster-body { padding: 24px 28px; display: flex; flex-direction: column; align-items: center; gap: 20px; }
    .poster-qr { border: 3px solid #6c35ff; border-radius: 16px; overflow: hidden; }
    .poster-raised { font-size: 28px; font-weight: 900; color: #6c35ff; text-align: center; }
    .poster-raised small { font-size: 14px; color: #64748b; font-weight: 600; display: block; margin-top: 4px; }
    .progress { width: 100%; height: 10px; background: #e0d5ff; border-radius: 5px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #6c35ff, #ec3fb4); border-radius: 5px; }
    .poster-url { font-size: 13px; color: #4d1ee0; font-weight: 700; word-break: break-all; text-align: center; }
    .poster-cta {
      background: linear-gradient(135deg, #6c35ff, #4d1ee0);
      color: #fff; font-size: 17px; font-weight: 900;
      padding: 14px 32px; border-radius: 12px; text-align: center;
      width: 100%;
    }
    .poster-footer { font-size: 11px; color: #94a3b8; text-align: center; padding-bottom: 8px; }
    @media print {
      body { padding: 0; min-height: 0; }
      .poster { border-radius: 0; box-shadow: none; border: none; width: 100%; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="poster">
    <div class="poster-header">
      <div class="poster-logo">💜 CharitMe</div>
      <div class="poster-title">${campaign.title.replace(/</g, '&lt;')}</div>
      ${campaign.tagline ? `<div class="poster-tagline">${campaign.tagline.replace(/</g, '&lt;')}</div>` : ''}
    </div>
    <div class="poster-body">
      <img src="${qrApiUrl}" width="200" height="200" class="poster-qr" alt="Scan to donate" />
      <div class="poster-raised">
        ${raised} raised
        <small>${pct}% of goal</small>
      </div>
      <div class="progress" style="width:100%;max-width:300px">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="poster-url">📱 Scan QR or visit:<br>${campaignUrl}</div>
      <div class="poster-cta">Scan to Donate Now</div>
      <div class="poster-footer">Powered by CharitMe · 0% mandatory platform fee</div>
    </div>
  </div>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 800));</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
