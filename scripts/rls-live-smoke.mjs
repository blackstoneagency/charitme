#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const personaJson = process.env.CHARITME_RLS_TEST_USERS_JSON;

if (!supabaseUrl || !anonKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

function parsePersonas(value) {
  if (!value) return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('CHARITME_RLS_TEST_USERS_JSON must be valid JSON.');
  }
  if (!Array.isArray(parsed)) throw new Error('CHARITME_RLS_TEST_USERS_JSON must be an array.');
  return parsed.map((persona, index) => {
    if (!persona || typeof persona !== 'object') throw new Error(`Persona ${index + 1} must be an object.`);
    const name = typeof persona.name === 'string' ? persona.name.trim() : '';
    const accessToken = typeof persona.accessToken === 'string' ? persona.accessToken.trim() : '';
    const userId = typeof persona.userId === 'string' ? persona.userId.trim() : '';
    if (!name || !accessToken || !userId) {
      throw new Error(`Persona ${index + 1} requires name, accessToken, and userId.`);
    }
    return { name, accessToken, userId };
  });
}

function clientFor(accessToken) {
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function readIds(client, table, filter) {
  let query = client.from(table).select('id').limit(2);
  if (filter) query = query.eq('id', filter);
  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

async function run() {
  const anonymous = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonymousChecks = [
    ['profiles', 'private profile rows are not anonymous-readable'],
    ['donations', 'donation rows are not anonymous-readable'],
    ['privacy_requests', 'privacy requests are not anonymous-readable'],
  ];
  for (const [table, description] of anonymousChecks) {
    const rows = await readIds(anonymous, table);
    if (rows.length !== 0) throw new Error(`${description}: expected 0 rows, received ${rows.length}.`);
    console.log(`PASS anon ${table}: 0 rows`);
  }

  const personas = parsePersonas(personaJson);
  if (personas.length === 0) {
    console.log('No authenticated personas supplied; anonymous checks completed.');
    return;
  }

  const knownUserIds = new Set(personas.map((persona) => persona.userId));
  for (const persona of personas) {
    const client = clientFor(persona.accessToken);
    const own = await readIds(client, 'profiles', persona.userId);
    if (own.length !== 1) throw new Error(`${persona.name}: expected exactly one own profile row, received ${own.length}.`);
    console.log(`PASS ${persona.name} own profile: 1 row`);

    for (const otherUserId of knownUserIds) {
      if (otherUserId === persona.userId) continue;
      const other = await readIds(client, 'profiles', otherUserId);
      if (other.length !== 0) throw new Error(`${persona.name}: another persona profile was readable.`);
    }
    console.log(`PASS ${persona.name} cross-persona profile isolation`);
  }
}

run().catch((error) => {
  console.error(`RLS live smoke failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exit(1);
});
