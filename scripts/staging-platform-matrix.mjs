#!/usr/bin/env node
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  process.stderr.write('Staging platform matrix requires the local Supabase URL, anon key, and service-role key.\n');
  process.exit(1);
}

const hostname = new URL(supabaseUrl).hostname;
if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
  process.stderr.write('Staging platform matrix is destructive and only runs against a loopback Supabase URL.\n');
  process.exit(1);
}

class DisabledRealtimeTransport {
  constructor() {
    throw new Error('Realtime is not part of the staging platform matrix.');
  }
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: DisabledRealtimeTransport },
});

const runId = randomUUID().replaceAll('-', '');
const now = Date.now();
const day = 24 * 60 * 60 * 1000;
const storageObjects = [];
const userIds = [];
const orgIds = [];

const personas = [
  { key: 'donor', roles: ['donor'], plan: 'free', subscriptionStatus: null, periodEnd: null },
  { key: 'organizer', roles: ['organizer'], plan: 'starter', subscriptionStatus: 'active', periodEnd: now + 30 * day },
  { key: 'beneficiary', roles: ['beneficiary'], plan: 'free', subscriptionStatus: null, periodEnd: null },
  { key: 'nonprofit', roles: ['nonprofit'], plan: 'pro', subscriptionStatus: 'active', periodEnd: now + 30 * day },
  { key: 'expired', roles: ['organizer'], plan: 'starter', subscriptionStatus: 'active', periodEnd: now - day },
  { key: 'pastDue', roles: ['organizer'], plan: 'pro', subscriptionStatus: 'past_due', periodEnd: now + 7 * day },
  { key: 'admin', roles: ['admin'], plan: 'enterprise', subscriptionStatus: 'active', periodEnd: now + 30 * day },
  { key: 'superAdmin', roles: ['admin', 'super_admin'], plan: 'enterprise', subscriptionStatus: 'trialing', periodEnd: now + 14 * day },
  { key: 'outsider', roles: ['organizer'], plan: 'free', subscriptionStatus: null, periodEnd: null },
].map((persona) => ({
  ...persona,
  email: `platform-matrix-${persona.key}-${runId}@example.test`,
  password: randomBytes(32).toString('base64url'),
  id: '',
  client: null,
}));

function pass(label) {
  process.stdout.write(`PASS ${label}\n`);
}

function fail(label, detail = '') {
  const suffix = detail ? ` (${detail})` : '';
  throw new Error(`${label}${suffix}`);
}

function errorCode(error) {
  if (!error || typeof error !== 'object') return 'unknown';
  if ('code' in error && typeof error.code === 'string') return error.code;
  if ('status' in error && typeof error.status === 'number') return String(error.status);
  return 'unknown';
}

async function dataOrFail(operation, label) {
  const result = await operation;
  if (result.error) fail(label, errorCode(result.error));
  return result.data;
}

async function rowsOrFail(operation, label) {
  const data = await dataOrFail(operation, label);
  if (!Array.isArray(data)) fail(label, 'expected rows');
  return data;
}

async function expectRows(operation, expected, label) {
  const rows = await rowsOrFail(operation, label);
  if (rows.length !== expected) fail(label, `expected ${expected}, received ${rows.length}`);
  pass(label);
  return rows;
}

async function expectDenied(operation, label) {
  const result = await operation;
  if (!result.error) fail(label, 'operation unexpectedly succeeded');
  pass(label);
}

async function expectNoMutation(operation, label) {
  const result = await operation;
  if (result.error) {
    pass(label);
    return;
  }
  if (Array.isArray(result.data) && result.data.length === 0) {
    pass(label);
    return;
  }
  fail(label, 'mutation unexpectedly changed a row');
}

function newBrowserClient() {
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    realtime: { transport: DisabledRealtimeTransport },
  });
}

function persona(key) {
  const match = personas.find((candidate) => candidate.key === key);
  if (!match) fail('persona lookup', key);
  return match;
}

async function createAccounts() {
  const donor = persona('donor');
  const signupClient = newBrowserClient();
  const signup = await signupClient.auth.signUp({
    email: donor.email,
    password: donor.password,
    options: { data: { full_name: 'Platform Matrix Donor' } },
  });
  if (signup.error || !signup.data.user) fail('auth signup creates a user', errorCode(signup.error));
  donor.id = signup.data.user.id;
  userIds.push(donor.id);
  await signupClient.auth.signOut();

  for (const current of personas.filter((candidate) => candidate.key !== 'donor')) {
    const created = await admin.auth.admin.createUser({
      email: current.email,
      password: current.password,
      email_confirm: true,
      user_metadata: { full_name: `Platform Matrix ${current.key}` },
    });
    if (created.error || !created.data.user) fail(`auth admin creates ${current.key}`, errorCode(created.error));
    current.id = created.data.user.id;
    userIds.push(current.id);
  }

  for (const current of personas) {
    await expectRows(
      admin.from('profiles').select('id').eq('id', current.id),
      1,
      `profile trigger links ${current.key}`,
    );
    await dataOrFail(
      admin.from('profiles').update({
        full_name: `Platform Matrix ${current.key}`,
        roles: current.roles,
        plan: current.plan,
      }).eq('id', current.id),
      `profile assignment ${current.key}`,
    );

    if (current.subscriptionStatus) {
      await dataOrFail(
        admin.from('subscriptions').insert({
          user_id: current.id,
          tier: current.plan,
          plan: current.plan,
          status: current.subscriptionStatus,
          current_period_start: new Date(now - day).toISOString(),
          current_period_end: new Date(current.periodEnd).toISOString(),
          cancel_at_period_end: false,
        }),
        `subscription assignment ${current.key}`,
      );
    }
  }
  pass('signup and profile provisioning');
}

