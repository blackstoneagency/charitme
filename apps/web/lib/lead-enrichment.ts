// ─────────────────────────────────────────────────────────────────────────────
// Business-lead enrichment — AI website/email/phone lookup, scoring, and
// admin alerting for a single business_leads row.
//
// Extracted from the New Customers [id]/enrich API route so the same logic
// can run on-demand (admin click) or in bulk from the ingestion cron job.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only';
import { openai, OPENAI_MODEL } from './openai';
import { supabaseAdmin } from './supabase';
import {
  scoreLead,
  parseEnrichment,
  fallbackEnrichment,
  shouldAlertAdmin,
  type BusinessLeadInput,
  type EnrichmentResult,
  type ScoreBreakdown,
} from './business-leads';

export type LeadRow = {
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

export interface EnrichLeadResult {
  id: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  score: number;
  grade: string;
  breakdown: ScoreBreakdown;
  model: string;
  alerted: boolean;
}

const LEAD_SELECT = 'id, business_name, entity_type, state, filing_date, filing_status, registered_agent, owner_name, industry, address, website, email, phone, alerted';

/**
 * Enriches one business_leads row: AI (or deterministic fallback) looks up
 * website/email/phone, re-scores the lead, persists the result, logs the AI
 * generation, and alerts admins if the score crosses the outreach threshold.
 *
 * `actorId` is the admin user triggering this (for ai_generations / per-user
 * notifications); pass null for system-triggered runs (e.g. the ingestion
 * cron), which broadcasts the alert notification to all admin profiles.
 */
export async function enrichLead(id: string, actorId: string | null): Promise<EnrichLeadResult | { error: string; status: number }> {
  const { data: lead, error: leadError } = await supabaseAdmin
    .from('business_leads')
    .select(LEAD_SELECT)
    .eq('id', id)
    .maybeSingle<LeadRow>();

  if (leadError) return { error: leadError.message, status: 500 };
  if (!lead) return { error: 'Lead not found', status: 404 };

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

  if (updateError) return { error: updateError.message, status: 500 };

  // Audit the AI generation alongside the platform's other AI features.
  await supabaseAdmin.from('ai_generations').insert({
    user_id: actorId,
    campaign_id: null,
    generation_type: 'business_lead_enrichment',
    prompt: { leadId: lead.id, businessName: lead.business_name, state: lead.state },
    output: { ...enrichment, score, grade },
    model,
  });

  // ── Alert CharitMe admin(s) of a high-value new customer ──
  let alerted = false;
  if (alert && !lead.alerted) {
    const notifBody = `Scored ${score}/100 (grade ${grade}) in ${lead.state ?? 'unknown state'}. ${enrichment.email ? 'Email found. ' : ''}${enrichment.phone ? 'Phone found. ' : ''}Ready for outreach.`;
    const notifTitle = `New customer lead: ${lead.business_name}`;
    const notifMeta = { leadId: lead.id, score, grade };

    let recipientIds: string[] = [];
    if (actorId) {
      recipientIds = [actorId];
    } else {
      // System-triggered (cron) — notify every admin profile.
      const { data: admins } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .contains('roles', ['admin']);
      recipientIds = (admins ?? []).map((a) => a.id as string);
    }

    if (recipientIds.length > 0) {
      const { error: notifError } = await supabaseAdmin.from('notifications').insert(
        recipientIds.map((userId) => ({
          user_id: userId,
          kind: 'new_customer_lead',
          title: notifTitle,
          body: notifBody,
          link: '/admin/new-customers',
          meta: notifMeta,
        })),
      );
      alerted = !notifError;
    }
  }

  return {
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
  };
}
