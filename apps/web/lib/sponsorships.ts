import 'server-only';
// ─────────────────────────────────────────────────────────────────────────────
// Sponsorship marketplace — Supabase data access. Pure logic in
// `sponsorships-core.ts`.
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from './supabase';
import { boundedQuery } from './query-timeout';
import type { SponsorshipOpportunity, SponsorshipRequest } from './sponsorships-core';

const OPPORTUNITY_COLUMNS =
  'id, organizer_id, campaign_id, title, description, category, benefits, min_amount_cents, target_amount_cents, raised_amount_cents, currency, status, created_at, updated_at';

export interface OpportunityFilters {
  category?: string;
  search?: string;
  limit?: number;
}

export interface OpportunityWithOrganizer extends SponsorshipOpportunity {
  organizer_name: string | null;
  campaign_slug: string | null;
  campaign_title: string | null;
}

export async function listOpenOpportunities(
  filters: OpportunityFilters = {},
): Promise<OpportunityWithOrganizer[]> {
  let query = supabaseAdmin
    .from('sponsorship_opportunities')
    .select(OPPORTUNITY_COLUMNS)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(Math.min(filters.limit ?? 60, 200));

  if (filters.category) query = query.eq('category', filters.category);
  if (filters.search) query = query.ilike('title', `%${filters.search}%`);

  const { data, error } = await boundedQuery(query);
  if (error || !data) return [];
  return decorate(data as SponsorshipOpportunity[]);
}

export async function getOpportunity(id: string): Promise<OpportunityWithOrganizer | null> {
  const { data, error } = await supabaseAdmin
    .from('sponsorship_opportunities')
    .select(OPPORTUNITY_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  const [decorated] = await decorate([data as SponsorshipOpportunity]);
  return decorated ?? null;
}

export async function listOrganizerOpportunities(
  organizerId: string,
): Promise<OpportunityWithOrganizer[]> {
  const { data, error } = await boundedQuery(
  supabaseAdmin
      .from('sponsorship_opportunities')
      .select(OPPORTUNITY_COLUMNS)
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false })
      .limit(200),
  );
  if (error || !data) return [];
  return decorate(data as SponsorshipOpportunity[]);
}

export interface RequestWithNames extends SponsorshipRequest {
  sponsor_name: string | null;
  sponsor_email: string | null;
  opportunity_title: string | null;
}

export async function listSponsorRequests(sponsorId: string): Promise<RequestWithNames[]> {
  const { data, error } = await boundedQuery(
  supabaseAdmin
      .from('sponsorship_requests')
      .select('*')
      .eq('sponsor_id', sponsorId)
      .order('created_at', { ascending: false }),
  );
  if (error || !data) return [];
  return attachRequestNames(data as SponsorshipRequest[]);
}

export async function listOpportunityRequests(opportunityId: string): Promise<RequestWithNames[]> {
  const { data, error } = await boundedQuery(
  supabaseAdmin
      .from('sponsorship_requests')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false }),
  );
  if (error || !data) return [];
  return attachRequestNames(data as SponsorshipRequest[]);
}

// ── internal helpers ──────────────────────────────────────────────────────────

async function decorate(rows: SponsorshipOpportunity[]): Promise<OpportunityWithOrganizer[]> {
  if (rows.length === 0) return [];
  const organizerIds = [...new Set(rows.map((r) => r.organizer_id))];
  const campaignIds = [...new Set(rows.map((r) => r.campaign_id).filter((x): x is string => !!x))];

  const [{ data: profiles }, campaignsRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, full_name').in('id', organizerIds),
    campaignIds.length
      ? supabaseAdmin.from('campaigns').select('id, slug, title').in('id', campaignIds)
      : Promise.resolve({ data: [] as { id: string; slug: string; title: string }[] }),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, p.full_name as string | null]));
  const campaignById = new Map(
    (campaignsRes.data ?? []).map((c) => [c.id as string, c as { slug: string; title: string }]),
  );

  return rows.map((r) => ({
    ...r,
    organizer_name: nameById.get(r.organizer_id) ?? null,
    campaign_slug: r.campaign_id ? campaignById.get(r.campaign_id)?.slug ?? null : null,
    campaign_title: r.campaign_id ? campaignById.get(r.campaign_id)?.title ?? null : null,
  }));
}

async function attachRequestNames(rows: SponsorshipRequest[]): Promise<RequestWithNames[]> {
  if (rows.length === 0) return [];
  const sponsorIds = [...new Set(rows.map((r) => r.sponsor_id))];
  const opportunityIds = [...new Set(rows.map((r) => r.opportunity_id))];

  const [{ data: profiles }, { data: opps }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, full_name, email').in('id', sponsorIds),
    supabaseAdmin.from('sponsorship_opportunities').select('id, title').in('id', opportunityIds),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const titleById = new Map((opps ?? []).map((o) => [o.id as string, o.title as string]));

  return rows.map((r) => ({
    ...r,
    sponsor_name: profileById.get(r.sponsor_id)?.full_name ?? null,
    sponsor_email: profileById.get(r.sponsor_id)?.email ?? null,
    opportunity_title: titleById.get(r.opportunity_id) ?? null,
  }));
}
