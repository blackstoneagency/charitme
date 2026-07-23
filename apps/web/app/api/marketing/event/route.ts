import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { resolveContact, trackEvent } from '../../../../lib/marketing-engine';
import { createClient } from '../../../../lib/supabase-server';

const EventSchema = z.object({
  visitorId: z.string().uuid().optional(),
  event: z.enum(['page_viewed', 'landing_page_viewed', 'campaign_viewed']).default('page_viewed'),
  url: z.string().max(2000),
  referrer: z.string().max(2000).optional(),
  campaignId: z.string().uuid().optional(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(120).optional(),
  utmTerm: z.string().max(120).optional(),
  utmContent: z.string().max(120).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`mkt-event:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const parsed = EventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid event payload', code: 'INVALID_INPUT' }, { status: 400 });
  }

  const input = parsed.data;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const contactId = await resolveContact({
    anonymousId: input.visitorId,
    userId: user?.id,
    email: user?.email,
    clientType: user ? undefined : 'visitor',
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    landingPage: input.url,
  });

  const recorded = await trackEvent({
    contactId,
    eventType: input.event,
    campaignId: input.campaignId,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    utmTerm: input.utmTerm,
    utmContent: input.utmContent,
    url: input.url,
    metadata: input.referrer ? { referrer: input.referrer } : {},
  });

  if (!recorded) {
    return NextResponse.json({ error: 'Could not record event', code: 'EVENT_WRITE_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
