import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/volunteers/applicants — applications made TO the signed-in organizer's
// opportunities.
//
// This is the missing half of volunteering. `/api/volunteers/applications` returns
// what *you* applied to, and the decision endpoint could accept or decline — but
// nothing in the product ever listed who had applied to your opportunity, so every
// application sat unread and the decision endpoint had no caller.
//
// Each applicant is joined to their `volunteer_profiles` row (1131 in production,
// previously read by nothing) so the organizer can judge fit on skills and
// availability instead of a bare name.
// ─────────────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const opportunityId = request.nextUrl.searchParams.get('opportunityId');

  // Scope to opportunities this user owns — authorization is by ownership, and
  // doing it here means the applications query can never leak another org's
  // applicants even if the filter below were wrong.
  let ownQuery = supabaseAdmin
    .from('volunteer_opportunities')
    .select('id, slug, title, slots, slots_filled, status')
    .eq('created_by', user.id)
    .is('deleted_at', null);
  if (opportunityId) ownQuery = ownQuery.eq('id', opportunityId);

  const { data: opps, error: oppError } = await ownQuery;
  if (oppError) {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  const opportunities = (opps ?? []) as Row[];
  if (opportunities.length === 0) {
    return NextResponse.json({ opportunities: [], applicants: [] });
  }

  const oppIds = opportunities.map((o) => o.id as string);

  const { data: apps, error: appError } = await supabaseAdmin
    .from('volunteer_applications')
    .select('id, opportunity_id, applicant_user_id, status, message, hours_logged, applied_at, decided_at')
    .in('opportunity_id', oppIds)
    .is('deleted_at', null)
    .order('applied_at', { ascending: false })
    .limit(500);

  if (appError) {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  const applications = (apps ?? []) as Row[];
  const applicantIds = [...new Set(applications.map((a) => a.applicant_user_id as string).filter(Boolean))];

  // Batched lookups rather than per-row queries.
  const [profilesRes, volunteerRes] = await Promise.all([
    applicantIds.length
      ? supabaseAdmin.from('profiles').select('id, full_name, avatar_url').in('id', applicantIds)
      : Promise.resolve({ data: [] as Row[] }),
    applicantIds.length
      ? supabaseAdmin
          .from('volunteer_profiles')
          .select('user_id, headline, bio, skills, interests, location, availability, remote_ok, is_public')
          .in('user_id', applicantIds)
      : Promise.resolve({ data: [] as Row[] }),
  ]);

  const nameById = new Map<string, { name: string | null; avatar: string | null }>();
  for (const p of (profilesRes.data ?? []) as Row[]) {
    nameById.set(p.id as string, {
      name: (p.full_name as string | null) ?? null,
      avatar: (p.avatar_url as string | null) ?? null,
    });
  }

  const volunteerById = new Map<string, Row>();
  for (const v of (volunteerRes.data ?? []) as Row[]) {
    // `is_public` is the volunteer's own choice about being discoverable. An
    // organizer they applied to still needs enough to judge the application, so
    // skills/availability are shown either way — but a private profile's free-text
    // bio is withheld, since that is the part written for a public audience.
    volunteerById.set(v.user_id as string, v);
  }

  const applicants = applications.map((a) => {
    const uid = a.applicant_user_id as string;
    const person = nameById.get(uid);
    const vol = volunteerById.get(uid);
    const isPublic = vol ? vol.is_public !== false : false;
    return {
      id: a.id as string,
      opportunityId: a.opportunity_id as string,
      status: a.status as string,
      message: (a.message as string | null) ?? null,
      hoursLogged: (a.hours_logged as number | null) ?? 0,
      appliedAt: a.applied_at as string,
      decidedAt: (a.decided_at as string | null) ?? null,
      name: person?.name ?? 'Volunteer',
      avatarUrl: person?.avatar ?? null,
      profile: vol
        ? {
            headline: (vol.headline as string | null) ?? null,
            bio: isPublic ? ((vol.bio as string | null) ?? null) : null,
            skills: (vol.skills as string[] | null) ?? [],
            interests: (vol.interests as string[] | null) ?? [],
            location: (vol.location as string | null) ?? null,
            availability: (vol.availability as string | null) ?? null,
            remoteOk: vol.remote_ok !== false,
          }
        : null,
    };
  });

  return NextResponse.json({
    opportunities: opportunities.map((o) => ({
      id: o.id as string,
      slug: o.slug as string,
      title: o.title as string,
      slots: (o.slots as number | null) ?? null,
      slotsFilled: (o.slots_filled as number | null) ?? 0,
      status: o.status as string,
    })),
    applicants,
  });
}
