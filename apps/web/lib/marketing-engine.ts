// Marketing engine — identity resolution, event tracking, scoring
// refresh, suppression, and segment evaluation against live Supabase data.
// Pure logic lives in marketing-core.ts.

import { supabaseAdmin } from './supabase';
import { generateShortCode, slugifyCampaignName } from './click-tracking';
import {
  computeLeadScore,
  computeEngagementScore,
  computeChurnRisk,
  classifyClientType,
  computeLifecycleStage,
  matchesSegment,
  type ClientType,
  type ContactInput,
  type ContactSignals,
  type SegmentRules,
  type SegmentableContact,
} from './marketing-core';

export * from './marketing-core';

// ─────────────────────────────────────────────
// Identity resolution + capture (Supabase, server-only callers)
// ─────────────────────────────────────────────

/**
 * Find-or-create a marketing contact, stitching identities (email, phone,
 * user_id). Returns the contact id. New touch attribution updates
 * last_touch_*; first_touch_* is only set once.
 */
export async function resolveContact(input: ContactInput): Promise<string | null> {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  if (!email && !phone && !input.userId) return null;

  async function findDirectContactId(): Promise<string | null> {
    const directLookups: { column: 'email' | 'phone' | 'user_id'; value: string }[] = [];
    if (email) directLookups.push({ column: 'email', value: email });
    if (phone) directLookups.push({ column: 'phone', value: phone });
    if (input.userId) directLookups.push({ column: 'user_id', value: input.userId });

    for (const lookup of directLookups) {
      const query = supabaseAdmin
        .from('marketing_contacts')
        .select('id')
        .eq(lookup.column, lookup.value);
      const result = lookup.column === 'email'
        ? await query.ilike('email', lookup.value).maybeSingle()
        : await query.maybeSingle();
      if (result.data?.id) return result.data.id;
    }
    return null;
  }

  // 1. Look up by any known identity
  let contactId: string | null = null;
  const lookups: { kind: string; value: string }[] = [];
  if (email) lookups.push({ kind: 'email', value: email });
  if (phone) lookups.push({ kind: 'phone', value: phone });
  if (input.userId) lookups.push({ kind: 'user_id', value: input.userId });

  for (const l of lookups) {
    const { data } = await supabaseAdmin
      .from('marketing_identities')
      .select('contact_id')
      .eq('kind', l.kind)
      .eq('value', l.value)
      .maybeSingle();
    if (data?.contact_id) { contactId = data.contact_id; break; }
  }

  // Bootstrap-created users may have a contact before their identity rows are
  // present. Direct lookup prevents a unique-email race from turning capture
  // into a 500 and repairs the identity trail below.
  if (!contactId) contactId = await findDirectContactId();

  if (!contactId) {
    const { data: created, error } = await supabaseAdmin
      .from('marketing_contacts')
      .insert({
        email, phone,
        user_id: input.userId ?? null,
        first_name: input.firstName ?? null,
        last_name: input.lastName ?? null,
        client_type: input.clientType ?? 'visitor',
        country: input.country ?? null,
        first_touch_source: input.utmSource ?? null,
        first_touch_medium: input.utmMedium ?? null,
        first_touch_campaign: input.utmCampaign ?? null,
        last_touch_source: input.utmSource ?? null,
        last_touch_medium: input.utmMedium ?? null,
        last_touch_campaign: input.utmCampaign ?? null,
        landing_page: input.landingPage ?? null,
        last_active_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error || !created) {
      // A concurrent capture may have won the unique email/phone insert.
      // Resolve that winner and continue stitching instead of dropping the event.
      contactId = await findDirectContactId();
      if (!contactId) return null;
    } else {
      contactId = created.id;
    }
  } else {
    // Merge new info + update last-touch
    const updates: Record<string, unknown> = { last_active_at: new Date().toISOString() };
    if (email) updates.email = email;
    if (phone) updates.phone = phone;
    if (input.userId) updates.user_id = input.userId;
    if (input.firstName) updates.first_name = input.firstName;
    if (input.lastName) updates.last_name = input.lastName;
    if (input.clientType && input.clientType !== 'visitor') updates.client_type = input.clientType;
    if (input.utmSource) { updates.last_touch_source = input.utmSource; }
    if (input.utmMedium) { updates.last_touch_medium = input.utmMedium; }
    if (input.utmCampaign) { updates.last_touch_campaign = input.utmCampaign; }
    await supabaseAdmin.from('marketing_contacts').update(updates).eq('id', contactId);
  }

  // 2. Stitch all identities (idempotent on unique (kind,value))
  for (const l of lookups) {
    await supabaseAdmin
      .from('marketing_identities')
      .upsert({ contact_id: contactId, kind: l.kind, value: l.value }, { onConflict: 'kind,value', ignoreDuplicates: true });
  }

  // 3. Consent log
  if (input.consentEmail !== undefined && contactId) {
    await supabaseAdmin.from('marketing_consent').insert({
      contact_id: contactId,
      channel: 'email',
      granted: input.consentEmail,
      source: input.consentSource ?? 'form',
    });
  }

  return contactId;
}

/** Record a behavioral event against a contact (or anonymously). */
export async function trackEvent(args: {
  contactId?: string | null;
  eventType: string;
  campaignId?: string;
  marketingCampaignId?: string;
  amountCents?: number;
  utmSource?: string; utmMedium?: string; utmCampaign?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await supabaseAdmin.from('marketing_events').insert({
    contact_id: args.contactId ?? null,
    event_type: args.eventType,
    campaign_id: args.campaignId ?? null,
    marketing_campaign_id: args.marketingCampaignId ?? null,
    amount_cents: args.amountCents ?? null,
    utm_source: args.utmSource ?? null,
    utm_medium: args.utmMedium ?? null,
    utm_campaign: args.utmCampaign ?? null,
    url: args.url ?? null,
    metadata: args.metadata ?? {},
  });
  if (args.contactId) {
    await supabaseAdmin
      .from('marketing_contacts')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', args.contactId);
  }
}

/**
 * Find-or-create the single /go/[code] click-tracking link for a campaign,
 * used to resolve {{tracking_url}} in campaign bodies/subjects. Returns the
 * short_code, or null if creation failed.
 */
export async function getOrCreateCampaignTrackingLink(campaign: {
  id: string;
  name: string;
  campaign_type: string;
  created_by?: string | null;
}): Promise<string | null> {
  const { data: existing } = await supabaseAdmin
    .from('marketing_utm_links')
    .select('short_code')
    .eq('campaign_id', campaign.id)
    .maybeSingle();
  if (existing?.short_code) return existing.short_code;

  for (let attempt = 0; attempt < 3; attempt++) {
    const shortCode = generateShortCode();
    const { data: created, error } = await supabaseAdmin
      .from('marketing_utm_links')
      .insert({
        name: `Campaign: ${campaign.name}`,
        destination_url: '/',
        utm_source: campaign.campaign_type === 'email' ? 'email' : campaign.campaign_type,
        utm_medium: 'campaign',
        utm_campaign: slugifyCampaignName(campaign.name),
        short_code: shortCode,
        campaign_id: campaign.id,
        created_by: campaign.created_by ?? null,
      })
      .select('short_code')
      .single();
    if (created) return created.short_code;
    // short_code collision (unique constraint) — retry with a fresh code
    if (error && !`${error.message}`.includes('short_code')) return null;
  }
  return null;
}

/** Recompute scores/classification for one contact from live data. */
export async function refreshContactScores(contactId: string): Promise<void> {
  const { data: contact } = await supabaseAdmin
    .from('marketing_contacts')
    .select('id, user_id, client_type, last_active_at')
    .eq('id', contactId)
    .single();
  if (!contact) return;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [donationsRes, recurringRes, campaignsRes, eventsRes] = await Promise.all([
    contact.user_id
      ? supabaseAdmin.from('donations').select('amount_cents').eq('donor_id', contact.user_id).eq('status', 'completed')
      : Promise.resolve({ data: [] as { amount_cents: number }[] }),
    contact.user_id
      ? supabaseAdmin.from('recurring_donations').select('id').eq('donor_id', contact.user_id).eq('status', 'active').limit(1)
      : Promise.resolve({ data: [] as { id: string }[] }),
    contact.user_id
      ? supabaseAdmin.from('campaigns').select('id, status').eq('user_id', contact.user_id)
      : Promise.resolve({ data: [] as { id: string; status: string }[] }),
    supabaseAdmin.from('marketing_events').select('id').eq('contact_id', contactId).gte('created_at', thirtyDaysAgo),
  ]);

  const donations = donationsRes.data ?? [];
  const campaigns = campaignsRes.data ?? [];
  const signals: ContactSignals = {
    donationCount: donations.length,
    donorValueCents: donations.reduce((s, d) => s + (d.amount_cents ?? 0), 0),
    hasRecurring: (recurringRes.data ?? []).length > 0,
    campaignsCreated: campaigns.length,
    campaignsPublished: campaigns.filter(c => c.status === 'active' || c.status === 'completed').length,
    eventsLast30d: (eventsRes.data ?? []).length,
    daysSinceLastActive: contact.last_active_at
      ? Math.floor((Date.now() - new Date(contact.last_active_at).getTime()) / 86_400_000)
      : null,
  };

  await supabaseAdmin.from('marketing_contacts').update({
    lead_score: computeLeadScore(signals),
    engagement_score: computeEngagementScore(signals),
    churn_risk: computeChurnRisk(signals),
    client_type: classifyClientType(signals, contact.client_type as ClientType),
    lifecycle_stage: computeLifecycleStage(signals),
    donation_count: signals.donationCount,
    donor_value_cents: signals.donorValueCents,
  }).eq('id', contactId);
}

/** Check suppression before any send. */
export async function isSuppressed(email: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('marketing_suppression_list')
    .select('id')
    .ilike('email', email.trim())
    .maybeSingle();
  return Boolean(data);
}

/** Unsubscribe: suppress + mark contact + consent audit. */
export async function unsubscribeEmail(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await supabaseAdmin
    .from('marketing_suppression_list')
    .upsert({ email: normalized, reason: 'unsubscribed' }, { onConflict: 'email', ignoreDuplicates: true });
  const { data: contact } = await supabaseAdmin
    .from('marketing_contacts')
    .select('id')
    .ilike('email', normalized)
    .maybeSingle();
  if (contact) {
    await supabaseAdmin.from('marketing_contacts').update({ status: 'unsubscribed' }).eq('id', contact.id);
    await supabaseAdmin.from('marketing_consent').insert({
      contact_id: contact.id, channel: 'email', granted: false, source: 'unsubscribe_link',
    });
  }
}

// ─────────────────────────────────────────────
// Segment evaluation against live data
// ─────────────────────────────────────────────

export async function evaluateSegment(segmentId: string): Promise<{ matched: number }> {
  const { data: segment } = await supabaseAdmin
    .from('marketing_segments')
    .select('id, rules')
    .eq('id', segmentId)
    .single();
  if (!segment) return { matched: 0 };

  const { data: contacts } = await supabaseAdmin
    .from('marketing_contacts')
    .select('id, donation_count, donor_value_cents, lead_score, engagement_score, client_type, lifecycle_stage, country, last_active_at')
    .eq('status', 'active')
    .limit(5000);

  const ids = (contacts ?? []).map(c => c.id);
  const eventsByContact = new Map<string, string[]>();
  if (ids.length > 0) {
    const { data: events } = await supabaseAdmin
      .from('marketing_events')
      .select('contact_id, event_type')
      .in('contact_id', ids.slice(0, 1000));
    for (const e of events ?? []) {
      if (!e.contact_id) continue;
      const arr = eventsByContact.get(e.contact_id) ?? [];
      if (!arr.includes(e.event_type)) arr.push(e.event_type);
      eventsByContact.set(e.contact_id, arr);
    }
  }

  const rules = segment.rules as SegmentRules;
  const matchedIds = (contacts ?? [])
    .filter(c => matchesSegment({ ...c, event_types: eventsByContact.get(c.id) ?? [] } as SegmentableContact, rules))
    .map(c => c.id);

  // Replace membership atomically-ish
  await supabaseAdmin.from('marketing_segment_members').delete().eq('segment_id', segmentId);
  if (matchedIds.length > 0) {
    await supabaseAdmin.from('marketing_segment_members').insert(
      matchedIds.map(contact_id => ({ segment_id: segmentId, contact_id })),
    );
  }
  await supabaseAdmin.from('marketing_segments').update({ member_count: matchedIds.length }).eq('id', segmentId);
  return { matched: matchedIds.length };
}
