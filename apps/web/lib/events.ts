import 'server-only';
// ─────────────────────────────────────────────────────────────────────────────
// Events — Supabase data access. Pure logic in `events-core.ts`.
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from './supabase';
import { boundedQuery } from './query-timeout';
import type { FundraisingEvent, EventRegistration } from './events-core';

const EVENT_COLUMNS =
  'id, created_by, campaign_id, title, slug, description, event_type, starts_at, ends_at, location, virtual_url, cover_image_url, capacity, status, created_at, updated_at';

export interface EventWithCounts extends FundraisingEvent {
  registered_qty: number;
}

/** Registered quantity (sum) per event id. */
async function registeredQtyByEvent(eventIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (eventIds.length === 0) return map;
  const { data } = await supabaseAdmin
    .from('event_registrations')
    .select('event_id, quantity')
    .in('event_id', eventIds);
  for (const r of data ?? []) {
    map.set(r.event_id as string, (map.get(r.event_id as string) ?? 0) + (r.quantity as number));
  }
  return map;
}

export async function listPublishedEvents(limit = 60): Promise<EventWithCounts[]> {
  const { data, error } = await boundedQuery(
  supabaseAdmin
      .from('fundraising_events')
      .select(EVENT_COLUMNS)
      .eq('status', 'published')
      .order('starts_at', { ascending: true })
      .limit(Math.min(limit, 200)),
  );
  if (error || !data) return [];
  return withCounts(data as FundraisingEvent[]);
}

export async function getEventBySlug(slug: string): Promise<EventWithCounts | null> {
  const { data, error } = await supabaseAdmin
    .from('fundraising_events')
    .select(EVENT_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  const [e] = await withCounts([data as FundraisingEvent]);
  return e ?? null;
}

export async function getEventById(id: string): Promise<FundraisingEvent | null> {
  const { data, error } = await supabaseAdmin
    .from('fundraising_events')
    .select(EVENT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return data as FundraisingEvent;
}

export async function listOrganizerEvents(userId: string): Promise<EventWithCounts[]> {
  const { data, error } = await boundedQuery(
  supabaseAdmin
      .from('fundraising_events')
      .select(EVENT_COLUMNS)
      .eq('created_by', userId)
      .order('starts_at', { ascending: false })
      .limit(200),
  );
  if (error || !data) return [];
  return withCounts(data as FundraisingEvent[]);
}

export interface RegistrationWithCheckin extends EventRegistration {
  checked_in: boolean;
}

export async function listEventRegistrations(eventId: string): Promise<RegistrationWithCheckin[]> {
  const { data, error } = await boundedQuery(
  supabaseAdmin
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false }),
  );
  if (error || !data) return [];
  const rows = data as EventRegistration[];
  const { data: checkins } = await supabaseAdmin
    .from('event_checkins')
    .select('registration_id')
    .eq('event_id', eventId);
  const checkedIn = new Set((checkins ?? []).map((c) => c.registration_id as string));
  return rows.map((r) => ({ ...r, checked_in: checkedIn.has(r.id) }));
}

/** Total quantity a user (or email) has already registered for an event. */
export async function attendeeRegisteredQty(eventId: string, attendeeId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('event_registrations')
    .select('quantity')
    .eq('event_id', eventId)
    .eq('attendee_id', attendeeId);
  return (data ?? []).reduce((sum, r) => sum + (r.quantity as number), 0);
}

async function withCounts(rows: FundraisingEvent[]): Promise<EventWithCounts[]> {
  const counts = await registeredQtyByEvent(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, registered_qty: counts.get(r.id) ?? 0 }));
}
