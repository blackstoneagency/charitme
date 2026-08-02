import 'server-only';
import { supabaseAdmin } from './supabase';
import {
  parseRules,
  selectMembers,
  type SegmentRules,
  type SegmentContact,
} from './donor-segments-core';

/**
 * Reads and writes for `donor_segments` / `donor_segment_members`, both of which
 * shipped with RLS and foreign keys and neither a reader nor a writer.
 *
 * ⚠️ Same shape as every other admin-client path in this repo: these queries use
 * the service-role client, so `donor_segments_owner_private` does NOT run. Every
 * function here therefore takes the caller's owned nonprofit ids and filters on
 * them explicitly. The policy is the model; this code is the enforcement.
 */

export type SegmentRow = {
  id: string;
  nonprofit_id: string;
  name: string;
  rules: unknown;
  created_at: string;
};

export type Segment = {
  id: string;
  nonprofitId: string;
  name: string;
  rules: SegmentRules;
  createdAt: string;
  memberCount: number;
};

/** `null` means the read FAILED — never conflated with "no segments yet". */
export async function listSegments(nonprofitIds: readonly string[]): Promise<Segment[] | null> {
  if (nonprofitIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('donor_segments')
    .select('id, nonprofit_id, name, rules, created_at')
    .in('nonprofit_id', nonprofitIds)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.warn('[donor-segments] list unavailable', { code: error.code });
    return null;
  }

  const rows = (data ?? []) as SegmentRow[];
  if (rows.length === 0) return [];

  // One grouped count for every segment rather than a query per row.
  const counts = new Map<string, number>();
  const { data: members } = await supabaseAdmin
    .from('donor_segment_members')
    .select('segment_id')
    .in('segment_id', rows.map((r) => r.id))
    .limit(20_000);
  for (const m of members ?? []) {
    const id = m.segment_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return rows.map((row) => ({
    id: row.id,
    nonprofitId: row.nonprofit_id,
    name: row.name,
    rules: parseRules(row.rules),
    createdAt: row.created_at,
    memberCount: counts.get(row.id) ?? 0,
  }));
}

/** Contacts belonging to these nonprofits — the population a segment selects from. */
export async function loadContacts(nonprofitIds: readonly string[]): Promise<SegmentContact[]> {
  if (nonprofitIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('donor_crm_contacts')
    .select('id, email, full_name, tags, lifetime_value_cents, last_donated_at, consent_email, consent_sms')
    .in('nonprofit_id', nonprofitIds)
    .limit(10_000);
  if (error) return [];
  return (data ?? []) as SegmentContact[];
}

/**
 * Recompute membership from the rules and replace it.
 *
 * `donor_segment_members` is a MATERIALISED result, not a source of truth — the
 * rules are. Deleting before inserting is deliberate: a contact who no longer
 * matches has to leave the segment, and an upsert-only refresh would keep
 * emailing people who stopped qualifying months ago.
 *
 * Returns the member count, or `null` if the refresh failed — the caller must
 * not report a number it did not write.
 */
export async function refreshSegmentMembers(
  segmentId: string,
  rules: SegmentRules,
  nonprofitId: string,
): Promise<number | null> {
  const contacts = await loadContacts([nonprofitId]);
  const members = selectMembers(contacts, rules);

  const { error: clearError } = await supabaseAdmin
    .from('donor_segment_members')
    .delete()
    .eq('segment_id', segmentId);
  if (clearError) {
    console.warn('[donor-segments] could not clear members', { code: clearError.code });
    return null;
  }

  if (members.length === 0) return 0;

  const { error: insertError } = await supabaseAdmin
    .from('donor_segment_members')
    .insert(members.map((c) => ({ segment_id: segmentId, contact_id: c.id })));
  if (insertError) {
    console.warn('[donor-segments] could not write members', { code: insertError.code });
    return null;
  }
  return members.length;
}

/** The segment row, only if it belongs to one of these nonprofits. */
export async function getOwnedSegment(
  segmentId: string,
  nonprofitIds: readonly string[],
): Promise<SegmentRow | null> {
  if (nonprofitIds.length === 0) return null;
  const { data, error } = await supabaseAdmin
    .from('donor_segments')
    .select('id, nonprofit_id, name, rules, created_at')
    .eq('id', segmentId)
    .in('nonprofit_id', nonprofitIds)
    .maybeSingle();
  if (error || !data) return null;
  return data as SegmentRow;
}
