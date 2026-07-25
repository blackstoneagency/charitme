import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { resolveMx } from 'node:dns/promises';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';
import { resolveContact, isSuppressed } from '../../../../../lib/marketing-engine';
import { generateShortCode, slugifyCampaignName, buildOutreachUrl } from '../../../../../lib/click-tracking';
import { getAppOrigin } from '../../../../../lib/auth-config';
import { sendMarketingEmail } from '../../../../../lib/email';
import { validateEmailAddress, type EmailValidation } from '../../../../../lib/email-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_SUBJECT = '{{first_name}}, a quick idea for {{business_name}}';
const DEFAULT_BODY = `Hi {{first_name}},

Congratulations on launching {{business_name}}! New businesses like yours are exactly the people we love to support at CharitMe.

If giving back is part of your story — a community cause, a customer match campaign, or a team fundraiser — we make it effortless, and CharitMe charges 0% platform fees so more of every dollar reaches the cause.

See how it works (it takes about 60 seconds): {{tracking_url}}

Warmly,
The CharitMe Team`;

type LeadRow = {
  id: string;
  business_name: string;
  owner_name: string | null;
  email: string | null;
  industry: string | null;
  state: string | null;
  lead_score: number;
  lead_grade: string | null;
  status: string;
  marketing_contact_id: string | null;
};

function splitName(name: string | null): { first: string | undefined; last: string | undefined } {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { first: undefined, last: undefined };
  const parts = trimmed.split(/\s+/);
  return { first: parts[0], last: parts.length > 1 ? parts.slice(1).join(' ') : undefined };
}

// Best-effort DNS MX lookup — confirms the domain can actually receive mail.
// Never throws; returns null when the lookup is inconclusive (e.g. timeout).
async function checkMx(domain: string | null): Promise<boolean | null> {
  if (!domain) return null;
  try {
    const records = await Promise.race([
      resolveMx(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('mx-timeout')), 2500)),
    ]);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return null;
  }
}

// ── GET: leads (with email) + their outreach state + funnel stats ──
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('business_leads')
    .select(`
      id, business_name, owner_name, email, industry, state, lead_score, lead_grade, status, marketing_contact_id,
      lead_outreach (
        id, short_code, status, channel, subject, body, email, email_valid, email_validation,
        email_validated_at, sent_at, first_click_at, last_click_at, click_count
      )
    `)
    .not('email', 'is', null)
    .order('lead_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  const origin = getAppOrigin();
  const leads = (data ?? []).map((l) => {
    const o = Array.isArray(l.lead_outreach) ? l.lead_outreach[0] ?? null : (l.lead_outreach ?? null);
    return {
      ...l,
      lead_outreach: undefined,
      outreach: o
        ? { ...o, invite_url: o.short_code ? buildOutreachUrl(origin, o.short_code, o.id, l.marketing_contact_id ?? undefined) : null }
        : null,
    };
  });

  const stats = {
    total: leads.length,
    validated: leads.filter((l) => l.outreach?.email_valid != null).length,
    deliverable: leads.filter((l) => l.outreach?.email_valid === true).length,
    ready: leads.filter((l) => l.outreach && ['ready', 'sent', 'clicked', 'converted'].includes(l.outreach.status)).length,
    sent: leads.filter((l) => l.outreach && ['sent', 'clicked', 'converted'].includes(l.outreach.status)).length,
    clicked: leads.filter((l) => l.outreach && ['clicked', 'converted'].includes(l.outreach.status)).length,
    converted: leads.filter((l) => l.outreach?.status === 'converted').length,
  };

  return NextResponse.json({ leads, stats });
}

async function loadLead(leadId: string): Promise<LeadRow | null> {
  const { data } = await supabaseAdmin
    .from('business_leads')
    .select('id, business_name, owner_name, email, industry, state, lead_score, lead_grade, status, marketing_contact_id')
    .eq('id', leadId)
    .maybeSingle();
  return (data as LeadRow) ?? null;
}

// ── POST: prepare a unique tracking link for a lead (resolve contact + utm link) ──
const PrepareSchema = z.object({ leadId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = PrepareSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const lead = await loadLead(parsed.data.leadId);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (!lead.email) return NextResponse.json({ error: 'Lead has no email — enrich it first' }, { status: 400 });

  // 1. Resolve the lead into a marketing contact (stitches identity).
  const { first, last } = splitName(lead.owner_name);
  const contactId = await resolveContact({
    email: lead.email, firstName: first, lastName: last,
    clientType: 'lead', utmSource: 'outreach', utmMedium: 'lead',
  });
  if (!contactId) return NextResponse.json({ error: 'Could not resolve a marketing contact' }, { status: 500 });

  // 2. Reuse an existing outreach record/link if present, else mint a new link.
  const { data: existing } = await supabaseAdmin
    .from('lead_outreach')
    .select('id, short_code, utm_link_id, status')
    .eq('business_lead_id', lead.id)
    .maybeSingle();

  let shortCode = existing?.short_code ?? null;
  let utmLinkId = existing?.utm_link_id ?? null;
  if (!shortCode || !utmLinkId) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = generateShortCode();
      const { data: link, error: linkErr } = await supabaseAdmin
        .from('marketing_utm_links')
        .insert({
          name: `Outreach: ${lead.business_name}`,
          destination_url: '/',
          utm_source: 'outreach',
          utm_medium: 'lead',
          utm_campaign: slugifyCampaignName(`new-business-${lead.business_name}`),
          short_code: code,
          created_by: admin.id,
        })
        .select('id, short_code')
        .single();
      if (link) { shortCode = link.short_code; utmLinkId = link.id; break; }
      if (linkErr && !`${linkErr.message}`.includes('short_code')) {
        return NextResponse.json({ error: linkErr.message }, { status: 500 });
      }
    }
  }
  if (!shortCode || !utmLinkId) return NextResponse.json({ error: 'Could not create tracking link' }, { status: 500 });

  // 3. Upsert the outreach row — never downgrade a status that's already further along.
  const keepStatus = existing && ['sent', 'clicked', 'converted'].includes(existing.status) ? existing.status : 'ready';
  const { data: outreach, error: upErr } = await supabaseAdmin
    .from('lead_outreach')
    .upsert({
      business_lead_id: lead.id,
      marketing_contact_id: contactId,
      utm_link_id: utmLinkId,
      short_code: shortCode,
      email: lead.email,
      status: keepStatus,
      created_by: admin.id,
    }, { onConflict: 'business_lead_id' })
    .select('*')
    .single();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await supabaseAdmin.from('business_leads').update({ marketing_contact_id: contactId }).eq('id', lead.id);
  await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id, action: 'lead_outreach_prepared', entity: 'lead_outreach', entity_id: outreach.id,
    detail: { business_name: lead.business_name },
  });

  const inviteUrl = buildOutreachUrl(getAppOrigin(), shortCode, outreach.id, contactId);
  return NextResponse.json({ outreach: { ...outreach, invite_url: inviteUrl } });
}

