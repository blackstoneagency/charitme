import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { openai, OPENAI_MODEL } from '../../../../../../lib/openai';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { verifyAdmin } from '../../../users/_auth';
import {
  scoreLead,
  parseEnrichment,
  fallbackEnrichment,
  shouldAlertAdmin,
  type BusinessLeadInput,
  type EnrichmentResult,
} from '../../../../../../lib/business-leads';

export const dynamic = 'force-dynamic';

type LeadRow = {
  id: string;
  business_name: string;
  entity_type: string | null;
  state: string | null;
  filing_date: string | null;
  filing_status: string | null;
  registered_agent: string | null;
  owner_name: string | null;
  industry: string | null;
  address: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  alerted: boolean;
};

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: lead, error: leadError } = await supabaseAdmin
    .from('business_leads')
    .select('id, business_name, entity_type, state, filing_date, filing_status, registered_agent, owner_name, industry, address, website, email, phone, alerted')
    .eq('id', id)
    .maybeSingle<LeadRow>();

  if (leadError) return NextResponse.json({ error: leadError.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  // ── AI finds website → email → phone (deterministic fallback when no key) ──
  let enrichment: EnrichmentResult = fallbackEnrichment(lead);
  let model = 'fallback';

  if (openai) {
    try {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: 'You are CharitMe\'s B2B lead-enrichment assistant. Given the public business-registration facts for a newly formed company, infer the most likely public contact details. Only return values you are reasonably confident a human researcher could verify; use null when unsure rather than guessing. Never invent specific personal emails or phone numbers — prefer general business contacts (info@, contact@) only when the domain is strongly implied. Return strict JSON: {"website": string|null, "email": string|null, "phone": string|null, "notes": string|null}. Notes should briefly explain confidence and what to verify.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              businessName: lead.business_name,
              entityType: lead.entity_type,
              state: lead.state,
              filingDate: lead.filing_date,
              registeredAgent: lead.registered_agent,
              ownerName: lead.owner_name,
              industry: lead.industry,
              address: lead.address,
              knownWebsite: lead.website,
              knownEmail: lead.email,
              knownPhone: lead.phone,
            }),
          },
        ],
      });
      const parsedAi = parseEnrichment(JSON.parse(response.output_text));
      // Prefer AI values, but keep any already-known good values it dropped.
      enrichment = {
        website: parsedAi.website ?? fallbackEnrichment(lead).website,
        email: parsedAi.email ?? (lead.email ?? null),
        phone: parsedAi.phone ?? (lead.phone ?? null),
        notes: parsedAi.notes,
      };
      model = OPENAI_MODEL;
    } catch {
      // keep deterministic fallback
    }
  }

  // ── Score the now-enriched lead ──
  const enrichedLead: BusinessLeadInput = {
    business_name: lead.business_name,
    entity_type: lead.entity_type,
    state: lead.state,
    filing_date: lead.filing_date,
    filing_status: lead.filing_status,
    registered_agent: lead.registered_agent,
    owner_name: lead.owner_name,
    industry: lead.industry,
    address: lead.address,
    website: enrichment.website,
    email: enrichment.email,
    phone: enrichment.phone,
  };
  const { score, grade, breakdown } = scoreLead(enrichedLead);
  const alert = shouldAlertAdmin(score);

  const { error: updateError } = await supabaseAdmin
    .from('business_leads')
    .update({
      website: enrichment.website,
      email: enrichment.email,
      phone: enrichment.phone,
      enrichment_notes: enrichment.notes,
      enrichment_model: model,
      enriched_at: new Date().toISOString(),
      lead_score: score,
      lead_grade: grade,
      score_breakdown: breakdown,
      status: 'enriched',
      alerted: alert || lead.alerted,
    })
    .eq('id', lead.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Audit the AI generation alongside the platform's other AI features.
  await supabaseAdmin.from('ai_generations').insert({
    user_id: admin.id,
    campaign_id: null,
    generation_type: 'business_lead_enrichment',
    prompt: { leadId: lead.id, businessName: lead.business_name, state: lead.state },
    output: { ...enrichment, score, grade },
    model,
  });

  // ── Alert CharitMe admin of a high-value new customer ──
  let alerted = false;
  if (alert && !lead.alerted) {
    const { error: notifError } = await supabaseAdmin.from('notifications').insert({
      user_id: admin.id,
      kind: 'new_customer_lead',
      title: `New customer lead: ${lead.business_name}`,
      body: `Scored ${score}/100 (grade ${grade}) in ${lead.state ?? 'unknown state'}. ${enrichment.email ? 'Email found. ' : ''}${enrichment.phone ? 'Phone found. ' : ''}Ready for outreach.`,
      link: '/admin/new-customers',
      meta: { leadId: lead.id, score, grade },
    });
    alerted = !notifError;
  }

  return NextResponse.json({
    id: lead.id,
    website: enrichment.website,
    email: enrichment.email,
    phone: enrichment.phone,
    notes: enrichment.notes,
    score,
    grade,
    breakdown,
    model,
    alerted,
  });
}
