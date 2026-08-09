#!/usr/bin/env node
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

class DisabledRealtimeTransport {
  constructor() {
    throw new Error('Realtime is not part of the campaign builder DB smoke test.');
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requireLoopback(value) {
  const hostname = new URL(value).hostname;
  assert(['127.0.0.1', 'localhost', '::1'].includes(hostname), 'Campaign builder DB smoke only runs against loopback Supabase.');
}

function assertResult(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function run() {
  assert(supabaseUrl && anonKey && serviceRoleKey, 'Supabase URL, anon key, and service role key are required.');
  requireLoopback(supabaseUrl);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: DisabledRealtimeTransport },
  });
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: DisabledRealtimeTransport },
  });
  const anonymous = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: DisabledRealtimeTransport },
  });

  const email = `campaign-builder-${randomUUID()}@example.test`;
  const password = randomBytes(32).toString('base64url');
  let userId = '';
  let campaignId = '';
  let draftId = '';
  let mediaPath = '';
  let sourcePath = '';

  try {
    const created = assertResult(await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Campaign Builder Test' },
    }), 'create campaign-builder persona');
    assert(created.user, 'Campaign-builder persona was not returned.');
    userId = created.user.id;

    const signedIn = assertResult(await client.auth.signInWithPassword({ email, password }), 'sign in campaign-builder persona');
    assert(signedIn.session && signedIn.user?.id === userId, 'Campaign-builder persona session was not established.');

    draftId = randomUUID();
    assertResult(await client.from('campaign_wizard_drafts').insert({
      id: draftId,
      user_id: userId,
      title: 'Recovery support',
      step: 'purpose',
      story_mode: 'guided',
      builder_path: 'guided',
      schema_version: 2,
      source_context: { links: [] },
      form: { title: 'Recovery support' },
      images: [],
      client_ts: Date.now(),
    }), 'insert owner draft');
    assertResult(await client.from('campaign_wizard_drafts').update({
      step: 'beneficiary',
      form: { title: 'Recovery support', forSelf: 'true' },
      client_ts: Date.now() + 1,
    }).eq('id', draftId), 'update owner draft');

    const versions = assertResult(await client
      .from('campaign_wizard_draft_versions')
      .select('id, schema_version, builder_path')
      .eq('draft_id', draftId), 'read owner draft versions');
    assert(versions.length === 2, `Expected 2 draft versions, received ${versions.length}.`);
    assert(versions.every((row) => row.schema_version === 2 && row.builder_path === 'guided'), 'Draft version metadata drifted.');

    const deniedRpc = await client.rpc('create_campaign_from_builder', {
      p_user_id: userId,
      p_slug: `forbidden-${randomUUID()}`,
      p_payload: {},
    });
    assert(deniedRpc.error, 'Authenticated clients must not execute the atomic campaign function directly.');

    mediaPath = `campaigns/${userId}/cover/${randomUUID()}.png`;
    sourcePath = `campaigns/${userId}/sources/${randomUUID()}.txt`;
    assertResult(await admin.storage.from('campaign-media').upload(
      mediaPath,
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      { contentType: 'image/png', upsert: false },
    ), 'upload campaign media');
    assertResult(await admin.storage.from('campaign-source-documents').upload(
      sourcePath,
      new TextEncoder().encode('Verified campaign source context.'),
      { contentType: 'text/plain', upsert: false },
    ), 'upload private campaign source');
    const publicUrl = admin.storage.from('campaign-media').getPublicUrl(mediaPath).data.publicUrl;

    const slug = `builder-smoke-${randomUUID()}`;
    const graph = assertResult(await admin.rpc('create_campaign_from_builder', {
      p_user_id: userId,
      p_slug: slug,
      p_payload: {
        title: 'Community recovery support',
        tagline: 'Help one family rebuild safely.',
        description: 'This verified smoke campaign confirms the complete campaign graph is written atomically.',
        category: 'Community',
        goal_amount: 100000,
        deadline: '',
        status: 'active',
        beneficiary_name: '',
        beneficiary_relationship: '',
        cover_image_url: publicUrl,
        image_urls: [publicUrl],
        location: 'New York - United States',
        visibility: 'unlisted',
        accept_donations: true,
        campaign_path: 'personal',
        builder_path: 'ai',
        beneficiary_type: 'self',
        use_of_funds: [{ label: 'Direct recovery support', amount_cents: 100000 }],
        donation_tiers: [{ label: 'Neighbor', amount_cents: 2500 }],
        faqs: [{ question: 'How will funds be used?', answer: 'Funds support the documented recovery plan.', ai_generated: true }],
        milestones: [{ title: 'Recovery funded', description: 'The full plan can begin.', target_cents: 100000 }],
        source_links: ['https://www.charitme.com/trust-safety'],
        source_documents: [{ name: 'context.txt', mime_type: 'text/plain', size_bytes: 33, storage_path: sourcePath }],
        media: [{ media_type: 'image', storage_path: mediaPath, public_url: publicUrl, alt_text: 'Campaign builder database smoke image' }],
        allow_recurring: true,
        allow_anonymous: true,
        seo_title: 'Community recovery support',
        seo_description: 'Help one family rebuild safely through verified community support.',
        social_title: 'Community recovery support',
        social_description: 'Help one family rebuild safely.',
        cover_image_guidance: 'Use a clear, respectful photo of the people or work involved.',
        policy_accepted_at: new Date().toISOString(),
        schema_version: 2,
        currency: 'USD',
        country_code: 'US',
        evidence_note: 'Source documentation was supplied during campaign creation.',
      },
    }).single(), 'create atomic campaign graph');
    assert(graph?.campaign_id && graph.campaign_slug === slug, 'Atomic campaign function returned an invalid result.');
    campaignId = graph.campaign_id;

    const checks = await Promise.all([
      admin.from('campaigns').select('builder_path, builder_schema_version, use_of_funds, donation_tiers').eq('id', campaignId).single(),
      admin.from('campaign_launch_settings').select('id, currency, country').eq('campaign_id', campaignId),
      admin.from('campaign_faqs').select('id').eq('campaign_id', campaignId),
      admin.from('campaign_milestones').select('id').eq('campaign_id', campaignId),
      admin.from('campaign_media').select('id').eq('campaign_id', campaignId),
      admin.from('campaign_source_documents').select('id').eq('campaign_id', campaignId),
      admin.from('campaign_source_links').select('id').eq('campaign_id', campaignId),
      admin.from('transparency_ledger_items').select('id').eq('campaign_id', campaignId),
      admin.from('audit_logs').select('id').eq('target_id', campaignId),
    ]);
    const campaign = assertResult(checks[0], 'read campaign graph root');
    assert(campaign.builder_path === 'ai' && campaign.builder_schema_version === 2, 'Published builder metadata was not persisted.');
    const launchSettings = assertResult(checks[1], 'read launch settings');
    assert(launchSettings.length === 1 && launchSettings[0].currency === 'usd' && launchSettings[0].country === 'US', 'Campaign currency or country was not persisted.');
    for (const [index, label] of [
      'launch settings', 'FAQ', 'milestone', 'media', 'source document', 'source link', 'evidence', 'audit log',
    ].entries()) {
      const rows = index === 0 ? launchSettings : assertResult(checks[index + 1], `read ${label}`);
      assert(rows.length === 1, `Expected one ${label} row, received ${rows.length}.`);
    }

    const ownerSources = assertResult(await client
      .from('campaign_source_documents')
      .select('id')
      .eq('campaign_id', campaignId), 'owner source metadata read');
    assert(ownerSources.length === 1, 'Campaign owner could not read source metadata.');
    const anonymousSources = await anonymous.from('campaign_source_documents').select('id').eq('campaign_id', campaignId);
    assert(Boolean(anonymousSources.error) || anonymousSources.data.length === 0, 'Anonymous source metadata was readable.');
    const anonymousDownload = await anonymous.storage.from('campaign-source-documents').download(sourcePath);
    assert(anonymousDownload.error, 'Anonymous visitors could download a private campaign source document.');

    process.stdout.write('PASS campaign builder Supabase graph, RLS, versioning, and Storage smoke\n');
  } finally {
    if (campaignId) await admin.from('campaigns').delete().eq('id', campaignId);
    if (draftId) await admin.from('campaign_wizard_drafts').delete().eq('id', draftId);
    if (mediaPath) await admin.storage.from('campaign-media').remove([mediaPath]);
    if (sourcePath) await admin.storage.from('campaign-source-documents').remove([sourcePath]);
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
}

run().catch((error) => {
  process.stderr.write(`Campaign builder DB smoke failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
  process.exit(1);
});
