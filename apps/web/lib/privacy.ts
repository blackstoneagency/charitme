import 'server-only';
// ─────────────────────────────────────────────────────────────────────────────
// Privacy requests — Supabase data access + real data-export assembly.
// Pure logic lives in `privacy-core.ts`.
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from './supabase';
import { anonymizedProfilePatch, type PrivacyRequest } from './privacy-core';

export interface UserExport {
  generated_at: string;
  user_id: string;
  profile: Record<string, unknown> | null;
  campaigns: unknown[];
  donations: unknown[];
  donor_messages: unknown[];
  saved_campaigns: unknown[];
  volunteer_applications: unknown[];
  sponsorship_requests: unknown[];
  grant_applications: unknown[];
  privacy_requests: unknown[];
}

/** Fetch all rows of `table` matching `column = userId`, tolerating missing tables. */
async function rowsFor(table: string, column: string, userId: string): Promise<unknown[]> {
  const { data, error } = await supabaseAdmin.from(table).select('*').eq(column, userId);
  if (error) return [];
  return data ?? [];
}

/** Assemble a complete export of everything CharitMe holds about a user. */
export async function assembleUserExport(userId: string): Promise<UserExport> {
  const [
    profileRes,
    campaigns,
    donations,
    donorMessages,
    savedCampaigns,
    volunteerApplications,
    sponsorshipRequests,
    grantApplications,
    privacyRequests,
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle(),
    rowsFor('campaigns', 'user_id', userId),
    rowsFor('donations', 'donor_id', userId),
    rowsFor('donor_messages', 'donor_id', userId),
    rowsFor('saved_campaigns', 'user_id', userId),
    rowsFor('volunteer_applications', 'applicant_user_id', userId),
    rowsFor('sponsorship_requests', 'sponsor_id', userId),
    rowsFor('grant_applications', 'applicant_user_id', userId),
    rowsFor('privacy_requests', 'user_id', userId),
  ]);

  return {
    generated_at: new Date().toISOString(),
    user_id: userId,
    profile: (profileRes.data as Record<string, unknown> | null) ?? null,
    campaigns,
    donations,
    donor_messages: donorMessages,
    saved_campaigns: savedCampaigns,
    volunteer_applications: volunteerApplications,
    sponsorship_requests: sponsorshipRequests,
    grant_applications: grantApplications,
    privacy_requests: privacyRequests,
  };
}

export async function listUserRequests(userId: string): Promise<PrivacyRequest[]> {
  const { data } = await supabaseAdmin
    .from('privacy_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as PrivacyRequest[];
}

export interface AdminPrivacyRequest extends PrivacyRequest {
  user_name: string | null;
  user_email: string | null;
}

export async function listAllRequests(statusFilter?: string): Promise<AdminPrivacyRequest[]> {
  let query = supabaseAdmin
    .from('privacy_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (statusFilter) query = query.eq('status', statusFilter);

  const { data } = await query;
  const rows = (data ?? []) as PrivacyRequest[];
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  return rows.map((r) => ({
    ...r,
    user_name: byId.get(r.user_id)?.full_name ?? null,
    user_email: byId.get(r.user_id)?.email ?? null,
  }));
}

/**
 * Complete a deletion request: scrub PII from the profile while retaining
 * financial/transaction records (legal requirement). Returns true on success.
 */
export async function anonymizeUserProfile(userId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update(anonymizedProfilePatch(userId))
    .eq('id', userId);
  return !error;
}
