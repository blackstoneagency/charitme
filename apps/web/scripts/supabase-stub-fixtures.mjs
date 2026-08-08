/**
 * Deterministic fixture rows for `supabase-stub.mjs`.
 *
 * Generated rather than hand-listed for two reasons:
 *
 *  1. Volume. Audit coverage of a data-backed page depends on the page actually
 *     rendering its data-conditional half — lists, tables, charts, pagination,
 *     empty-vs-populated branches. A handful of rows leaves most of that unrendered
 *     and reproduces the "0 violations, measured on nothing" trap recorded in
 *     todo.md. There are 120 campaigns and 400 donations here.
 *
 *  2. Determinism. A sweep that shuffles its own inputs cannot be diffed against
 *     the previous run, so every change looks like a regression. Everything below
 *     derives from a seeded LCG — same rows, same order, every run, forever.
 *
 * These rows are SHAPED like production data and are not production data. They
 * exist to make pixels appear. Never present a result measured against them as
 * evidence about real users, real money, or whether a query is correct.
 */

const USER_ID = '00000000-0000-4000-8000-000000000001';

export const STUB_PERSONAS = [
  {
    key: 'donor',
    id: '00000000-0000-4000-8000-000000000011',
    token: 'stub-donor-access-token',
    email: 'donor-persona@charitme.local',
    name: 'Dana Donor',
    roles: ['donor'],
  },
  {
    key: 'organizer',
    id: '00000000-0000-4000-8000-000000000012',
    token: 'stub-organizer-access-token',
    email: 'organizer-persona@charitme.local',
    name: 'Owen Organizer',
    roles: ['donor', 'organizer'],
  },
  {
    key: 'beneficiary',
    id: '00000000-0000-4000-8000-000000000013',
    token: 'stub-beneficiary-access-token',
    email: 'beneficiary-persona@charitme.local',
    name: 'Bailey Beneficiary',
    roles: ['donor', 'beneficiary'],
  },
  {
    key: 'nonprofit',
    id: '00000000-0000-4000-8000-000000000014',
    token: 'stub-nonprofit-access-token',
    email: 'nonprofit-persona@charitme.local',
    name: 'Nora Nonprofit',
    roles: ['donor', 'nonprofit'],
  },
  {
    key: 'admin',
    id: '00000000-0000-4000-8000-000000000015',
    token: 'stub-admin-access-token',
    email: 'admin-persona@charitme.local',
    name: 'Avery Admin',
    roles: ['donor', 'admin'],
  },
  {
    key: 'super_admin',
    id: USER_ID,
    token: 'stub-access-token',
    email: 'audit-stub@charitme.local',
    name: 'Sam Super Admin',
    roles: ['donor', 'admin', 'super_admin'],
  },
];

/** Seeded LCG (numerical recipes constants) — no dependency, stable across Node versions. */
function rng(seed = 1337) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

/** Stable synthetic uuid so foreign keys line up between tables. */
const uuid = (prefix, n) =>
  `${String(prefix).padEnd(8, '0').slice(0, 8)}-0000-4000-8000-${String(n).padStart(12, '0')}`;

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

const CATEGORIES = [
  'Medical', 'Memorial', 'Emergency', 'Nonprofit', 'Education', 'Animal',
  'Environment', 'Business', 'Community', 'Creative', 'Family', 'Sports',
];

const TITLES = [
  'Help Maria rebuild after the fire', 'Send the Northside robotics team to state',
  'Emergency surgery for Bailey', 'Clean water for Kibera schools',
  'Memorial fund for Coach Alvarez', 'Restock the Eastside food pantry',
  'Wheelchair van for the Okonkwo family', 'Rebuild the community darkroom',
  'Winter coats for 400 students', 'Save the Elm Street tree canopy',
  'Hearing aids for Grandpa Joe', 'Get the co-op bakery through the freeze',
];

const FIRST = ['Ana', 'Marcus', 'Priya', 'Jonah', 'Lena', 'Diego', 'Amara', 'Theo', 'Rosa', 'Kai'];
const LAST = ['Okafor', 'Bennett', 'Nakamura', 'Silva', 'Adeyemi', 'Kowalski', 'Reyes', 'Haddad'];