// ── PATCH: validate_email | send | mark_converted ──
const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('validate_email'), leadId: z.string().uuid() }),
  z.object({ action: z.literal('send'), leadId: z.string().uuid(), subject: z.string().max(200).optional(), body: z.string().max(20000).optional() }),
  z.object({ action: z.literal('mark_converted'), leadId: z.string().uuid() }),
]);

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  const lead = await loadLead(parsed.data.leadId);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  // ── validate_email ──
  if (parsed.data.action === 'validate_email') {
    if (!lead.email) return NextResponse.json({ error: 'Lead has no email' }, { status: 400 });
    const base = validateEmailAddress(lead.email);
    const mx = await checkMx(base.domain);
    const validation: EmailValidation & { mx: boolean | null } = { ...base, mx };
    // MX confirmed-absent is a hard fail; null (inconclusive) leaves heuristics in charge.
    const valid = base.valid && mx !== false;

    const { data: outreach, error } = await supabaseAdmin
      .from('lead_outreach')
      .upsert({
        business_lead_id: lead.id,
        email: lead.email,
        email_valid: valid,
        email_validation: validation,
        email_validated_at: new Date().toISOString(),
        created_by: admin.id,
      }, { onConflict: 'business_lead_id' })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
    return NextResponse.json({ outreach, validation });
  }

  // ── mark_converted ──
  if (parsed.data.action === 'mark_converted') {
    const { data: outreach, error } = await supabaseAdmin
      .from('lead_outreach')
      .update({ status: 'converted' })
      .eq('business_lead_id', lead.id)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
    if (!outreach) return NextResponse.json({ error: 'Prepare the outreach first' }, { status: 400 });
    await supabaseAdmin.from('business_leads').update({ status: 'converted' }).eq('id', lead.id);
    return NextResponse.json({ outreach });
  }

  // ── send ──
  if (!lead.email) return NextResponse.json({ error: 'Lead has no email' }, { status: 400 });

  const { data: outreach } = await supabaseAdmin
    .from('lead_outreach')
    .select('*')
    .eq('business_lead_id', lead.id)
    .maybeSingle();
  if (!outreach?.short_code || !outreach.marketing_contact_id) {
    return NextResponse.json({ error: 'Prepare the tracking link first' }, { status: 400 });
  }
  if (await isSuppressed(lead.email)) {
    return NextResponse.json({ error: 'This email is on the suppression list (unsubscribed/bounced)' }, { status: 400 });
  }

  const { first } = splitName(lead.owner_name);
  const inviteUrl = buildOutreachUrl(getAppOrigin(), outreach.short_code, outreach.id, outreach.marketing_contact_id);
  const personalize = (text: string) => text
    .replaceAll('{{first_name}}', first || 'there')
    .replaceAll('{{business_name}}', lead.business_name)
    .replaceAll('{{tracking_url}}', inviteUrl);

  const subjectTpl = parsed.data.subject?.trim() || outreach.subject || DEFAULT_SUBJECT;
  const bodyTpl = parsed.data.body?.trim() || outreach.body || DEFAULT_BODY;

  const result = await sendMarketingEmail({
    to: lead.email,
    subject: personalize(subjectTpl),
    text: personalize(bodyTpl),
  });
  if (!result.sent) {
    return NextResponse.json({ error: 'Email provider not configured — set RESEND_API_KEY to send' }, { status: 503 });
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('lead_outreach')
    .update({ status: 'sent', sent_at: new Date().toISOString(), subject: subjectTpl, body: bodyTpl, email: lead.email })
    .eq('id', outreach.id)
    .select('*')
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Move the lead forward in its own pipeline (unless already converted).
  if (lead.status !== 'converted') {
    await supabaseAdmin.from('business_leads').update({ status: 'contacted' }).eq('id', lead.id);
  }
  await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id, action: 'lead_outreach_sent', entity: 'lead_outreach', entity_id: outreach.id,
    detail: { business_name: lead.business_name, email: lead.email },
  });

  return NextResponse.json({ outreach: { ...updated, invite_url: inviteUrl } });
}