async function establishSessions() {
  for (const current of personas) {
    const client = newBrowserClient();
    const signedIn = await client.auth.signInWithPassword({
      email: current.email,
      password: current.password,
    });
    if (signedIn.error || signedIn.data.user?.id !== current.id || !signedIn.data.session) {
      fail(`password login ${current.key}`, errorCode(signedIn.error));
    }
    const session = await client.auth.getSession();
    if (session.error || session.data.session?.user.id !== current.id) {
      fail(`session lookup ${current.key}`, errorCode(session.error));
    }
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error || refreshed.data.user?.id !== current.id || !refreshed.data.session) {
      fail(`session refresh ${current.key}`, errorCode(refreshed.error));
    }
    current.client = client;
  }
  pass('login and session refresh across all personas');

  const beneficiary = persona('beneficiary');
  await beneficiary.client.auth.signOut();
  const signedOut = await beneficiary.client.auth.getSession();
  if (signedOut.error || signedOut.data.session !== null) fail('signout clears session');
  const signedBackIn = await beneficiary.client.auth.signInWithPassword({
    email: beneficiary.email,
    password: beneficiary.password,
  });
  if (signedBackIn.error || signedBackIn.data.user?.id !== beneficiary.id) fail('login after signout');
  pass('signout and repeat login');

  const donor = persona('donor');
  const generated = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: donor.email,
    options: { redirectTo: 'http://127.0.0.1:3000/auth/callback' },
  });
  const tokenHash = generated.data?.properties?.hashed_token;
  if (generated.error || typeof tokenHash !== 'string' || !tokenHash) {
    fail('password recovery link generation', errorCode(generated.error));
  }
  const recoveryClient = newBrowserClient();
  const verified = await recoveryClient.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
  if (verified.error || verified.data.user?.id !== donor.id || !verified.data.session) {
    fail('password recovery token verification', errorCode(verified.error));
  }
  donor.password = randomBytes(32).toString('base64url');
  const changed = await recoveryClient.auth.updateUser({ password: donor.password });
  if (changed.error || changed.data.user?.id !== donor.id) fail('password recovery update', errorCode(changed.error));
  await recoveryClient.auth.signOut();
  const recovered = await recoveryClient.auth.signInWithPassword({ email: donor.email, password: donor.password });
  if (recovered.error || recovered.data.user?.id !== donor.id) fail('password login after recovery', errorCode(recovered.error));
  donor.client = recoveryClient;
  pass('password recovery and reset');
}

async function verifyProfilesAndPlans() {
  for (const current of personas) {
    const own = await expectRows(
      current.client.from('profiles').select('id, roles, plan').eq('id', current.id),
      1,
      `own profile read ${current.key}`,
    );
    if (own[0].plan !== current.plan || JSON.stringify(own[0].roles) !== JSON.stringify(current.roles)) {
      fail(`profile role and plan linkage ${current.key}`);
    }
    const otherId = personas.find((candidate) => candidate.id !== current.id).id;
    if (!current.roles.includes('admin')) {
      await expectRows(
        current.client.from('profiles').select('id').eq('id', otherId),
        0,
        `cross-profile isolation ${current.key}`,
      );
    }

    const subscriptions = await rowsOrFail(
      current.client.from('subscriptions').select('plan, status, current_period_end').eq('user_id', current.id),
      `subscription read ${current.key}`,
    );
    const expectedSubscriptions = current.subscriptionStatus ? 1 : 0;
    if (subscriptions.length !== expectedSubscriptions) fail(`subscription linkage ${current.key}`);
    if (subscriptions[0] && (subscriptions[0].plan !== current.plan || subscriptions[0].status !== current.subscriptionStatus)) {
      fail(`subscription values ${current.key}`);
    }
    if (current.key === 'expired' && new Date(subscriptions[0].current_period_end).getTime() >= now) {
      fail('expired subscription period');
    }
    if (current.key === 'pastDue' && subscriptions[0].status !== 'past_due') {
      fail('past-due subscription status');
    }
  }

  const donor = persona('donor');
  await expectRows(
    donor.client.from('profiles').update({ bio: 'Disposable matrix profile' }).eq('id', donor.id).select('id'),
    1,
    'ordinary profile update',
  );
  await expectDenied(
    donor.client.from('profiles').update({ roles: ['admin'] }).eq('id', donor.id).select('id'),
    'profile role escalation blocked',
  );
  await expectDenied(
    donor.client.from('profiles').update({ plan: 'enterprise' }).eq('id', donor.id).select('id'),
    'profile plan escalation blocked',
  );
  await expectRows(
    persona('admin').client.from('profiles').select('id').in('id', userIds),
    personas.length,
    'admin profile visibility',
  );
  await expectRows(
    persona('superAdmin').client.from('profiles').select('id').in('id', userIds),
    personas.length,
    'super-admin profile visibility',
  );
  pass('role, plan, expired, and past-due linkage');
}

