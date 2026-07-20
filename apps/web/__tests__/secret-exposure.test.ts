import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SERVER_SECRET_KEYS } from '../lib/env';

/**
 * Static guard against server secrets leaking into the browser bundle.
 *
 * Next.js only inlines `NEXT_PUBLIC_*` env vars into client code, but a
 * `'use client'` module that *references* a server secret (or imports a
 * server-only module like the service-role Supabase client) is a real leak
 * risk and a code smell. This test walks every client module and fails if it
 * touches a known server secret or a server-only client.
 */

const APP_DIR = join(__dirname, '..', 'app');
const COMPONENTS_DIR = join(__dirname, '..', 'components');

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out = out.concat(walk(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function isClientModule(src: string): boolean {
  // Match a leading 'use client' / "use client" directive (allowing comments/blank lines).
  const head = src.slice(0, 400);
  return /^﻿?\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(head);
}

const files = [...walk(APP_DIR), ...walk(COMPONENTS_DIR)];
const clientFiles = files.filter((f) => isClientModule(readFileSync(f, 'utf8')));

// Server-only modules that must never be imported from a client component.
// Matched as exact path suffixes so `lib/supabase-browser` (client-safe) and
// `lib/supabase-server` are NOT flagged — only `lib/supabase` (service role).
const SERVER_ONLY_SUFFIXES = [
  'lib/supabase', // supabaseAdmin — service role key
  'lib/stripe', //   Stripe SDK with secret key
  'lib/openai', //   OpenAI SDK, server-only guarded
];

function importIsServerOnly(spec: string): boolean {
  const clean = spec.replace(/\.(tsx?|jsx?)$/, '');
  return SERVER_ONLY_SUFFIXES.some((suf) => clean === suf || clean.endsWith('/' + suf));
}

describe('secret-exposure guard', () => {
  it('finds client modules to scan (sanity)', () => {
    expect(clientFiles.length).toBeGreaterThan(0);
  });

  it('no client module reads a server secret env var value', () => {
    // Only actual `process.env.<SECRET>` value access leaks — a bare mention of
    // a secret's *name* in UI copy or an error string is harmless.
    const secretSet = new Set(SERVER_SECRET_KEYS);
    const offenders: string[] = [];
    for (const file of clientFiles) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        if (secretSet.has(m[1])) offenders.push(`${file} → process.env.${m[1]}`);
      }
    }
    expect(offenders, `Server secrets read in client code:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no client module reads a non-public process.env var', () => {
    const offenders: string[] = [];
    for (const file of clientFiles) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        const name = m[1];
        if (name === 'NODE_ENV') continue; // inlined + safe
        if (name.startsWith('NEXT_PUBLIC_')) continue;
        offenders.push(`${file} → process.env.${name}`);
      }
    }
    expect(offenders, `Non-public env reads in client code:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no client module imports a server-only module', () => {
    const offenders: string[] = [];
    for (const file of clientFiles) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1];
        if (importIsServerOnly(spec)) {
          offenders.push(`${file} → import '${spec}'`);
        }
      }
    }
    expect(offenders, `Server-only modules imported by client code:\n${offenders.join('\n')}`).toEqual([]);
  });
});
