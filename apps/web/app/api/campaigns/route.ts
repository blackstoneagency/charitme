import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { checkRateLimit } from '../../../lib/rate-limit';
import { getSuspensionState } from '../../../lib/roles';
import { applyCampaignSearch } from '../../../lib/campaign-search';
import { totalPages } from '../../../lib/pagination';
import { PUBLISH_MIN_STORY_CHARS, PUBLISH_MIN_GOAL_CENTS } from '../../../lib/campaign-readiness';
import { likeTerm } from '../../../lib/campaign-search';
import { notExpiredFilter } from '../../../lib/campaign-visibility-core';
import { insertTolerantOfMissingColumns } from '../../../lib/campaign-insert-columns';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

const CreateSchema = z.object({
  title: z.string().min(3).max(100),
  tagline: z.string().max(160).optional(),
  description: z.string().min(1),    // allow short description for drafts
  // 0 is allowed so a DRAFT can honestly record "no goal set yet" instead of the
  // client fabricating a $1 placeholder. Publishing is gated at
  // PUBLISH_MIN_GOAL_CENTS by the superRefine below.
  goalAmount: z.number().int().min(0),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  category: z.enum(CAMPAIGN_CATEGORIES),
  coverImageUrl: z.string().url().nullable().optional(),
  imageUrls: z.array(z.string().url()).max(10).optional(),
  beneficiaryName: z.string().max(120).optional(),
  beneficiaryRelationship: z.string().max(120).optional(),
  evidenceNote: z.string().max(1000).optional(),
  location: z.string().max(120).optional(),
  videoUrl: z.string().url().nullable().optional(),
  // Step 1 of the builder: who is RAISING. Distinct from beneficiary_*, which
  // record who benefits. Defaulted rather than required so an older client — or
  // a draft resumed from before step 1 existed — still publishes.
  campaignPath: z.enum(['personal', 'nonprofit', 'team']).default('personal'),
  // 'draft' saves without publishing; 'active' publishes immediately (default)
  status: z.enum(['draft', 'active']).default('active'),
}).superRefine((v, ctx) => {
  // Publishing must clear the same bar the wizard enforces. Without this the
  // base schema (description ≥ 1 char, goalAmount ≥ 1 cent) let a crafted
  // request publish a live, publicly-indexed, donatable campaign with a
  // one-character story and a $0.01 goal — bypassing the builder entirely.
  // Drafts stay deliberately permissive: they are private and resumable.
  if (v.status !== 'active') return;
  if (v.description.trim().length < PUBLISH_MIN_STORY_CHARS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['description'],
      message: `Story must be at least ${PUBLISH_MIN_STORY_CHARS} characters to publish.`,
    });
  }
  if (v.goalAmount < PUBLISH_MIN_GOAL_CENTS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['goalAmount'],
      message: `Goal must be at least $${(PUBLISH_MIN_GOAL_CENTS / 100).toFixed(2)} to publish.`,
    });
  }
});