async function verifyTenants() {
  const organizer = persona('organizer');
  const outsider = persona('outsider');
  const orgRows = await dataOrFail(
    admin.from('organizations').insert([
      { slug: `matrix-a-${runId}`, name: 'Platform Matrix A', plan: 'pro', created_by: organizer.id },
      { slug: `matrix-b-${runId}`, name: 'Platform Matrix B', plan: 'free', created_by: outsider.id },
    ]).select('id, slug'),
    'organization bootstrap',
  );
  if (!Array.isArray(orgRows) || orgRows.length !== 2) fail('organization bootstrap');
  const orgA = orgRows.find((row) => row.slug.startsWith('matrix-a-'));
  const orgB = orgRows.find((row) => row.slug.startsWith('matrix-b-'));
  if (!orgA || !orgB) fail('organization identity');
  orgIds.push(orgA.id, orgB.id);

  await dataOrFail(
    admin.from('organization_members').insert([
      { org_id: orgA.id, user_id: organizer.id, role: 'owner' },
      { org_id: orgA.id, user_id: persona('nonprofit').id, role: 'admin' },
      { org_id: orgA.id, user_id: persona('expired').id, role: 'editor' },
      { org_id: orgA.id, user_id: persona('beneficiary').id, role: 'viewer' },
      { org_id: orgA.id, user_id: persona('pastDue').id, role: 'member' },
      { org_id: orgB.id, user_id: outsider.id, role: 'owner' },
    ]),
    'organization memberships',
  );

  for (const key of ['organizer', 'nonprofit', 'expired', 'beneficiary', 'pastDue']) {
    await expectRows(
      persona(key).client.from('organizations').select('id').in('id', [orgA.id, orgB.id]),
      1,
      `tenant A visibility ${key}`,
    );
  }
  await expectRows(
    outsider.client.from('organizations').select('id').in('id', [orgA.id, orgB.id]),
    1,
    'tenant B visibility',
  );
  await expectRows(
    organizer.client.from('organizations').update({ description: 'Owner update' }).eq('id', orgA.id).select('id'),
    1,
    'organization owner update',
  );
  await expectRows(
    persona('nonprofit').client.from('organizations').update({ website_url: 'https://example.test' }).eq('id', orgA.id).select('id'),
    1,
    'organization admin update',
  );
  await expectNoMutation(
    persona('beneficiary').client.from('organizations').update({ description: 'Viewer overwrite' }).eq('id', orgA.id).select('id'),
    'organization viewer write denied',
  );
  await expectNoMutation(
    outsider.client.from('organizations').update({ description: 'Cross-tenant overwrite' }).eq('id', orgA.id).select('id'),
    'cross-tenant organization write denied',
  );

  const brand = await dataOrFail(
    persona('expired').client.from('brands').insert({
      org_id: orgA.id,
      slug: `matrix-brand-${runId}`,
      name: 'Platform Matrix Brand',
    }).select('id').single(),
    'organization editor brand create',
  );
  await expectRows(
    persona('beneficiary').client.from('brands').select('id').eq('id', brand.id),
    1,
    'organization viewer brand read',
  );
  await expectDenied(
    persona('beneficiary').client.from('brands').insert({ org_id: orgA.id, slug: `viewer-${runId}`, name: 'Denied' }),
    'organization viewer brand write denied',
  );
  await expectDenied(
    outsider.client.from('brands').insert({ org_id: orgA.id, slug: `outsider-${runId}`, name: 'Denied' }),
    'cross-tenant brand write denied',
  );

  const contacts = [];
  for (const [current, orgId] of [[organizer, orgA.id], [outsider, orgB.id]]) {
    const contact = await dataOrFail(
      admin.from('marketing_contacts').update({ org_id: orgId }).eq('user_id', current.id).select('id').single(),
      `marketing tenant assignment ${current.key}`,
    );
    contacts.push(contact.id);
    await dataOrFail(
      admin.from('marketing_events').insert({
        contact_id: contact.id,
        event_type: 'platform_matrix_verified',
        org_id: orgId,
        metadata: { synthetic: true },
      }),
      `marketing event ${current.key}`,
    );
  }
  await expectRows(
    organizer.client.from('marketing_contacts').select('id').in('id', contacts),
    0,
    'tenant clients cannot bypass service-only marketing access',
  );
  await expectRows(
    outsider.client.from('marketing_events').select('id').eq('event_type', 'platform_matrix_verified'),
    0,
    'cross-tenant marketing events remain service-only',
  );
  pass('two-tenant organization and marketing isolation');
  return { orgA, orgB };
}

