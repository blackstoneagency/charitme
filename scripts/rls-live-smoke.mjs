#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const personaJson = process.env.CHARITME_RLS_TEST_USERS_JSON;
const requireAuthenticatedPersonas = process.env.REQUIRE_AUTHENTICATED_RLS_PERSONAS === 'true';

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
    const email = typeof persona.email === 'string' ? persona.email.trim() : '';
    const password = typeof persona.password === 'string' ? persona.password : '';
    const userId = typeof persona.userId === 'string' ? persona.userId.trim() : '';
    if (!name || !userId || (!accessToken && (!email || !password))) {
      throw new Error(
        `Persona ${index + 1} requires name, userId, and either accessToken or email/password.`,
      );
    }
    return { name, accessToken, email, password, userId };
  });
}

async function clientFor(persona, personaIndex) {
  if (persona.accessToken) {
    return createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${persona.accessToken}` } },
    });
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: persona.email,
    password: persona.password,
  });
  if (error || !data.session || !data.user) {
    throw new Error(`Persona ${personaIndex + 1}: could not establish a staging test session.`);
  }
  if (data.user.id !== persona.userId) {
    throw new Error(`Persona ${personaIndex + 1}: credentials resolved to an unexpected user.`);
  }
  return client;
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
  if (requireAuthenticatedPersonas && personas.length < 2) {
    throw new Error('At least two authenticated staging personas are required.');
  }
  if (personas.length === 0) {
    console.log('No authenticated personas supplied; anonymous checks completed.');
    return;
  }

  const knownUserIds = new Set(personas.map((persona) => persona.userId));
  for (const [personaIndex, persona] of personas.entries()) {
    const client = await clientFor(persona, personaIndex);
    const own = await readIds(client, 'profiles', persona.userId);
    if (own.length !== 1) {
      throw new Error(
        `Persona ${personaIndex + 1}: expected one own profile row, received ${own.length}.`,
      );
    }
    console.log(`PASS persona ${personaIndex + 1} own profile: 1 row`);

    for (const otherUserId of knownUserIds) {
      if (otherUserId === persona.userId) continue;
      const other = await readIds(client, 'profiles', otherUserId);
      if (other.length !== 0) {
        throw new Error(`Persona ${personaIndex + 1}: another profile was readable.`);
      }
    }
    console.log(`PASS persona ${personaIndex + 1} cross-persona profile isolation`);
  }
}

run().catch((error) => {
  console.error(`RLS live smoke failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exit(1);
});
