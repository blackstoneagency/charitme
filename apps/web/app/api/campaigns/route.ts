import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { formatMoneyShort, isSupportedCurrency } from '@shared/currencies';
import { checkRateLimitDurable } from '../../../lib/rate-limit-durable';
import { getSuspensionState } from '../../../lib/roles';
import { applyCampaignSearch } from '../../../lib/campaign-search';
import { totalPages } from '../../../lib/pagination';
import { PUBLISH_MIN_STORY_CHARS, PUBLISH_MIN_GOAL_CENTS } from '../../../lib/campaign-readiness';
import { likeTerm } from '../../../lib/campaign-search';
import { notExpiredFilter } from '../../../lib/campaign-visibility-core';
import { applyDonatable, campaignColumns } from '../../../lib/campaign-visibility';
import { parseCampaignVideoUrl } from '../../../lib/campaign-video';
import { isSafeStoragePath } from '../../../lib/storage-path';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

function countryCodeFromLocation(location: string | undefined): string {
  const pairs: Readonly<Record<string, string>> = {
    'United States': 'US', 'United Kingdom': 'GB', Canada: 'CA', Australia: 'AU',
    Germany: 'DE', France: 'FR', Ireland: 'IE', 'New Zealand': 'NZ', Spain: 'ES',
    Italy: 'IT', Portugal: 'PT', Japan: 'JP', Singapore: 'SG', Netherlands: 'NL',
  };
  const match = Object.entries(pairs).find(([name]) => location?.includes(name));
  return match?.[1] ?? 'US';
}

const BuilderItemId = z.string().min(1).max(160);
const HttpUrl = z.string().trim().url().max(2048).refine(
  (value) => value.startsWith('https://') || value.startsWith('http://'),
  'Only http and https links are supported.',
);
const UseOfFundsSchema = z.object({
  id: BuilderItemId,
  label: z.string().trim().min(1).max(120),
  amountCents: z.number().int().positive().max(1_000_000_000),
});
const DonationTierSchema = z.object({
  id: BuilderItemId,
  label: z.string().trim().min(1).max(120),
  amountCents: z.number().int().min(100).max(100_000_000),
});
const FaqSchema = z.object({
  id: BuilderItemId,
  question: z.string().trim().min(5).max(300),
  answer: z.string().trim().min(5).max(2000),
  aiGenerated: z.boolean(),
});
const MilestoneSchema = z.object({
  id: BuilderItemId,
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000),
  targetCents: z.number().int().positive().max(1_000_000_000),
});
const SourceDocumentSchema = z.object({
  id: BuilderItemId,
  name: z.string().trim().min(1).max(255),
  mediaType: z.literal('document'),
  mimeType: z.enum([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ]),
  sizeBytes: z.number().int().min(1).max(5 * 1024 * 1024),
  storagePath: z.string().min(1).max(500),
  publicUrl: z.literal(''),
});
const MediaSchema = z.object({
  mediaType: z.literal('image'),
  storagePath: z.string().min(1).max(500),
  publicUrl: z.string().url(),
  altText: z.string().trim().min(1).max(300),
});

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
  videoUrl: z.string().trim().max(2048).nullable().optional().refine(
    (value) => value == null || parseCampaignVideoUrl(value) !== null,
    'Video must be a secure YouTube or Vimeo link.',
  ),
  // Step 1 of the builder: who is RAISING. Distinct from beneficiary_*, which
  // record who benefits. Defaulted rather than required so an older client — or
  // a draft resumed from before step 1 existed — still publishes.
  campaignPath: z.enum(['personal', 'nonprofit', 'team']).default('personal'),
  builderPath: z.enum(['ai', 'guided']),
  beneficiaryType: z.enum(['self', 'other', 'organization']),
  currency: z.string().trim().transform((value) => value.toUpperCase()).refine(isSupportedCurrency, 'Unsupported currency.'),
  useOfFunds: z.array(UseOfFundsSchema).max(12),
  donationTiers: z.array(DonationTierSchema).max(8),
  faqs: z.array(FaqSchema).max(10),
  milestones: z.array(MilestoneSchema).max(10),
  sourceLinks: z.array(z.object({ id: BuilderItemId, url: HttpUrl })).max(5),
  sourceDocuments: z.array(SourceDocumentSchema).max(10),
  media: z.array(MediaSchema).max(10),
  allowRecurring: z.boolean(),
  allowAnonymous: z.boolean(),
  visibility: z.enum(['public', 'unlisted', 'private']),
  acceptDonations: z.boolean(),
  seoTitle: z.string().trim().max(60).optional(),
  seoDescription: z.string().trim().max(160).optional(),
  socialTitle: z.string().trim().max(100).optional(),
  socialDescription: z.string().trim().max(300).optional(),
  coverImageGuidance: z.string().trim().max(500).optional(),
  policyAccepted: z.boolean(),
  schemaVersion: z.number().int().min(2).max(1000),
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
      message: `Goal must be at least ${formatMoneyShort(PUBLISH_MIN_GOAL_CENTS, v.currency)} to publish.`,
    });
  }
  if (!v.location?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['location'], message: 'Location is required to publish.' });
  }
  if (!v.coverImageUrl || v.media.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['coverImageUrl'], message: 'A cover image is required to publish.' });
  }
  if (v.useOfFunds.length === 0 || v.useOfFunds.reduce((sum, item) => sum + item.amountCents, 0) !== v.goalAmount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['useOfFunds'], message: 'The use-of-funds plan must equal the campaign goal.' });
  }
  if (v.beneficiaryType !== 'self' && (!v.beneficiaryName?.trim() || !v.beneficiaryRelationship?.trim())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['beneficiaryName'], message: 'Beneficiary details are required.' });
  }
  if (!v.policyAccepted) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['policyAccepted'], message: 'Policy acknowledgement is required.' });
  }
});