async function verifyCampaignData() {
  const organizer = persona('organizer');
  const donor = persona('donor');
  const beneficiary = persona('beneficiary');
  const nonprofit = persona('nonprofit');
  const outsider = persona('outsider');

  const nonprofitProfile = await dataOrFail(
    nonprofit.client.from('nonprofit_profiles').insert({
      owner_id: nonprofit.id,
      name: 'Platform Matrix Nonprofit',
      slug: `matrix-nonprofit-${runId}`,
      mission: 'Disposable release verification',
      tax_id: '00-0000000',
    }).select('id, verified, verification_status, tax_receipt_enabled').single(),
    'nonprofit profile create',
  );
  if (nonprofitProfile.verified || nonprofitProfile.verification_status !== 'unverified' || nonprofitProfile.tax_receipt_enabled) {
    fail('nonprofit profile safe defaults');
  }
  await expectDenied(
    nonprofit.client.from('nonprofit_profiles').update({
      verified: true,
      verification_status: 'verified',
      tax_receipt_enabled: true,
    }).eq('id', nonprofitProfile.id).select('id'),
    'nonprofit self-verification blocked',
  );
  await dataOrFail(
    admin.from('nonprofit_profiles').update({
      verified: true,
      verification_status: 'verified',
      tax_receipt_enabled: true,
      verified_at: new Date(now).toISOString(),
    }).eq('id', nonprofitProfile.id),
    'service nonprofit verification',
  );

  await expectDenied(
    nonprofit.client.from('verification_documents').insert({
      user_id: nonprofit.id,
      document_type: 'nonprofit_registration',
      doc_type: 'nonprofit',
      storage_path: `${nonprofit.id}/malicious.png`,
      status: 'approved',
      verified: true,
      is_public: true,
      public_url: 'https://example.test/malicious.png',
    }),
    'verification document self-approval blocked',
  );
  const document = await dataOrFail(
    nonprofit.client.from('verification_documents').insert({
      user_id: nonprofit.id,
      document_type: 'nonprofit_registration',
      doc_type: 'nonprofit',
      storage_path: `${nonprofit.id}/registration.png`,
    }).select('id, status, verified, is_public').single(),
    'verification document pending create',
  );
  if (document.status !== 'pending' || document.verified || document.is_public) fail('verification document safe defaults');
  await expectRows(
    outsider.client.from('verification_documents').select('id').eq('id', document.id),
    0,
    'verification document cross-user isolation',
  );

  await expectDenied(
    organizer.client.from('campaigns').insert({
      user_id: organizer.id,
      slug: `matrix-malicious-${runId}`,
      title: 'Malicious Campaign',
      description: 'Must not publish directly',
      category: 'Community',
      goal_amount: 100000,
      status: 'active',
      featured: true,
      nonprofit_verified: true,
    }),
    'campaign integrity defaults enforced on insert',
  );
  const campaign = await dataOrFail(
    organizer.client.from('campaigns').insert({
      user_id: organizer.id,
      beneficiary_profile_id: beneficiary.id,
      slug: `matrix-campaign-${runId}`,
      title: 'Platform Matrix Campaign',
      description: 'Disposable release verification campaign',
      category: 'Community',
      goal_amount: 100000,
      visibility: 'private',
    }).select('id, status, raised_amount, backer_count, featured, nonprofit_verified').single(),
    'campaign owner create',
  );
  if (campaign.status !== 'draft' || campaign.raised_amount !== 0 || campaign.backer_count !== 0 || campaign.featured || campaign.nonprofit_verified) {
    fail('campaign safe defaults');
  }
  await expectRows(
    organizer.client.from('campaigns').select('id').eq('id', campaign.id),
    1,
    'campaign owner read',
  );
  await expectRows(
    organizer.client.from('campaigns').update({ title: 'Platform Matrix Campaign Updated' }).eq('id', campaign.id).select('id'),
    1,
    'campaign owner ordinary update',
  );
  await expectRows(
    outsider.client.from('campaigns').select('id').eq('id', campaign.id),
    0,
    'private campaign cross-user read denied',
  );
  await expectNoMutation(
    outsider.client.from('campaigns').update({ title: 'Cross-user overwrite' }).eq('id', campaign.id).select('id'),
    'campaign cross-user update denied',
  );
  await expectDenied(
    organizer.client.from('campaigns').update({ raised_amount: 999999, backer_count: 999 }).eq('id', campaign.id).select('id'),
    'campaign financial spoof blocked',
  );
  await expectDenied(
    organizer.client.from('campaigns').update({ featured: true, pinned: true }).eq('id', campaign.id).select('id'),
    'campaign paid placement spoof blocked',
  );
  await expectDenied(
    organizer.client.from('campaigns').update({ nonprofit_verified: true, trust_status: 'Verified' }).eq('id', campaign.id).select('id'),
    'campaign trust spoof blocked',
  );
  await expectDenied(
    organizer.client.from('campaigns').update({ status: 'active' }).eq('id', campaign.id).select('id'),
    'campaign direct publication bypass blocked',
  );
  await expectRows(
    persona('admin').client.from('campaigns').select('id').eq('id', campaign.id),
    1,
    'admin campaign visibility',
  );
  await dataOrFail(
    admin.from('campaigns').update({ nonprofit_verified: true }).eq('id', campaign.id),
    'service campaign verification',
  );

  await dataOrFail(
    admin.from('team_members').insert({
      campaign_id: campaign.id,
      user_id: beneficiary.id,
      role: 'member',
      accepted_at: new Date(now).toISOString(),
    }),
    'campaign team assignment',
  );
  const task = await dataOrFail(
    organizer.client.from('tasks').insert({
      owner_id: organizer.id,
      campaign_id: campaign.id,
      assignee_id: beneficiary.id,
      title: 'Platform matrix task',
      priority: 'high',
    }).select('id').single(),
    'task owner create',
  );
  await expectRows(
    beneficiary.client.from('tasks').select('id').eq('id', task.id),
    1,
    'task assignee read',
  );
  await expectRows(
    outsider.client.from('tasks').select('id').eq('id', task.id),
    0,
    'task cross-user isolation',
  );
  await expectNoMutation(
    beneficiary.client.from('tasks').update({ title: 'Assignee overwrite' }).eq('id', task.id).select('id'),
    'task assignee write denied',
  );
  await expectRows(
    organizer.client.from('tasks').update({
      status: 'done',
      completed_at: new Date(now).toISOString(),
    }).eq('id', task.id).select('id'),
    1,
    'task owner update',
  );

  const message = await dataOrFail(
    organizer.client.from('direct_messages').insert({
      sender_id: organizer.id,
      recipient_id: donor.id,
      campaign_id: campaign.id,
      body: 'Disposable platform matrix message',
    }).select('id').single(),
    'direct message sender create',
  );
  await expectRows(donor.client.from('direct_messages').select('id').eq('id', message.id), 1, 'direct message recipient read');
  await expectRows(organizer.client.from('direct_messages').select('id').eq('id', message.id), 1, 'direct message sender read');
  await expectRows(outsider.client.from('direct_messages').select('id').eq('id', message.id), 0, 'direct message cross-user isolation');

  const donation = await dataOrFail(
    admin.from('donations').insert({
      campaign_id: campaign.id,
      donor_id: donor.id,
      amount_cents: 5000,
      tip_cents: 500,
      processing_fee_cents: 100,
      status: 'completed',
      currency: 'usd',
      message: 'Disposable platform matrix donation',
    }).select('id').single(),
    'service donation create',
  );
  const receipt = await dataOrFail(
    admin.from('tax_receipts').insert({
      donation_id: donation.id,
      donor_id: donor.id,
      nonprofit_id: nonprofitProfile.id,
      receipt_number: `MATRIX-${runId}`,
      amount_cents: 5000,
      currency: 'usd',
      nonprofit_name: 'Platform Matrix Nonprofit',
      nonprofit_ein: '00-0000000',
      campaign_title: 'Platform Matrix Campaign Updated',
      no_goods_or_services: true,
    }).select('id').single(),
    'service tax receipt create',
  );
  await expectRows(donor.client.from('donations').select('id').eq('id', donation.id), 1, 'donation donor read');
  await expectRows(organizer.client.from('donations').select('id').eq('id', donation.id), 1, 'donation campaign-owner read');
  await expectRows(outsider.client.from('donations').select('id').eq('id', donation.id), 0, 'donation cross-user isolation');
  await expectRows(donor.client.from('tax_receipts').select('id').eq('id', receipt.id), 1, 'tax receipt donor read');
  await expectRows(outsider.client.from('tax_receipts').select('id').eq('id', receipt.id), 0, 'tax receipt cross-user isolation');
  await expectRows(persona('admin').client.from('tax_receipts').select('id').eq('id', receipt.id), 1, 'tax receipt admin read');

  pass('campaign, task, message, donation, and tax receipt RLS');
  return { campaign, donation };
}

