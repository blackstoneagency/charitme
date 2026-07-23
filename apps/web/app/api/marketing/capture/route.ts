import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { resolveContact, trackEvent, refreshContactScores } from '../../../../lib/marketing-engine';
import { supabaseAdmin } from '../../../../lib/supabase';

const CaptureSchema = z.object({
  email: z.string().email().max(254).optional(),
  phone: z.string().max(32).optional(),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  clientType: z.enum(['visitor', 'newsletter', 'lead', 'support', 'donor', 'organizer', 'beneficiary', 'nonprofit']).optional(),
  country: z.string().max(80).optional(),
  formId: z.string().uuid().optional(),
  event: z.string().max(64).optional(),          // e.g. form_submitted, newsletter_signup, popup_converted
  campaignId: z.string().uuid().optional(),
  url: z.string().max(2000).optional(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(120).optional(),
  consentEmail: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`mkt-capture:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CaptureSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const input = parsed.data;

  if (!input.email && !input.phone) {
    return NextResponse.json({ error: 'email or phone required' }, { status: 400 });
  }

  const contactId = await resolveContact({
    email: input.email,
    phone: input.phone,
    firstName: input.firstName,
    lastName: input.lastName,
    clientType: input.clientType,
    country: input.country,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    landingPage: input.url,
    consentEmail: input.consentEmail,
    consentSource: input.formId ? 'form' : 'capture',
  });
  if (!contactId) return NextResponse.json({ error: 'Could not create contact' }, { status: 500 });

  const recorded = await trackEvent({
    contactId,
    eventType: input.event ?? 'form_submitted',
    campaignId: input.campaignId,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    url: input.url,
    metadata: input.data ?? {},
  });
  if (!recorded) return NextResponse.json({ error: 'Could not record event', code: 'EVENT_WRITE_FAILED' }, { status: 500 });

  if (input.formId) {
    await supabaseAdmin.from('marketing_form_submissions').insert({
      form_id: input.formId,
      contact_id: contactId,
      data: input.data ?? {},
      url: input.url ?? null,
    });
    // Keep the denormalized counter in sync (display-only; source of truth is the submissions table)
    const { count } = await supabaseAdmin
      .from('marketing_form_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('form_id', input.formId);
    await supabaseAdmin.from('marketing_forms').update({ submission_count: count ?? 0 }).eq('id', input.formId);
  }

  await refreshContactScores(contactId);
  return NextResponse.json({ ok: true });
}