export async function POST(request: NextRequest) {
  // 5 campaign creations per user per hour — prevents abuse
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  if (!(await checkRateLimitDurable(`campaign:${user.id}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

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
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid campaign request', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const { title, evidenceNote, status } = input;
  const ownedMediaPrefix = `campaigns/${user.id}/`;
  if (input.media.some((item) => !isSafeStoragePath(item.storagePath))
      || input.sourceDocuments.some((item) => !isSafeStoragePath(item.storagePath))) {
    return NextResponse.json({ error: 'Uploaded media path is invalid.', code: 'INVALID_MEDIA_PATH' }, { status: 400 });
  }
  if (input.media.some((item) => !item.storagePath.startsWith(ownedMediaPrefix))
      || input.sourceDocuments.some((item) => !item.storagePath.startsWith(`${ownedMediaPrefix}sources/`))) {
    return NextResponse.json({ error: 'Uploaded media does not belong to this account.', code: 'MEDIA_FORBIDDEN' }, { status: 403 });
  }
  const mediaStorage = supabaseAdmin.storage.from('campaign-media');
  const sourceStorage = supabaseAdmin.storage.from('campaign-source-documents');
  if (input.media.some((item) => mediaStorage.getPublicUrl(item.storagePath).data.publicUrl !== item.publicUrl)) {
    return NextResponse.json({ error: 'Campaign media URL does not match its uploaded file.', code: 'INVALID_MEDIA_URL' }, { status: 400 });
  }
  const [mediaObjects, sourceObjects] = await Promise.all([
    Promise.all(input.media.map((item) => mediaStorage.exists(item.storagePath))),
    Promise.all(input.sourceDocuments.map((item) => sourceStorage.exists(item.storagePath))),
  ]);
  if ([...mediaObjects, ...sourceObjects].some((result) => result.error)) {
    return NextResponse.json({ error: 'Uploaded files could not be verified. Please try again.', code: 'STORAGE_UNAVAILABLE' }, { status: 503 });
  }
  if ([...mediaObjects, ...sourceObjects].some((result) => result.data !== true)) {
    return NextResponse.json({ error: 'One or more uploaded files could not be found.', code: 'MEDIA_NOT_FOUND' }, { status: 400 });
  }
  if (status === 'active' && input.coverImageUrl !== input.media[0]?.publicUrl) {
    return NextResponse.json({ error: 'The cover image must be the first uploaded campaign image.', code: 'INVALID_COVER_IMAGE' }, { status: 400 });
  }

  if (status === 'active') {
    const [profileResult, payoutResult, nonprofitResult] = await Promise.all([
      supabaseAdmin.from('profiles').select('full_name, identity_verified').eq('id', user.id).maybeSingle(),
      supabaseAdmin
        .from('connected_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('payouts_enabled', true)
        .eq('charges_enabled', true)
        .eq('details_submitted', true)
        .eq('verification_status', 'verified')
        .not('stripe_account_id', 'is', null)
        .neq('stripe_account_id', '')
        .maybeSingle(),
      input.campaignPath === 'nonprofit'
        ? supabaseAdmin
            .from('nonprofit_profiles')
            .select('id')
            .eq('owner_id', user.id)
            .or('verified.eq.true,verification_status.eq.verified')
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: { id: 'not-required' }, error: null }),
    ]);
    if (profileResult.error || payoutResult.error || nonprofitResult.error) {
      return NextResponse.json(
        { error: 'Launch readiness could not be verified. Please try again.', code: 'READINESS_UNAVAILABLE' },
        { status: 503 },
      );
    }
    const profile = profileResult.data as { full_name?: string | null; identity_verified?: boolean | null } | null;
    const payout = payoutResult.data;
    if (!profile?.full_name?.trim()) {
      return NextResponse.json({ error: 'Complete organizer details before publishing.', code: 'ORGANIZER_INCOMPLETE' }, { status: 400 });
    }
    if (profile?.identity_verified !== true) {
      return NextResponse.json({ error: 'Identity verification is required before publishing.', code: 'IDENTITY_VERIFICATION_REQUIRED' }, { status: 409 });
    }
    if (!payout) {
      return NextResponse.json({ error: 'Complete Stripe payout onboarding before publishing.', code: 'PAYOUT_NOT_READY' }, { status: 409 });
    }
    if (!nonprofitResult.data) {
      return NextResponse.json({ error: 'Organization verification is required before publishing.', code: 'VERIFICATION_REQUIRED' }, { status: 409 });
    }
  }

  const baseSlug = slugify(title) || 'campaign';
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const baseInsert = {
    title: input.title,
    tagline: input.tagline ?? '',
    description: input.description,
    goal_amount: input.goalAmount,
    deadline: input.deadline ?? '',
    category: input.category,
    cover_image_url: input.coverImageUrl ?? '',
    beneficiary_name: input.beneficiaryName ?? '',
    beneficiary_relationship: input.beneficiaryRelationship ?? '',
    beneficiary_type: input.beneficiaryType,
    location: input.location ?? '',
    video_url: input.videoUrl ?? '',
    status: input.status,
    accept_donations: input.acceptDonations,
    visibility: input.visibility,
    builder_path: input.builderPath,
    currency: input.currency,
    country_code: countryCodeFromLocation(input.location),
    use_of_funds: input.useOfFunds.map((item) => ({ label: item.label, amount_cents: item.amountCents })),
    donation_tiers: input.donationTiers.map((item) => ({ label: item.label, amount_cents: item.amountCents })),
    faqs: input.faqs.map((item) => ({ question: item.question, answer: item.answer, ai_generated: item.aiGenerated })),
    milestones: input.milestones.map((item) => ({ title: item.title, description: item.description, target_cents: item.targetCents })),
    source_links: input.sourceLinks.map((item) => item.url),
    source_documents: input.sourceDocuments.map((item) => ({
      name: item.name,
      mime_type: item.mimeType,
      size_bytes: item.sizeBytes,
      storage_path: item.storagePath,
    })),
    media: input.media.map((item) => ({
      media_type: item.mediaType,
      storage_path: item.storagePath,
      public_url: item.publicUrl,
      alt_text: item.altText,
    })),
    allow_recurring: input.allowRecurring,
    allow_anonymous: input.allowAnonymous,
    seo_title: input.seoTitle ?? '',
    seo_description: input.seoDescription ?? '',
    social_title: input.socialTitle ?? '',
    social_description: input.socialDescription ?? '',
    cover_image_guidance: input.coverImageGuidance ?? '',
    policy_accepted_at: input.policyAccepted ? new Date().toISOString() : '',
    schema_version: input.schemaVersion,
    evidence_note: evidenceNote ?? '',
  };

  const { data, error } = await supabaseAdmin
    .rpc('create_campaign_from_builder', {
      p_user_id: user.id,
      p_slug: slug,
      p_payload: {
        ...baseInsert,
        image_urls: input.media.map((item) => item.publicUrl),
        campaign_path: input.campaignPath,
      },
    })
    .single();

  if (error) {
    console.error('Campaign create failed', error.code, error.message);
    return NextResponse.json(
      { error: 'Campaign could not be saved', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }

  const created = data as { campaign_id?: string; campaign_slug?: string } | null;
  if (!created?.campaign_id || !created.campaign_slug) {
    return NextResponse.json({ error: 'Campaign could not be saved', code: 'INVALID_DATABASE_RESPONSE' }, { status: 500 });
  }
  return NextResponse.json({ id: created.campaign_id, slug: created.campaign_slug }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const q = searchParams.get('q');

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '24', 10)));
  const offset = (page - 1) * limit;
  const location = searchParams.get('location');
  const sort = searchParams.get('sort') ?? 'raised';
  const sortCol = sort === 'newest' ? 'created_at' : sort === 'backers' ? 'backer_count' : 'raised_amount';
  // Opt-in, not the default: floating featured rows to the top of a `sort=newest`
  // listing would silently stop it being newest-first. Cause pages pass it
  // because their server-rendered first page sorts the same way, and a page-2
  // request with a different sort would duplicate some rows and skip others.
  const featuredFirst = searchParams.get('featured_first') === '1';

  // Campaigns that cannot take a donation are excluded here too, because THIS
  // route serves pages 2+ of the grids that already exclude them server-side.
  // Filtering only the first page would let a non-donatable campaign reappear on
  // the second click — the same defect the expiry filter was added here to fix.
  //
  // Guarded on a column probe: the migration that adds `payout_ready` is applied
  // by the owner, not by deploy, so before it runs the column does not exist and
  // filtering on it would 42703 the entire listing. `applyDonatable` no-ops in
  // that state, which leaves today's behaviour rather than emptying the API.
  const cols = await campaignColumns();

  const base = applyDonatable(supabaseAdmin
    .from('campaigns')
    // `trust_status`, `nonprofit_verified` and `campaign_health_score` are the
    // fields CampaignCard uses for its Verified badge and countdown. Without
    // them a card rendered from THIS route looks different from the identical
    // campaign server-rendered on a cause page — the badge simply vanishes on
    // everything loaded by "See more campaigns".
    .select('id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, status, location, accept_donations, trust_status, nonprofit_verified, campaign_health_score, featured, is_demo', { count: 'exact' })
    .eq('status', 'active')
    // This is a public, unauthenticated endpoint. A caller-supplied visibility
    // value previously let `?visibility=private` bypass RLS through the service
    // client and enumerate private campaigns.
    .eq('visibility', 'public')
    .is('deleted_at', null)
    // `status = 'active'` alone is not "still running": nothing moves a campaign
    // out of `active` when its deadline passes, so this listing returned finished
    // campaigns whose own cards rendered "Ended". Same rule, same helper, as the
    // server-rendered first page — see `notExpiredFilter`.
    .or(notExpiredFilter()), cols);

  let query = (featuredFirst ? base.order('featured', { ascending: false }) : base)
    .order(sortCol, { ascending: false });
  if (sortCol !== 'created_at') query = query.order('created_at', { ascending: false });
  query = query
    .order('id', { ascending: true })
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