async function verifyPaymentRls(campaign, donation) {
  const organizer = persona('organizer');
  const donor = persona('donor');
  const outsider = persona('outsider');
  const adminPersona = persona('admin');

  const payment = await dataOrFail(
    admin.from('campaign_payments').insert({
      campaign_id: campaign.id,
      campaign_owner_id: organizer.id,
      donor_id: donor.id,
      processor: 'stripe',
      processor_payment_intent_id: `pi_matrix_${runId}`,
      processor_checkout_session_id: `cs_matrix_${runId}`,
      gross_amount: 5000,
      tip_amount: 500,
      processor_fee_amount: 100,
      platform_fee_amount: 500,
      campaign_owner_net_amount: 4900,
      payment_status: 'succeeded',
      transfer_status: 'created',
      settlement_status: 'available',
      reconciliation_status: 'reconciled',
      paid_at: new Date(now).toISOString(),
    }).select('id').single(),
    'service campaign payment create',
  );

  const breakdown = await dataOrFail(
    admin.from('campaign_payment_breakdowns').insert({
      campaign_payment_id: payment.id,
      campaign_id: campaign.id,
      campaign_owner_id: organizer.id,
      donor_id: donor.id,
      gross_amount: 5000,
      tip_amount: 500,
      processor_fee_amount: 100,
      platform_fee_amount: 500,
      owner_net_amount: 4900,
    }).select('id').single(),
    'service payment breakdown create',
  );

  const transfer = await dataOrFail(
    admin.from('campaign_owner_transfers').insert({
      campaign_payment_id: payment.id,
      campaign_id: campaign.id,
      campaign_owner_id: organizer.id,
      donor_id: donor.id,
      processor_object_id: `tr_matrix_${runId}`,
      gross_amount: 5000,
      owner_net_amount: 4900,
      status: 'created',
    }).select('id').single(),
    'service owner transfer create',
  );

  for (const [table, id] of [
    ['campaign_payments', payment.id],
    ['campaign_payment_breakdowns', breakdown.id],
    ['campaign_owner_transfers', transfer.id],
  ]) {
    await expectRows(organizer.client.from(table).select('id').eq('id', id), 1, `${table} owner read`);
    await expectRows(donor.client.from(table).select('id').eq('id', id), 0, `${table} donor internal-data isolation`);
    await expectRows(outsider.client.from(table).select('id').eq('id', id), 0, `${table} outsider isolation`);
    await expectRows(adminPersona.client.from(table).select('id').eq('id', id), 1, `${table} admin read`);
    await expectNoMutation(
      organizer.client.from(table).update({ metadata: { tampered: true } }).eq('id', id).select('id'),
      `${table} owner mutation denied`,
    );
  }

  const payout = await dataOrFail(
    organizer.client.from('payouts').insert({
      campaign_id: campaign.id,
      user_id: organizer.id,
      amount_cents: 4900,
      payout_speed: 'standard',
    }).select('id').single(),
    'organizer payout request create',
  );
  await expectRows(organizer.client.from('payouts').select('id').eq('id', payout.id), 1, 'payout owner read');
  await expectRows(donor.client.from('payouts').select('id').eq('id', payout.id), 0, 'payout donor isolation');
  await expectRows(outsider.client.from('payouts').select('id').eq('id', payout.id), 0, 'payout outsider isolation');
  await expectRows(adminPersona.client.from('payouts').select('id').eq('id', payout.id), 1, 'payout admin read');
  await expectRows(donor.client.from('donations').select('id').eq('id', donation.id), 1, 'donor retains public-facing payment record');
  pass('donor, organizer, admin, and outsider payment RLS');
}

