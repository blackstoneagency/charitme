#!/usr/bin/env node
/**
 * Replace perceptually duplicated campaign covers with unique first-party art.
 *
 *   node scripts/fix-image-dupes.mjs [--threshold 5] [--apply]
 *
 * The dry run hashes every current cover and reports proposed repairs. Applying
 * writes only deterministic CharitMe `/media/subject` URLs; this tool never adds
 * an unlicensed stock provider or overwrites the first image in a duplicate set.
 */
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 && process.argv[index + 1] ? Number(process.argv[index + 1]) : fallback;
};
const THRESHOLD = arg('threshold', 5);
const APPLY = process.argv.includes('--apply');

function env(key) {
  if (process.env[key]) return process.env[key];
  try {
    const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    const match = text.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'));
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}

const SUPABASE_URL = env('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}
const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };

async function differenceHash(buffer) {
  const pixels = await sharp(buffer).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits = (bits << 1n) | (pixels[y * 9 + x] > pixels[y * 9 + x + 1] ? 1n : 0n);
    }
  }
  return bits;
}

function hamming(first, second) {
  let value = first ^ second;
  let count = 0;
  while (value) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}

async function hashUrl(url) {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) return null;
  return differenceHash(Buffer.from(await response.arrayBuffer()));
}

async function mapLimit(items, limit, operation) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await operation(items[index]);
    }
  }));
  return output;
}

const response = await fetch(
  `${SUPABASE_URL}/rest/v1/campaigns?select=id,slug,category,cover_image_url&cover_image_url=not.is.null&order=created_at.asc&limit=1000`,
  { headers, signal: AbortSignal.timeout(30_000) },
);
if (!response.ok) throw new Error(`Campaign read failed with HTTP ${response.status}`);
const rows = await response.json();
process.stdout.write(`Hashing ${rows.length} campaign covers...\n`);

const hashed = (await mapLimit(rows, 12, async (row) => {
  const imageHash = await hashUrl(row.cover_image_url).catch(() => null);
  return imageHash === null ? null : { ...row, imageHash };
})).filter(Boolean);

const kept = [];
const conflicts = [];
for (const row of hashed) {
  const clash = kept.find((candidate) => hamming(candidate.imageHash, row.imageHash) <= THRESHOLD);
  if (clash) conflicts.push({ ...row, clashesWith: clash.slug });
  else kept.push(row);
}

const updates = conflicts.map((row) => {
  const query = new URLSearchParams({
    category: row.category?.trim() || 'Community',
    key: `repair-${row.slug || row.id}-${row.id}`,
  });
  return {
    id: row.id,
    slug: row.slug,
    clashesWith: row.clashesWith,
    cover: `https://www.charitme.com/media/subject?${query}`,
  };
});

process.stdout.write(`Distinct covers kept: ${kept.length}; duplicate covers to repair: ${updates.length}\n`);
if (updates.length > 0) {
  process.stdout.write(`${updates.map((update) => `  ${update.slug} conflicts with ${update.clashesWith}`).join('\n')}\n`);
}
if (updates.length === 0) process.exit(0);
if (!APPLY) {
  process.stdout.write(`DRY RUN: ${updates.length} update(s). Re-run with --apply.\n`);
  process.exit(0);
}

let failures = 0;
for (const update of updates) {
  const patch = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?id=eq.${encodeURIComponent(update.id)}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ cover_image_url: update.cover, image_urls: [update.cover] }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!patch.ok) failures++;
}

if (failures > 0) throw new Error(`${failures} campaign cover repair(s) failed`);
process.stdout.write(`Applied ${updates.length} unique first-party replacement cover(s).\n`);
