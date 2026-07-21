// Marketing core — pure scoring, classification, and segment rule
// evaluation. No Supabase imports so it is unit-testable anywhere.

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ClientType =
  | 'visitor' | 'donor' | 'repeat_donor' | 'recurring_donor' | 'high_value_donor'
  | 'organizer' | 'draft_organizer' | 'beneficiary' | 'nonprofit'
  | 'newsletter' | 'support' | 'lead';

export type LifecycleStage = 'subscriber' | 'lead' | 'engaged' | 'customer' | 'champion' | 'dormant';

/**
 * Map a donor's "Subscribe to receive emails" choice to a marketing-contact
 * send-status. Opting in makes the contact emailable; declining creates them as
 * 'unsubscribed' so a non-consenting donor is never marketed to.
 */
export function marketingStatusForOptIn(subscribed: boolean): 'active' | 'unsubscribed' {
  return subscribed ? 'active' : 'unsubscribed';
}

export interface ContactInput {
  email?: string;
  phone?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  clientType?: ClientType;
  country?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingPage?: string;
  consentEmail?: boolean;
  consentSource?: string;
  /**
   * Marketing send-eligibility for this contact. On CREATE it sets the initial
   * status (so a non-consenting donor is never created as an emailable contact);
   * on an EXISTING contact only 'active' is applied (an explicit re-opt-in) —
   * we never silently downgrade an already-subscribed contact here. Omit to keep
   * the default ('active' on create, unchanged on update).
   */
  marketingStatus?: 'active' | 'unsubscribed';
}

export interface ContactSignals {
  donationCount: number;
  donorValueCents: number;
  hasRecurring: boolean;
  campaignsCreated: number;
  campaignsPublished: number;
  eventsLast30d: number;
  daysSinceLastActive: number | null;
}

// ─────────────────────────────────────────────
// Pure scoring functions (unit-tested)
// ─────────────────────────────────────────────

/** 0–100 lead score: likelihood this contact takes a valuable action. */
export function computeLeadScore(s: ContactSignals): number {
  let score = 0;
  score += Math.min(s.donationCount * 12, 36);                 // up to 36 from giving history
  score += Math.min(Math.floor(s.donorValueCents / 10_000) * 4, 20); // $100 ≈ +4, cap 20
  if (s.hasRecurring) score += 15;
  score += Math.min(s.campaignsPublished * 10, 20);
  score += Math.min(s.campaignsCreated * 3, 9);
  score += Math.min(s.eventsLast30d * 2, 10);
  if (s.daysSinceLastActive !== null && s.daysSinceLastActive > 60) score = Math.round(score * 0.5);
  return Math.max(0, Math.min(100, score));
}

/** 0–100 engagement score: recency + frequency of activity. */
export function computeEngagementScore(s: ContactSignals): number {
  let score = Math.min(s.eventsLast30d * 8, 64);
  if (s.daysSinceLastActive === null) return Math.min(score, 20);
  if (s.daysSinceLastActive <= 1) score += 36;
  else if (s.daysSinceLastActive <= 7) score += 24;
  else if (s.daysSinceLastActive <= 30) score += 10;
  return Math.max(0, Math.min(100, score));
}

export function computeChurnRisk(s: ContactSignals): 'low' | 'medium' | 'high' | 'unknown' {
  if (s.daysSinceLastActive === null) return 'unknown';
  if (s.daysSinceLastActive <= 14) return 'low';
  if (s.daysSinceLastActive <= 45) return 'medium';
  return 'high';
}

export function classifyClientType(s: ContactSignals, current: ClientType): ClientType {
  if (s.hasRecurring) return 'recurring_donor';
  if (s.donorValueCents >= 50_000) return 'high_value_donor';
  if (s.donationCount >= 2) return 'repeat_donor';
  if (s.donationCount === 1) return 'donor';
  if (s.campaignsPublished >= 1) return 'organizer';
  if (s.campaignsCreated >= 1) return 'draft_organizer';
  return current;
}

export function computeLifecycleStage(s: ContactSignals): LifecycleStage {
  if (s.daysSinceLastActive !== null && s.daysSinceLastActive > 90) return 'dormant';
  if (s.donationCount >= 3 || s.donorValueCents >= 50_000 || s.hasRecurring) return 'champion';
  if (s.donationCount >= 1 || s.campaignsPublished >= 1) return 'customer';
  if (s.eventsLast30d >= 3) return 'engaged';
  if (s.eventsLast30d >= 1) return 'lead';
  return 'subscriber';
}

// ─────────────────────────────────────────────
// Segment rule engine (unit-tested)
// ─────────────────────────────────────────────

export interface SegmentCondition {
  field: string;   // donation_count|donor_value_cents|lead_score|engagement_score|client_type|lifecycle_stage|inactive_days|event|country
  op: 'eq' | 'neq' | 'gte' | 'lte' | 'has' | 'not_has' | 'contains';
  value: string | number;
}

export interface SegmentRules {
  logic: 'and' | 'or';
  conditions: SegmentCondition[];
}

export interface SegmentableContact {
  donation_count: number;
  donor_value_cents: number;
  lead_score: number;
  engagement_score: number;
  client_type: string;
  lifecycle_stage: string;
  country: string | null;
  last_active_at: string | null;
  event_types: string[]; // distinct events for this contact
}

export function matchesSegment(contact: SegmentableContact, rules: SegmentRules, now: Date = new Date()): boolean {
  const results = rules.conditions.map((c) => matchCondition(contact, c, now));
  if (results.length === 0) return false;
  return rules.logic === 'or' ? results.some(Boolean) : results.every(Boolean);
}

function matchCondition(contact: SegmentableContact, c: SegmentCondition, now: Date): boolean {
  if (c.field === 'event') {
    const has = contact.event_types.includes(String(c.value));
    return c.op === 'not_has' ? !has : has;
  }
  if (c.field === 'inactive_days') {
    if (!contact.last_active_at) return c.op === 'gte'; // never active counts as inactive
    const days = (now.getTime() - new Date(contact.last_active_at).getTime()) / 86_400_000;
    return compare(days, c.op, Number(c.value));
  }
  const raw = (contact as unknown as Record<string, unknown>)[c.field];
  if (typeof raw === 'number') return compare(raw, c.op, Number(c.value));
  const str = String(raw ?? '').toLowerCase();
  const val = String(c.value).toLowerCase();
  if (c.op === 'eq') return str === val;
  if (c.op === 'neq') return str !== val;
  if (c.op === 'contains') return str.includes(val);
  return false;
}

function compare(a: number, op: SegmentCondition['op'], b: number): boolean {
  if (op === 'eq') return a === b;
  if (op === 'neq') return a !== b;
  if (op === 'gte') return a >= b;
  if (op === 'lte') return a <= b;
  return false;
}