async function reserveTicket(eventId, ticketId, attendee, quantity) {
  const checkoutToken = randomUUID();
  const reserved = await rowsOrFail(
    admin.rpc('reserve_event_ticket', {
      p_event_id: eventId,
      p_ticket_id: ticketId,
      p_attendee_id: attendee.id,
      p_attendee_email: attendee.email,
      p_attendee_name: `Platform Matrix ${attendee.key}`,
      p_quantity: quantity,
      p_checkout_token: checkoutToken,
    }),
    `reserve ticket ${attendee.key}`,
  );
  if (!reserved[0]?.registration_id) fail(`reserve ticket ${attendee.key}`, 'missing registration id');
  const sessionId = `cs_event_${attendee.key}_${runId}`;
  await dataOrFail(
    admin.rpc('attach_event_ticket_checkout', {
      p_registration_id: reserved[0].registration_id,
      p_checkout_token: checkoutToken,
      p_stripe_checkout_session_id: sessionId,
    }),
    `attach ticket checkout ${attendee.key}`,
  );
  const paymentIntentId = `pi_event_${attendee.key}_${runId}`;
  await dataOrFail(
    admin.rpc('confirm_event_ticket_registration', {
      p_registration_id: reserved[0].registration_id,
      p_stripe_checkout_session_id: sessionId,
      p_stripe_payment_intent_id: paymentIntentId,
    }),
    `confirm ticket ${attendee.key}`,
  );
  return { id: reserved[0].registration_id, paymentIntentId };
}