export async function POST(request: NextRequest) {
  // 5 campaign creations per user per hour — prevents abuse
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`campaign:${ip}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Suspension was previously displayed and never enforced: staff suspended a
  // fraudulent fundraiser, the admin console showed "Suspended", and nothing in
  // any request path could see the marker (see lib/roles-shared.ts). Creating a
  // campaign is one of the two actions everyone agrees a suspended account must
  // not perform; the other is taking money (guarded in /api/donations).
  const suspension = await getSuspensionState(user.id);
  if (suspension === 'suspended') {
    return NextResponse.json(
      { error: 'This account is suspended and cannot create campaigns. Contact support.', code: 'ACCOUNT_SUSPENDED' },
      { status: 403 },
    );
  }
  if (suspension === 'unknown') {
    return NextResponse.json(
      { error: 'We could not verify your account status. Please try again.', code: 'ACCOUNT_STATUS_UNAVAILABLE' },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { title, tagline, description, goalAmount, deadline, category, coverImageUrl, imageUrls, beneficiaryName, beneficiaryRelationship, evidenceNote, location, videoUrl, status, campaignPath } = parsed.data;

  const baseSlug = slugify(title);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const baseInsert = {
    user_id: user.id,
    slug,
    title,
    tagline: tagline ?? null,
    description,
    goal_amount: goalAmount,
    raised_amount: 0,
    backer_count: 0,
    deadline: deadline ?? null,
    category,
    cover_image_url: coverImageUrl ?? null,
    beneficiary_name: beneficiaryName ?? null,
    beneficiary_relationship: beneficiaryRelationship ?? null,
    location: location ?? null,
    video_url: videoUrl ?? null,
    status: status ?? 'active',
    accept_donations: true,
    visibility: 'public',
  };

  // Insert with the optional columns, retrying without whichever the database
  // says it lacks. Migrations here are applied by the owner rather than by
  // deploy, so `campaign_path` does not exist the moment this code ships —
  // inserting it unconditionally would fail every campaign creation until
  // someone ran the SQL. See lib/campaign-insert-columns.ts.
  //
  // ⚠️ This replaced a hand-rolled fallback that handled `image_urls` ALONE.
  // With two independently-missing columns that shape needs four branches; it
  // would have inserted successfully without images and then failed outright on
  // campaign_path.
  const { result } = await insertTolerantOfMissingColumns(
    {
      ...baseInsert,
      image_urls: imageUrls ?? [],
      campaign_path: campaignPath ?? 'personal',
    },
    // `await`ed rather than returned directly: PostgrestBuilder is a thenable,
    // not a Promise, so returning it loses the result type.
    async (payload) =>
      await supabaseAdmin
        .from('campaigns')
        .insert(payload as typeof baseInsert)
        .select('id, slug')
        .single(),
  );

  const { data, error } = result;

  if (error) {
    console.error('Campaign create failed', error.code, error.message);
    return NextResponse.json(
      { error: 'Campaign could not be saved', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }

  if (evidenceNote?.trim()) {
    const { error: ledgerError } = await supabaseAdmin
      .from('transparency_ledger_items')
      .insert({
        campaign_id: data.id,
        item_type: 'milestone',
        title: 'Organizer evidence note',
        description: evidenceNote.trim(),
        category: 'Trust',
        status: 'published',
      });

    if (ledgerError) {
      console.error('Campaign evidence save failed', ledgerError);
      return NextResponse.json({ error: 'Campaign created, but evidence note could not be saved.', code: 'EVIDENCE_SAVE_FAILED', slug: data.slug }, { status: 500 });
    }
  }

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const q = searchParams.get('q');

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '24', 10)));
  const offset = (page - 1) * limit;
  const location = searchParams.get('location');
  const visibility = searchParams.get('visibility') ?? 'public';
  const sort = searchParams.get('sort') ?? 'raised';
  const sortCol = sort === 'newest' ? 'created_at' : sort === 'backers' ? 'backer_count' : 'raised_amount';
  // Opt-in, not the default: floating featured rows to the top of a `sort=newest`
  // listing would silently stop it being newest-first. Cause pages pass it
  // because their server-rendered first page sorts the same way, and a page-2
  // request with a different sort would duplicate some rows and skip others.
  const featuredFirst = searchParams.get('featured_first') === '1';

  const base = supabaseAdmin
    .from('campaigns')
    // `trust_status`, `nonprofit_verified` and `campaign_health_score` are the
    // fields CampaignCard uses for its Verified badge and countdown. Without
    // them a card rendered from THIS route looks different from the identical
    // campaign server-rendered on a cause page — the badge simply vanishes on
    // everything loaded by "See more campaigns".
    .select('id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, status, location, accept_donations, trust_status, nonprofit_verified, campaign_health_score, featured', { count: 'exact' })
    .eq('status', 'active')
    .eq('visibility', visibility)
    .is('deleted_at', null)
    // `status = 'active'` alone is not "still running": nothing moves a campaign
    // out of `active` when its deadline passes, so this listing returned finished
    // campaigns whose own cards rendered "Ended". Same rule, same helper, as the
    // server-rendered first page — see `notExpiredFilter`.
    .or(notExpiredFilter());

  let query = (featuredFirst ? base.order('featured', { ascending: false }) : base)
    .order(sortCol, { ascending: false })
    .range(offset, offset + limit - 1);

  // A cause spans SEVERAL categories, so this accepts a comma-separated list and
  // filters with `.in()`. A single value still takes the `.eq()` path, so every
  // existing caller is unaffected. Unknown names are dropped rather than passed
  // through — an unrecognised category would otherwise return zero rows and read
  // as "this cause has no campaigns".
  if (category) {
    const wanted = category
      .split(',')
      .map((c) => c.trim())
      .filter((c) => (CAMPAIGN_CATEGORIES as readonly string[]).includes(c));
    if (wanted.length === 1) query = query.eq('category', wanted[0]);
    else if (wanted.length > 1) query = query.in('category', wanted);
    else return NextResponse.json({ error: 'Unknown category', code: 'UNKNOWN_CATEGORY' }, { status: 400 });
  }
  // Escape LIKE wildcards — the API counterpart of the /campaigns page filter.
  const safeLocation = location ? likeTerm(location) : '';
  if (safeLocation) query = query.ilike('location', `%${safeLocation}%`);
  // Tokenized multi-word keyword search across title/tagline/description
  // (ilike leverages the trigram indexes). Each word must match some field.
  query = applyCampaignSearch(query, q);

  // The main query is built with `count: 'exact'`, so `count` is the total number
  // of rows matching ALL of the applied filters (category/location/search),
  // independent of the `.range()` window — exactly what pagination needs.
  const { data, count, error } = await query;
  if (error) {
    console.error('Campaign list failed', error);
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }

  const total = count ?? 0;
  return NextResponse.json({
    campaigns: data ?? [],
    page,
    limit,
    total,
    totalPages: totalPages(total, limit),
  });
}