export function buildFixtures() {
  const rand = rng(20260727);
  const personaUsers = STUB_PERSONAS.map((persona) => ({
    id: persona.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: persona.email,
    email_confirmed_at: daysAgo(400),
    phone: '',
    confirmed_at: daysAgo(400),
    last_sign_in_at: daysAgo(0),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: persona.name },
    identities: [],
    created_at: daysAgo(400),
    updated_at: daysAgo(0),
    is_anonymous: false,
  }));
  const defaultUser = personaUsers.find((user) => user.id === USER_ID);
  if (!defaultUser) throw new Error('The default audit persona is missing.');

  const campaigns = Array.from({ length: 120 }, (_, i) => {
    const goal = (Math.floor(rand() * 90) + 10) * 100_000;
    // Deliberately spread across the progress bar: some barely started, some
    // funded past goal. A page that only ever renders 40%-full bars never
    // exercises the overflow/clamp path in ProgressBar.
    const ratio = [0, 0.04, 0.31, 0.62, 0.88, 1, 1.37][i % 7];
    return {
      id: uuid('camp', i + 1),
      user_id: USER_ID,
      slug: i === 0 ? 'security-header-fixture' : `stub-campaign-${i + 1}`,
      title: `${pick(rand, TITLES)} #${i + 1}`,
      tagline: 'Every contribution moves this a little closer.',
      description:
        'This campaign exists only inside the local audit stub. The copy is long ' +
        'enough to wrap across several lines so that line-height, truncation and ' +
        'text contrast are all exercised the way real body copy would exercise them.',
      category: CATEGORIES[i % CATEGORIES.length],
      goal_amount: goal,
      raised_amount: Math.round(goal * ratio),
      backer_count: Math.floor(rand() * 300),
      deadline: new Date(Date.now() + (i % 60) * 86_400_000).toISOString().slice(0, 10),
      status: ['active', 'active', 'active', 'draft', 'paused', 'completed'][i % 6],
      cover_image_url: `https://picsum.photos/seed/stub-${i + 1}/1200/675`,
      image_urls: [`https://picsum.photos/seed/stub-${i + 1}/1200/675`],
      trust_status: ['Verified', 'Trusted', 'Needs More Info'][i % 3],
      campaign_health_score: 40 + ((i * 7) % 60),
      payout_frozen: i % 29 === 0,
      featured: i % 11 === 0,
      pinned: i % 17 === 0,
      accept_donations: true,
      visibility: 'public',
      deleted_at: null,
      beneficiary_name: i % 4 === 0 ? `${pick(rand, FIRST)} ${pick(rand, LAST)}` : null,
      beneficiary_relationship: i % 4 === 0 ? 'Friend' : null,
      created_at: daysAgo(120 - i),
      updated_at: daysAgo(Math.max(0, 60 - i)),
    };
  });

  const donations = Array.from({ length: 400 }, (_, i) => {
    const campaign = campaigns[i % campaigns.length];
    return {
      id: uuid('dona', i + 1),
      campaign_id: campaign.id,
      donor_id: i % 5 === 0 ? null : USER_ID,
      amount_cents: [500, 1000, 2500, 5000, 10_000, 25_000, 100_000][i % 7],
      // A mix of empty, short and long messages: the long one is what catches a
      // comment card that has no wrapping or overflow rule.
      message: i % 3 === 0
        ? null
        : i % 3 === 1
          ? 'Thinking of you.'
          : 'We have been following this since the beginning and could not be prouder of how the whole neighbourhood turned out. Sending love from three states away.',
      anonymous: i % 6 === 0,
      stripe_payment_intent_id: `pi_stub_${i + 1}`,
      status: ['completed', 'completed', 'completed', 'completed', 'pending', 'refunded'][i % 6],
      payment_method: ['card', 'card', 'apple_pay', 'google_pay', 'bank'][i % 5],
      source: ['direct', 'share', 'email', 'social'][i % 4],
      currency: 'usd',
      is_spam: false,
      source_utm: {},
      refunded_at: i % 6 === 5 ? daysAgo(i % 30) : null,
      refund_reason: i % 6 === 5 ? 'Donor requested' : null,
      receipt_sent_at: daysAgo(i % 45),
      created_at: daysAgo(i % 90),
      updated_at: daysAgo(i % 90),
    };
  });

  const profiles = [
    ...STUB_PERSONAS.map((persona) => ({
      id: persona.id,
      email: persona.email,
      full_name: persona.name,
      avatar_url: null,
      roles: persona.roles,
      identity_verified: true,
      trust_passport_score: 82,
      plan: 'pro',
      org_name: 'Stub Foundation',
      org_tagline: 'Rendering pages since 2026',
      org_website: 'https://example.org',
      bio: 'Fixture profile used by the local audit stub.',
      stripe_customer_id: 'cus_stub',
      stripe_subscription_id: 'sub_stub',
      notification_email: true,
      notification_updates: true,
      notification_marketing: false,
      timezone: 'America/New_York',
      currency: 'usd',
      language: 'en',
      date_format: 'MM/DD/YYYY',
      time_format: '12h',
      show_public_profile: true,
      campaign_recommendations: true,
      stripe_account_id: 'acct_stub',
      stripe_onboarded: true,
      created_at: daysAgo(400),
      updated_at: daysAgo(1),
    })),
    ...Array.from({ length: 60 }, (_, i) => ({
      id: uuid('prof', i + 2),
      email: `donor${i + 2}@charitme.local`,
      full_name: `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`,
      avatar_url: null,
      roles: ['donor'],
      identity_verified: i % 3 === 0,
      trust_passport_score: (i * 13) % 100,
      plan: ['free', 'starter', 'pro'][i % 3],
      created_at: daysAgo(300 - i),
      updated_at: daysAgo(i),
    })),
  ];

  const payouts = Array.from({ length: 40 }, (_, i) => ({
    id: uuid('payo', i + 1),
    campaign_id: campaigns[i % campaigns.length].id,
    user_id: USER_ID,
    amount_cents: (i + 1) * 25_000,
    payout_speed: ['standard', 'same_day', 'instant'][i % 3],
    fee_cents: i * 25,
    status: ['requested', 'approved', 'paid', 'paid', 'failed', 'frozen'][i % 6],
    risk_score: (i * 11) % 100,
    stripe_payout_id: `po_stub_${i + 1}`,
    stripe_transfer_id: `tr_stub_${i + 1}`,
    admin_note: i % 5 === 0 ? 'Held for manual review.' : null,
    note: null,
    created_at: daysAgo(i * 2),
    updated_at: daysAgo(i),
  }));

  const campaign_updates = Array.from({ length: 60 }, (_, i) => ({
    id: uuid('updt', i + 1),
    campaign_id: campaigns[i % campaigns.length].id,
    user_id: USER_ID,
    title: `Week ${i + 1} progress`,
    body:
      'Thank you all so much. We reached the next milestone this week and wanted ' +
      'to share where things stand, what the money has paid for so far, and what ' +
      'is still ahead of us.',
    ai_generated: i % 4 === 0,
    created_at: daysAgo(i * 3),
  }));

  const campaign_payments = [
    {
      id: uuid('paym', 1),
      campaign_id: campaigns[0].id,
      campaign_owner_id: USER_ID,
      donor_id: USER_ID,
      donation_id: donations[0].id,
      processor: 'stripe',
      processor_charge_id: 'ch_stub_1',
      processor_payment_intent_id: 'pi_stub_1',
      processor_checkout_session_id: 'cs_stub_1',
      processor_transfer_id: 'tr_stub_1',
      processor_payout_id: 'po_stub_1',
      gross_amount: 5_000,
      tip_amount: 500,
      platform_fee_amount: 500,
      processor_fee_amount: 175,
      campaign_owner_net_amount: 4_825,
      refunded_amount: 0,
      disputed_amount: 0,
      currency: 'usd',
      payment_status: 'succeeded',
      transfer_status: 'paid',
      payout_status: 'paid',
      refund_status: 'none',
      dispute_status: 'none',
      settlement_status: 'settled',
      reconciliation_status: 'reconciled',
      reconciliation_reason: null,
      created_at: daysAgo(4),
      campaigns: {
        title: campaigns[0].title,
        slug: campaigns[0].slug,
      },
    },
  ];

  const volunteer_opportunities = [
    {
      id: uuid('volu', 1),
      slug: 'stub-community-pantry',
      title: 'Community pantry packing shift',
      org_name: 'Stub Foundation',
      summary: 'Pack grocery boxes for local families.',
      description: 'A populated volunteer fixture for signed-in route certification.',
      location: '123 Main Street',
      is_remote: false,
      starts_at: daysAgo(-14),
      ends_at: daysAgo(-13),
      created_by: USER_ID,
      status: 'active',
      deleted_at: null,
      created_at: daysAgo(20),
      updated_at: daysAgo(1),
    },
  ];

  const volunteer_shifts = [
    {
      id: uuid('vshf', 1),
      opportunity_id: volunteer_opportunities[0].id,
      title: 'Morning packing',
      starts_at: daysAgo(-14),
      ends_at: daysAgo(-13),
      location: '123 Main Street',
      capacity: 20,
      filled_count: 8,
      status: 'open',
      checkin_code: 'STUB01',
      deleted_at: null,
      created_at: daysAgo(10),
      updated_at: daysAgo(1),
    },
  ];

  const volunteer_hours = [
    {
      id: uuid('vhour', 1),
      opportunity_id: volunteer_opportunities[0].id,
      volunteer_user_id: USER_ID,
      checked_in_at: daysAgo(2),
      checked_out_at: daysAgo(2),
      hours: 3,
      status: 'pending',
      deleted_at: null,
      created_at: daysAgo(2),
      updated_at: daysAgo(1),
    },
  ];

  const genericRows = (prefix, count, extra = () => ({})) =>
    Array.from({ length: count }, (_, i) => ({
      id: uuid(prefix, i + 1),
      user_id: USER_ID,
      campaign_id: campaigns[i % campaigns.length].id,
      status: ['open', 'pending', 'resolved', 'active'][i % 4],
      created_at: daysAgo(i),
      updated_at: daysAgo(i),
      ...extra(i),
    }));


  // Rotator eligibility fixtures.
  //
  // The exclusions are invisible without campaigns that SHOULD be excluded: an
  // ended featured campaign and a fully-funded featured one. Plus 22 eligible
  // featured campaigns, which is deliberately more than the old `.limit(20)` —
  // that cap is exactly the bug, and a fixture of 20 or fewer could never show it.
  const ROTATOR_DAY = 86_400_000;
  const rotatorFixtures = [
    {
      key: 'ended',
      deadline: new Date(Date.now() - 2 * ROTATOR_DAY).toISOString(),
      goal_amount: 500000,
      raised_amount: 10000,
    },
    {
      key: 'funded',
      deadline: new Date(Date.now() + 30 * ROTATOR_DAY).toISOString(),
      goal_amount: 500000,
      raised_amount: 500000,
    },
  ];
  rotatorFixtures.forEach((f, i) => {
    campaigns.push({
      ...campaigns[0],
      id: `aaaa${i}aaa-1111-4111-8111-aaaaaaaaaaa${i}`,
      slug: `stub-rotator-${f.key}`,
      title: `Rotator ${f.key} campaign`,
      status: 'active',
      visibility: 'public',
      deleted_at: null,
      featured: true,
      cover_image_url: `https://picsum.photos/seed/rot-${f.key}/1200/675`,
      deadline: f.deadline,
      goal_amount: f.goal_amount,
      raised_amount: f.raised_amount,
    });
  });
  for (let i = 0; i < 22; i++) {
    campaigns.push({
      ...campaigns[0],
      id: `bbbb${String(i).padStart(4, '0')}-2222-4222-8222-bbbbbbbbbbbb`,
      slug: `stub-rotator-live-${i}`,
      title: `Rotator eligible campaign ${i}`,
      status: 'active',
      visibility: 'public',
      deleted_at: null,
      featured: true,
      cover_image_url: `https://picsum.photos/seed/rot-live-${i}/1200/675`,
      deadline: new Date(Date.now() + 30 * ROTATOR_DAY).toISOString(),
      goal_amount: 1000000,
      raised_amount: 1000 * (i + 1),
    });
  }

  // Two campaigns with REAL hex uuids.
  //
  // `uuid('camp', n)` emits `camp0000-…`, and `m`/`p` are not hex — so those ids
  // fail `z.string().uuid()` and every route that validates a uuid rejects them
  // before its own logic runs. That silently makes such routes unexercisable
  // against the stub: the sweep sees 400 INVALID_INPUT and looks like it tested
  // something. These two exist so uuid-validating routes (the portfolio gift,
  // for one) can actually be reached.
  const HEX_CAMPAIGN_IDS = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  ];
  HEX_CAMPAIGN_IDS.forEach((id, i) => {
    const coverImageUrl = `https://picsum.photos/seed/stub-hex-${i + 1}/1200/675`;
    campaigns.push({
      ...campaigns[i],
      id,
      slug: `stub-hex-campaign-${i + 1}`,
      title: `Hex-id stub campaign ${i + 1}`,
      cover_image_url: coverImageUrl,
      image_urls: [coverImageUrl],
      status: 'active',
      visibility: 'public',
      accept_donations: true,
      deadline: null,
      deleted_at: null,
    });
  });

  // ── Public API keys ────────────────────────────────────────────────────────
  //
  // One ACTIVE key and one REVOKED key with the same scopes. The revoked row is
  // the point: it lets a sweep prove that revocation actually denies, which a
  // fixture with only valid credentials can never show.
  const api_keys = [
    {
      id: uuid('akey', 1),
      owner_id: USER_ID,
      name: 'Stub integration key',
      key_hash: 'bb9c54da4d099adbeb6c70318e131f81ae91926565a6452c49726d440d39e4f0',
      scopes: ['campaigns:read', 'donations:read', 'profile:read'],
      last_used_at: null,
      revoked_at: null,
      created_at: daysAgo(10),
    },
    {
      id: uuid('akey', 2),
      owner_id: USER_ID,
      name: 'Stub revoked key',
      key_hash: 'e7c6c8e5197624bcd1dcc1ebe0618e91334dddc156d493ed53a67df581a2567e',
      scopes: ['campaigns:read', 'donations:read', 'profile:read'],
      last_used_at: daysAgo(5),
      revoked_at: daysAgo(1),
      created_at: daysAgo(30),
    },
    {
      id: uuid('akey', 3),
      owner_id: USER_ID,
      name: 'Stub campaigns-only key',
      // Deliberately NARROW. Without a key that lacks a scope, the 403
      // insufficient_scope branch can never be exercised, and an authorisation
      // check that is never observed failing is an assumption.
      key_hash: '3c3fa51181ff6bf5e3d18d26c66d0901263ab96466ea2780bc1d700d9bf560b4',
      scopes: ['campaigns:read'],
      last_used_at: null,
      revoked_at: null,
      created_at: daysAgo(3),
    },
  ];

  // ── Peer-to-peer ───────────────────────────────────────────────────────────
  //
  // A supporter running their own page toward campaign 1's goal, so
  // /campaigns/[slug]/team/[peerSlug] renders against something. `raised_amount`
  // is non-zero on purpose: the page must show a real figure AND, on a
  // deployment without the attribution migration, the notice explaining that the
  // figure is not moving. Both halves need data to be visible.
  const peer_fundraisers = [
    {
      id: uuid('peer', 1),
      parent_campaign_id: campaigns[0].id,
      fundraiser_id: USER_ID,
      slug: 'stub-supporter',
      title: "Ada's page for this campaign",
      goal_amount: 250_000,
      raised_amount: 87_500,
      status: 'active',
      created_at: daysAgo(20),
      updated_at: daysAgo(2),
    },
  ];

  // ── Creator economy ────────────────────────────────────────────────────────
  //
  // One creator page belonging to the default stub user, with a public post and
  // two gated ones. The gated bodies are the literal string
  // `LOCKED-BODY-MUST-NOT-APPEAR`, which exists so a sweep can assert the
  // paywall by grepping the served HTML rather than by trusting the component:
  // rendering a teaser while the full body sits in the RSC payload is the
  // classic bypass, and it looks completely correct on screen.
  const creator_profiles = [
    {
      id: uuid('crtr', 1),
      user_id: USER_ID,
      handle: 'stub-creator',
      display_name: 'Stub Creator',
      bio: 'A creator fixture with tiers and gated posts.',
      hero_image_url: null,
      website_url: null,
      brand_color: '#059669',
      accepts_tips: true,
      accepts_commissions: false,
      created_at: daysAgo(90),
      updated_at: daysAgo(90),
    },
  ];

  const membership_tiers = [
    {
      id: uuid('mtir', 1),
      creator_profile_id: creator_profiles[0].id,
      nonprofit_id: null,
      title: 'Supporter',
      description: 'Early access to updates.',
      amount_cents: 500,
      interval: 'month',
      benefits: ['Early access', 'Name in the credits'],
      active: true,
      created_at: daysAgo(80),
      updated_at: daysAgo(80),
    },
    {
      id: uuid('mtir', 2),
      creator_profile_id: creator_profiles[0].id,
      nonprofit_id: null,
      title: 'Producer',
      description: 'Everything above, plus monthly calls.',
      amount_cents: 5000,
      interval: 'month',
      benefits: ['Monthly call'],
      active: true,
      created_at: daysAgo(80),
      updated_at: daysAgo(80),
    },
  ];

  const exclusive_posts = [
    {
      id: uuid('xpst', 1),
      creator_profile_id: creator_profiles[0].id,
      nonprofit_id: null,
      author_id: USER_ID,
      title: 'A public update',
      body: 'PUBLIC-BODY-IS-VISIBLE — anyone may read this one.',
      visibility: 'public',
      minimum_tier_id: null,
      created_at: daysAgo(3),
      updated_at: daysAgo(3),
    },
    {
      id: uuid('xpst', 2),
      creator_profile_id: creator_profiles[0].id,
      nonprofit_id: null,
      author_id: USER_ID,
      title: 'Members-only update',
      body: 'LOCKED-BODY-MUST-NOT-APPEAR',
      visibility: 'members',
      minimum_tier_id: null,
      created_at: daysAgo(2),
      updated_at: daysAgo(2),
    },
    {
      id: uuid('xpst', 3),
      creator_profile_id: creator_profiles[0].id,
      nonprofit_id: null,
      author_id: USER_ID,
      title: 'Producer-tier update',
      body: 'LOCKED-BODY-MUST-NOT-APPEAR',
      visibility: 'tier',
      minimum_tier_id: membership_tiers[1].id,
      created_at: daysAgo(1),
      updated_at: daysAgo(1),
    },
  ];

  // Deliberately empty: no one has subscribed, which is the real production
  // state until membership checkout ships. An anonymous visitor and a signed-in
  // non-member must both see the two gated posts as locked.
  const member_subscriptions = [];

  const saved_campaigns = campaigns.slice(0, 12).map((campaign, i) => ({
    user_id: USER_ID,
    campaign_id: campaign.id,
    created_at: daysAgo(i),
  }));

  return {
    _user: defaultUser,
    _access_token: 'stub-access-token',
    _personas: STUB_PERSONAS.map((persona, index) => ({
      ...persona,
      user: personaUsers[index],
    })),

    // RPC results the app reads. `null` is a valid PostgREST scalar reply.
    _rpc: {
      increment_campaign_stats: null,
      get_campaign_stats: { total_raised: 4_820_000, total_backers: 1_284 },
    },

    profiles,
    campaigns,
    donations,
    payouts,
    api_keys,
    peer_fundraisers,
    creator_profiles,
    membership_tiers,
    exclusive_posts,
    member_subscriptions,
    saved_campaigns,
    campaign_updates,
    campaign_payments,
    campaign_payment_events: [
      {
        id: uuid('pevt', 1),
        campaign_payment_id: campaign_payments[0].id,
        event_type: 'payment.succeeded',
        event_status: 'processed',
        amount: campaign_payments[0].gross_amount,
        currency: 'usd',
        occurred_at: campaign_payments[0].created_at,
        processor_object_id: campaign_payments[0].processor_payment_intent_id,
        metadata: {},
      },
    ],
    campaign_payment_breakdowns: [
      {
        id: uuid('pbrk', 1),
        campaign_payment_id: campaign_payments[0].id,
        gross_amount: 5_000,
        tip_amount: 500,
        processor_fee_amount: 175,
        platform_fee_amount: 500,
        owner_net_amount: 4_825,
        currency: 'usd',
        status: 'recorded',
        created_at: campaign_payments[0].created_at,
      },
    ],
    campaign_payment_webhook_events: [],
    campaign_payment_admin_notes: [],
    volunteer_opportunities,
    volunteer_shifts,
    volunteer_hours,

    // Long tail: every other table the gated pages touch. These carry only the
    // columns a list view needs. A page that reads a column not present here
    // renders it blank — which is a legitimate audit subject (blank cell, wrong
    // colour) but NOT evidence the column is missing in production.
    // /dashboard/notifications is client-rendered from /api/notifications, which
    // filters on user_id and selects kind/title/body/link/read_at. With no
    // fixture the list came back empty and the page rendered 7 text elements —
    // it appeared in the sweep's "fewer than 15 text elements" report, meaning
    // its entire notification UI (rows, unread state, mark-read controls) went
    // unaudited. Column names follow supabase/schema.sql: kind and title are
    // NOT NULL, read_at is nullable and drives the unread filter.
    // /dashboard/saved reads saved_campaigns (campaign_id, created_at) filtered
    // by user_id, then hydrates each id from `campaigns`. With no fixture the
    // list came back empty and the page rendered 6 text elements — its entire
    // saved-campaign grid (cards, cover art, progress, unsave controls) went
    // unaudited. campaign_id must point at real fixture campaigns or the
    // hydrate step drops the row and the page is empty again.
    saved_campaigns: Array.from({ length: 12 }, (_, i) => ({
      id: uuid('savd', i + 1),
      user_id: USER_ID,
      campaign_id: campaigns[i % campaigns.length].id,
      created_at: daysAgo(i * 2),
    })),

    // /admin/marketing/templates selects an explicit column list and orders by
    // category then name. With no fixture it rendered 5 text elements — the
    // template table, its category grouping and the system-template badge were
    // all unmeasured. `is_system` is varied deliberately: system templates
    // render a distinct badge, so a fixture that was uniformly false would leave
    // that badge unaudited in both themes.
    marketing_email_templates: Array.from({ length: 14 }, (_, i) => {
      const category = ['onboarding', 'donation', 'campaign', 'newsletter', 'reengagement'][i % 5];
      return {
        id: uuid('mtpl', i + 1),
        name: `${category.charAt(0).toUpperCase() + category.slice(1)} template ${i + 1}`,
        category,
        subject: 'Thank you for supporting {{campaign_title}}',
        preview_text: 'A short line that shows in the inbox preview.',
        body: 'Hi {{first_name}}, thank you for backing {{campaign_title}}. '
          + 'Here is where the money has gone so far and what is still ahead.',
        variables: ['first_name', 'campaign_title'],
        is_system: i % 3 === 0,
        created_by: USER_ID,
        created_at: daysAgo(i * 4),
        updated_at: daysAgo(i),
      };
    }),

    notifications: genericRows('notf', 30, (i) => ({
      kind: ['donation', 'comment', 'payout', 'campaign', 'system'][i % 5],
      title: [
        'You received a new donation',
        'Someone commented on your campaign',
        'A payout is on its way',
        'Your campaign was approved',
        'Scheduled maintenance this weekend',
      ][i % 5],
      body: 'Seeded by the audit stub so the notification list renders with rows.',
      link: ['/dashboard/donations', '/dashboard/messages', '/dashboard/payouts', '/dashboard/campaigns', null][i % 5],
      // A third unread, so the unread filter and the mark-all-read control both
      // have something to render rather than collapsing to an empty state.
      read_at: i % 3 === 0 ? null : daysAgo(i),
      meta: {},
    })),

    audit_logs: genericRows('audt', 50, (i) => ({
      action: ['campaign.approve', 'payout.release', 'user.suspend', 'settings.update'][i % 4],
      actor_email: 'audit-stub@charitme.local',
      target_type: 'campaign',
      target_id: uuid('camp', (i % 120) + 1),
      metadata: {},
    })),
    support_cases: genericRows('supp', 30, (i) => ({
      subject: `Case ${i + 1}: donor cannot download a receipt`,
      body: 'Opened by the audit stub so the queue renders with rows.',
      priority: ['low', 'normal', 'high', 'urgent'][i % 4],
      email: `donor${i + 2}@charitme.local`,
    })),
    // Same class of mismatch: the schema has `event_type`, `processed_at` and
    // `processing_error`, not `type`/`processed`/`error`. /admin/audit-log maps
    // webhook rows through actionCategory(e.event_type), so undefined threw
    // "Cannot read properties of undefined (reading 'startsWith')" and that page
    // 500'd out of the sweep too.
    webhook_events: genericRows('whev', 40, (i) => ({
      event_type: ['checkout.session.completed', 'account.updated', 'payout.paid'][i % 3],
      stripe_event_id: `evt_stub_${i + 1}`,
      payload: {},
      processed_at: i % 4 !== 0 ? daysAgo(i % 30) : null,
      processing_error: i % 9 === 0 ? 'Signature verification failed' : null,
    })),
    refunds: genericRows('refn', 20, (i) => ({
      amount_cents: (i + 1) * 1_500,
      reason: 'Donor requested',
      donation_id: uuid('dona', i + 1),
    })),
    // Column names must match supabase/schema.sql exactly. These were `interval`
    // and `next_charge_at`, which exist nowhere in the schema — the real columns
    // are `cadence` (NOT NULL, CHECK weekly|monthly|quarterly|annual) and
    // `next_bill_at`. /donor calls cadenceLabel(r.cadence), so the mismatch threw
    // "Cannot read properties of undefined (reading 'charAt')" and the page 500'd
    // mid-sweep — it was never audited, and the failure looked like a product bug.
    recurring_donations: genericRows('recr', 25, (i) => ({
      amount_cents: [1000, 2500, 5000][i % 3],
      cadence: ['weekly', 'monthly', 'quarterly', 'annual'][i % 4],
      status: ['active', 'active', 'paused', 'cancelled'][i % 4],
      next_bill_at: daysAgo(-((i % 28) + 1)),
      donor_id: USER_ID,
    })),
    donor_messages: genericRows('dmsg', 25, (i) => ({
      body: 'Thank you for the update — is there anything else the family needs?',
      donor_id: USER_ID,
      read: i % 2 === 0,
    })),
    team_members: genericRows('team', 12, (i) => ({
      email: `teammate${i + 1}@charitme.local`,
      role: ['owner', 'editor', 'viewer'][i % 3],
      invited_at: daysAgo(i * 4),
    })),
    campaign_reports: genericRows('rept', 15, (i) => ({
      reason: ['spam', 'fraud', 'inappropriate'][i % 3],
      details: 'Filed by the audit stub.',
    })),
    risk_flags: genericRows('risk', 15, (i) => ({
      severity: ['low', 'medium', 'high'][i % 3],
      reason: 'Velocity above the configured threshold.',
    })),
    announcements: genericRows('annc', 8, (i) => ({
      title: `Platform notice ${i + 1}`,
      body: 'Scheduled maintenance window this weekend.',
      published: true,
    })),
    integration_connections: genericRows('intg', 10, (i) => ({
      provider: ['mailchimp', 'slack', 'salesforce', 'zapier'][i % 4],
      connected: i % 2 === 0,
    })),
    platform_settings: [
      {
        // `id` is the INTEGER 1, matching the real table's
        // `platform_settings_id_check CHECK (id = 1)`. It was a synthetic uuid,
        // so every `.eq('id', 1)` lookup matched nothing and callers silently
        // fell back to their defaults — including the featured-campaign price,
        // which happened to equal the fixture value and so looked correct.
        id: 1,
        key: 'default',
        config: {
          // Deliberately NOT the $5 default: a fixture equal to the fallback
          // cannot distinguish "read the configured price" from "ignored the
          // config and used the default".
          payment: { featuredCampaignPriceCents: 1750 },
          branding: { productName: 'CharitMe' },
          maintenanceMode: false,
          maintenanceMessage: 'We are making CharitMe better. Please check back soon.',
          maintenanceExpectedBackAt: '',
          supportEmail: 'support@charitme.com',
        },
        created_at: daysAgo(200),
        updated_at: daysAgo(1),
      },
    ],
    feature_flags: genericRows('flag', 10, (i) => ({
      key: `flag_${i + 1}`,
      enabled: i % 2 === 0,
      description: 'Fixture flag.',
    })),
    supported_countries: genericRows('ctry', 20, (i) => ({
      code: ['US', 'CA', 'GB', 'AU', 'NZ', 'IE', 'DE', 'FR', 'NL', 'SE'][i % 10],
      name: ['United States', 'Canada', 'United Kingdom', 'Australia', 'New Zealand',
        'Ireland', 'Germany', 'France', 'Netherlands', 'Sweden'][i % 10],
      payouts_supported: true,
      currency: 'usd',
    })),
  };
}

export default buildFixtures;