async function verifyPaidEvents(campaign) {
  const organizer = persona('organizer');
  const donor = persona('donor');
  const beneficiary = persona('beneficiary');
  const outsider = persona('outsider');
  const start = new Date(now + 14 * day).toISOString();
  const end = new Date(now + 14 * day + 3 * 60 * 60 * 1000).toISOString();

  const event = await dataOrFail(
    organizer.client.from('fundraising_events').insert({
      created_by: organizer.id,
      campaign_id: campaign.id,
      title: 'Platform Matrix Gala',
      slug: `platform-matrix-gala-${runId}`,
      event_type: 'gala',
      starts_at: start,
      ends_at: end,
      capacity: 10,
      status: 'published',
    }).select('id').single(),
    'event organizer create',
  );
  const ticket = await dataOrFail(
    organizer.client.from('event_tickets').insert({
      event_id: event.id,
      title: 'General admission',
      price_cents: 2500,
      quantity_limit: 10,
    }).select('id').single(),
    'paid ticket organizer create',
  );

  await expectDenied(
    donor.client.from('event_registrations').insert({
      event_id: event.id,
      ticket_id: ticket.id,
      attendee_id: donor.id,
      amount_cents: 2500,
      status: 'confirmed',
    }),
    'paid registration direct insert denied',
  );
  await expectDenied(
    donor.client.rpc('reserve_event_ticket', {
      p_event_id: event.id,
      p_ticket_id: ticket.id,
      p_attendee_id: donor.id,
      p_attendee_email: donor.email,
      p_attendee_name: 'Browser bypass',
      p_quantity: 1,
      p_checkout_token: randomUUID(),
    }),
    'ticket reservation RPC browser access denied',
  );

  const donorRegistration = await reserveTicket(event.id, ticket.id, donor, 2);
  const beneficiaryRegistration = await reserveTicket(event.id, ticket.id, beneficiary, 1);
  await expectRows(donor.client.from('event_registrations').select('id').eq('id', donorRegistration.id), 1, 'ticket attendee read');
  await expectRows(organizer.client.from('event_registrations').select('id').in('id', [donorRegistration.id, beneficiaryRegistration.id]), 2, 'ticket organizer attendee read');
  await expectRows(outsider.client.from('event_registrations').select('id').in('id', [donorRegistration.id, beneficiaryRegistration.id]), 0, 'ticket outsider isolation');

  const donorDisputeId = `dp_event_donor_${runId}`;
  await dataOrFail(admin.rpc('apply_event_ticket_dispute', {
    p_stripe_payment_intent_id: donorRegistration.paymentIntentId,
    p_stripe_dispute_id: donorDisputeId,
    p_outcome: 'opened',
  }), 'ticket dispute open');
  await dataOrFail(admin.rpc('apply_event_ticket_dispute', {
    p_stripe_payment_intent_id: donorRegistration.paymentIntentId,
    p_stripe_dispute_id: donorDisputeId,
    p_outcome: 'won',
  }), 'ticket dispute won');

  const beneficiaryDisputeId = `dp_event_beneficiary_${runId}`;
  await dataOrFail(admin.rpc('apply_event_ticket_dispute', {
    p_stripe_payment_intent_id: beneficiaryRegistration.paymentIntentId,
    p_stripe_dispute_id: beneficiaryDisputeId,
    p_outcome: 'opened',
  }), 'second ticket dispute open');
  await dataOrFail(admin.rpc('apply_event_ticket_dispute', {
    p_stripe_payment_intent_id: beneficiaryRegistration.paymentIntentId,
    p_stripe_dispute_id: beneficiaryDisputeId,
    p_outcome: 'lost',
  }), 'ticket dispute lost');
  await dataOrFail(admin.rpc('apply_event_ticket_refund', {
    p_stripe_payment_intent_id: donorRegistration.paymentIntentId,
    p_refunded_cents: 5000,
  }), 'ticket full refund');

  const finalRows = await rowsOrFail(
    admin.from('event_registrations').select('id,status,dispute_status').in('id', [donorRegistration.id, beneficiaryRegistration.id]),
    'ticket final lifecycle read',
  );
  const donorFinal = finalRows.find((row) => row.id === donorRegistration.id);
  const beneficiaryFinal = finalRows.find((row) => row.id === beneficiaryRegistration.id);
  if (donorFinal?.status !== 'refunded' || donorFinal?.dispute_status !== 'won') fail('ticket refund after won dispute state');
  if (beneficiaryFinal?.status !== 'cancelled' || beneficiaryFinal?.dispute_status !== 'lost') fail('ticket lost dispute state');
  const inventory = await dataOrFail(admin.from('event_tickets').select('sold_count').eq('id', ticket.id).single(), 'ticket inventory read');
  if (inventory.sold_count !== 0) fail('ticket inventory released exactly once', `received ${inventory.sold_count}`);
  pass('paid event inventory, checkout, refund, dispute, and RLS lifecycle');
}

async function verifyVolunteerHours(campaign) {
  const organizer = persona('organizer');
  const donor = persona('donor');
  const outsider = persona('outsider');
  const start = new Date(now + day).toISOString();
  const end = new Date(now + day + 2 * 60 * 60 * 1000).toISOString();

  const opportunity = await dataOrFail(
    organizer.client.from('volunteer_opportunities').insert({
      slug: `platform-matrix-volunteer-${runId}`,
      title: 'Platform Matrix Volunteer Shift',
      org_name: 'Platform Matrix',
      campaign_id: campaign.id,
      status: 'open',
      created_by: organizer.id,
    }).select('id').single(),
    'volunteer opportunity organizer create',
  );
  const shift = await dataOrFail(
    organizer.client.from('volunteer_shifts').insert({
      opportunity_id: opportunity.id,
      title: 'Sorting donations',
      starts_at: start,
      ends_at: end,
      capacity: 10,
      checkin_code: `MATRIX${runId.slice(0, 6)}`,
      created_by: organizer.id,
    }).select('id').single(),
    'volunteer shift organizer create',
  );
  await expectRows(donor.client.from('volunteer_shifts').select('id,title').eq('id', shift.id), 1, 'volunteer safe shift read');
  await expectDenied(donor.client.from('volunteer_shifts').select('checkin_code').eq('id', shift.id), 'volunteer check-in code hidden from browser roles');

  const hours = await dataOrFail(
    donor.client.from('volunteer_hours').insert({
      shift_id: shift.id,
      opportunity_id: opportunity.id,
      volunteer_user_id: donor.id,
      checked_in_at: start,
      checked_out_at: end,
      hours: 2,
      source: 'check_in',
    }).select('id,status').single(),
    'volunteer hours create',
  );
  if (hours.status !== 'pending') fail('volunteer hours safe default');
  await expectDenied(
    donor.client.from('volunteer_hours').update({ status: 'verified' }).eq('id', hours.id).select('id'),
    'volunteer self-verification blocked',
  );
  const verified = await dataOrFail(
    organizer.client.from('volunteer_hours').update({ status: 'verified' }).eq('id', hours.id).select('status,verified_by').single(),
    'volunteer organizer verification',
  );
  if (verified.status !== 'verified' || verified.verified_by !== organizer.id) fail('volunteer verification attribution');
  await expectRows(donor.client.from('volunteer_hours').select('id').eq('id', hours.id), 1, 'volunteer own hours read');
  await expectRows(organizer.client.from('volunteer_hours').select('id').eq('id', hours.id), 1, 'volunteer organizer hours read');
  await expectRows(outsider.client.from('volunteer_hours').select('id').eq('id', hours.id), 0, 'volunteer hours outsider isolation');
  pass('volunteer shifts, check-in privacy, verified hours, and RLS');
}

