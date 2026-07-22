import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import { trackEvent } from '../../../lib/marketing-engine';
import { getAppOrigin } from '../../../lib/auth-config';
import { appendUtmParams, resolveRedirectUrl } from '../../../lib/click-tracking';

export const dynamic = 'force-dynamic';

const CONTACT_COOKIE = 'cm_cid';
const CONTACT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function noIndexRedirect(url: string): NextResponse {
  const response = NextResponse.redirect(url, 302);
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /go/[code]
//
// Short-link redirect + click tracker for marketing_utm_links:
//   - Unknown code → redirect home (never error out to the visitor).
//   - Appends the link's utm_* params onto the destination (unless already
//     present in the query string).
//   - Increments marketing_utm_links.click_count.
//   - If ?cid=<contact_id> is present: logs a `link_clicked` marketing_event
//     and sets a long-lived cm_cid cookie for follow-on attribution.
//   - If ?cid and ?camp=<marketing_campaign_id> are both present: marks that
//     recipient's row 'clicked' (unless already clicked/converted) and bumps
//     marketing_campaigns.click_count.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const origin = getAppOrigin();

  const { data: link } = await supabaseAdmin
    .from('marketing_utm_links')
    .select('id, destination_url, utm_source, utm_medium, utm_campaign, utm_term, utm_content, click_count')
    .eq('short_code', code)
    .maybeSingle();

  if (!link) {
    return noIndexRedirect(`${origin}/`);
  }

  const url = new URL(request.url);
  const cid = url.searchParams.get('cid');
  const camp = url.searchParams.get('camp');
  const lo = url.searchParams.get('lo');

  const withUtm = appendUtmParams(link.destination_url, {
    source: link.utm_source,
    medium: link.utm_medium,
    campaign: link.utm_campaign,
    term: link.utm_term,
    content: link.utm_content,
  });
  const redirectUrl = resolveRedirectUrl(withUtm, origin);

  await supabaseAdmin
    .from('marketing_utm_links')
    .update({ click_count: (link.click_count ?? 0) + 1 })
    .eq('id', link.id);

  if (cid) {
    await trackEvent({
      contactId: cid,
      eventType: 'link_clicked',
      marketingCampaignId: camp ?? undefined,
      utmSource: link.utm_source,
      utmMedium: link.utm_medium,
      utmCampaign: link.utm_campaign,
      url: redirectUrl,
      metadata: { short_code: code, link_id: link.id },
    });

    if (camp) {
      const { data: recipient } = await supabaseAdmin
        .from('marketing_campaign_recipients')
        .select('status')
        .eq('campaign_id', camp)
        .eq('contact_id', cid)
        .maybeSingle();

      if (recipient && recipient.status !== 'clicked' && recipient.status !== 'converted') {
        await supabaseAdmin
          .from('marketing_campaign_recipients')
          .update({ status: 'clicked', clicked_at: new Date().toISOString() })
          .eq('campaign_id', camp)
          .eq('contact_id', cid);

        const { data: campaign } = await supabaseAdmin
          .from('marketing_campaigns')
          .select('click_count')
          .eq('id', camp)
          .maybeSingle();
        if (campaign) {
          await supabaseAdmin
            .from('marketing_campaigns')
            .update({ click_count: (campaign.click_count ?? 0) + 1 })
            .eq('id', camp);
        }
      }
    }
  }

  // Lead Outreach (Marketing → Outreach): roll the click up onto the per-lead
  // record so the admin funnel shows exactly who clicked their unique link.
  if (lo) {
    const { data: outreach } = await supabaseAdmin
      .from('lead_outreach')
      .select('status, click_count, first_click_at')
      .eq('id', lo)
      .maybeSingle();
    if (outreach) {
      const now = new Date().toISOString();
      await supabaseAdmin
        .from('lead_outreach')
        .update({
          click_count: (outreach.click_count ?? 0) + 1,
          first_click_at: outreach.first_click_at ?? now,
          last_click_at: now,
          status: outreach.status === 'converted' ? 'converted' : 'clicked',
        })
        .eq('id', lo);
    }
  }

  const response = noIndexRedirect(redirectUrl);
  if (cid) {
    response.cookies.set(CONTACT_COOKIE, cid, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: CONTACT_COOKIE_MAX_AGE,
      path: '/',
    });
  }
  return response;
}
