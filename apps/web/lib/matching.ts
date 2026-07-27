import 'server-only';
// ─────────────────────────────────────────────────────────────────────────────
// Corporate matching gifts — Supabase data access. Pure logic in `matching-core.ts`.
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from './supabase';
import { boundedQuery } from './query-timeout';
import { reservesCap, type MatchingProgram, type MatchingClaim } from './matching-core';
import { likeTerm } from './campaign-search';

const PROGRAM_COLUMNS =
  'id, sponsor_id, company_name, description, match_ratio, annual_cap_cents, min_donation_cents, categories, currency, status, created_at, updated_at';

export interface ProgramWithSponsor extends MatchingProgram {
  sponsor_name: string | null;
}

export async function listActivePrograms(search?: string): Promise<ProgramWithSponsor[]> {
  let query = supabaseAdmin
    .from('matching_programs')
    .select(PROGRAM_COLUMNS)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(120);
  const safeSearch = search ? likeTerm(search) : '';
  if (safeSearch) query = query.ilike('company_name', `%${safeSearch}%`);

  const { data, error } = await boundedQuery(query);
  if (error || !data) return [];
  return decorate(data as MatchingProgram[]);
}

export async function getProgram(id: string): Promise<ProgramWithSponsor | null> {
  const { data, error } = await supabaseAdmin
    .from('matching_programs')
    .select(PROGRAM_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  const [decorated] = await decorate([data as MatchingProgram]);
  return decorated ?? null;
}

export async function listSponsorPrograms(sponsorId: string): Promise<ProgramWithSponsor[]> {
  const { data, error } = await boundedQuery(
  supabaseAdmin
      .from('matching_programs')
      .select(PROGRAM_COLUMNS)
      .eq('sponsor_id', sponsorId)
      .order('created_at', { ascending: false })
      .limit(200),
  );
  if (error || !data) return [];
  return decorate(data as MatchingProgram[]);
}

/**
 * Matched cents an employee has already reserved (approved + paid) under a
 * program — used to compute their remaining annual cap.
 */
export async function reservedMatchForEmployee(programId: string, employeeId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('matching_claims')
    .select('match_amount_cents, status')
    .eq('program_id', programId)
    .eq('employee_id', employeeId);
  return (data ?? [])
    .filter((r) => reservesCap(r.status as MatchingClaim['status']))
    .reduce((sum, r) => sum + (r.match_amount_cents as number), 0);
}

export interface ClaimWithNames extends MatchingClaim {
  employee_name: string | null;
  employee_email: string | null;
  program_company: string | null;
}

export async function listEmployeeClaims(employeeId: string): Promise<ClaimWithNames[]> {
  const { data, error } = await boundedQuery(
  supabaseAdmin
      .from('matching_claims')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false }),
  );
  if (error || !data) return [];
  return attachNames(data as MatchingClaim[]);
}

export async function listProgramClaims(programId: string): Promise<ClaimWithNames[]> {
  const { data, error } = await boundedQuery(
  supabaseAdmin
      .from('matching_claims')
      .select('*')
      .eq('program_id', programId)
      .order('created_at', { ascending: false }),
  );
  if (error || !data) return [];
  return attachNames(data as MatchingClaim[]);
}

// ── internal helpers ──────────────────────────────────────────────────────────

async function decorate(rows: MatchingProgram[]): Promise<ProgramWithSponsor[]> {
  if (rows.length === 0) return [];
  const sponsorIds = [...new Set(rows.map((r) => r.sponsor_id))];
  const { data: profiles } = await supabaseAdmin.from('profiles').select('id, full_name').in('id', sponsorIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, p.full_name as string | null]));
  return rows.map((r) => ({ ...r, sponsor_name: nameById.get(r.sponsor_id) ?? null }));
}

async function attachNames(rows: MatchingClaim[]): Promise<ClaimWithNames[]> {
  if (rows.length === 0) return [];
  const employeeIds = [...new Set(rows.map((r) => r.employee_id))];
  const programIds = [...new Set(rows.map((r) => r.program_id))];

  const [{ data: profiles }, { data: programs }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, full_name, email').in('id', employeeIds),
    supabaseAdmin.from('matching_programs').select('id, company_name').in('id', programIds),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const companyById = new Map((programs ?? []).map((p) => [p.id as string, p.company_name as string]));

  return rows.map((r) => ({
    ...r,
    employee_name: profileById.get(r.employee_id)?.full_name ?? null,
    employee_email: profileById.get(r.employee_id)?.email ?? null,
    program_company: companyById.get(r.program_id) ?? null,
  }));
}