async function upload(client, bucket, path, contentType, label) {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const result = await client.storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
  if (result.error) fail(label, errorCode(result.error));
  storageObjects.push({ bucket, path });
  pass(label);
}

async function expectStorageDenied(operation, label) {
  const result = await operation;
  if (!result.error) fail(label, 'storage operation unexpectedly succeeded');
  pass(label);
}

async function expectSignedUrl(client, bucket, path, label) {
  const result = await client.storage.from(bucket).createSignedUrl(path, 60);
  if (result.error || typeof result.data?.signedUrl !== 'string' || !result.data.signedUrl) {
    fail(label, errorCode(result.error));
  }
  pass(label);
}

async function verifyStorage(campaign) {
  const organizer = persona('organizer');
  const donor = persona('donor');
  const nonprofit = persona('nonprofit');
  const outsider = persona('outsider');
  const mediaPath = `${organizer.id}/matrix-${runId}.png`;
  await upload(organizer.client, 'campaign-media', mediaPath, 'image/png', 'campaign media owner upload');
  await expectStorageDenied(
    outsider.client.storage.from('campaign-media').upload(`${organizer.id}/outsider-${runId}.png`, new Uint8Array([1]), { contentType: 'image/png' }),
    'campaign media cross-owner upload denied',
  );
  const publicDownload = await outsider.client.storage.from('campaign-media').download(mediaPath);
  if (publicDownload.error || !publicDownload.data) fail('campaign media public read', errorCode(publicDownload.error));
  pass('campaign media public read');

  const verificationPath = `${nonprofit.id}/matrix-${runId}.png`;
  await upload(nonprofit.client, 'verification-documents', verificationPath, 'image/png', 'verification document owner upload');
  await expectSignedUrl(nonprofit.client, 'verification-documents', verificationPath, 'verification document owner signed URL');
  await expectSignedUrl(persona('admin').client, 'verification-documents', verificationPath, 'verification document admin signed URL');
  await expectStorageDenied(
    outsider.client.storage.from('verification-documents').createSignedUrl(verificationPath, 60),
    'verification document cross-user signed URL denied',
  );
  await expectStorageDenied(
    nonprofit.client.storage.from('verification-documents').upload(`${nonprofit.id}/matrix-${runId}.txt`, new Uint8Array([1]), { contentType: 'text/plain' }),
    'verification document MIME restriction',
  );

  const receiptPath = `${donor.id}/${campaign.id}/matrix-${runId}.png`;
  await upload(donor.client, 'receipts', receiptPath, 'image/png', 'receipt owner upload');
  await expectSignedUrl(donor.client, 'receipts', receiptPath, 'receipt donor signed URL');
  await expectSignedUrl(organizer.client, 'receipts', receiptPath, 'receipt campaign-owner signed URL');
  await expectStorageDenied(
    outsider.client.storage.from('receipts').createSignedUrl(receiptPath, 60),
    'receipt cross-user signed URL denied',
  );

  const avatarPath = `${donor.id}/matrix-${runId}.png`;
  await upload(donor.client, 'avatars', avatarPath, 'image/png', 'avatar owner upload');
  await expectStorageDenied(
    outsider.client.storage.from('avatars').upload(`${donor.id}/outsider-${runId}.png`, new Uint8Array([1]), { contentType: 'image/png' }),
    'avatar cross-owner upload denied',
  );
  pass('storage ownership, privacy, signed URL, and MIME boundaries');
}

async function cleanup() {
  for (const { bucket, path } of storageObjects.reverse()) {
    await admin.storage.from(bucket).remove([path]);
  }
  if (userIds.length > 0) await admin.from('marketing_contacts').delete().in('user_id', userIds);
  if (orgIds.length > 0) await admin.from('organizations').delete().in('id', orgIds);
  for (const userId of userIds.reverse()) {
    await admin.auth.admin.deleteUser(userId);
  }
}

async function run() {
  try {
    await createAccounts();
    await establishSessions();
    await verifyProfilesAndPlans();
    await verifyTenants();
    const { campaign, donation } = await verifyCampaignData();
    await verifyPaymentRls(campaign, donation);
    await verifyPaidEvents(campaign);
    await verifyVolunteerHours(campaign);
    await verifyStorage(campaign);
    pass('staging platform matrix complete');
  } finally {
    await cleanup();
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  process.stderr.write(`Staging platform matrix failed: ${message}\n`);
  process.exit(1);
});
