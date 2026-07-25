#!/usr/bin/env node
/**
 * Perceptual near-duplicate detection over campaign cover **binaries** (IMG-06).
 *
 * The existing audit only proved URL-level uniqueness — two different URLs can
 * still resolve to visually identical images. This downloads every cover, reduces
 * it to a 9x8 greyscale, computes a 64-bit dHash (difference hash), and reports
 * any pair within `--threshold` Hamming distance as a near-duplicate.
 *
 *   node scripts/audit-image-dupes.mjs [--threshold 5] [--limit 500] [--concurrency 12]
 *
 * Exits 1 if near-duplicates are found, so it can gate CI.
 */
import sharp from 'sharp';
import fs from 'node:fs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : dflt;
};
const THRESHOLD = arg('threshold', 5);
const LIMIT = arg('limit', 500);
const CONCURRENCY = arg('concurrency', 12);

function env(key) {
  if (process.env[key]) return process.env[key];
  try {
    const txt = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    const m = txt.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}

/** 64-bit dHash: compare each pixel to its right neighbour on a 9x8 greyscale. */
async function dhash(buf) {
  const px = await sharp(buf).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = px[y * 9 + x];
      const right = px[y * 9 + x + 1];
      bits = (bits << 1n) | (left > right ? 1n : 0n);
    }
  }
  return bits;
}

const hamming = (a, b) => {
  let x = a ^ b, n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
};

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }));
  return out;
}

const url = env('NEXT_PUBLIC_SUPABASE_URL');
const key = env('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !key) { console.error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'); process.exit(2); }

const res = await fetch(`${url}/rest/v1/campaigns?select=slug,cover_image_url&cover_image_url=not.is.null&limit=${LIMIT}`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const rows = await res.json();
console.log(`Fetched ${rows.length} campaign covers. Hashing (concurrency ${CONCURRENCY})…`);

let failed = 0;
const hashes = await mapLimit(rows, CONCURRENCY, async (r) => {
  try {
    const img = await fetch(r.cover_image_url, { redirect: 'follow' });
    if (!img.ok) { failed++; return null; }
    const buf = Buffer.from(await img.arrayBuffer());
    return { slug: r.slug, url: r.cover_image_url, hash: await dhash(buf) };
  } catch { failed++; return null; }
});

const ok = hashes.filter(Boolean);
console.log(`Hashed ${ok.length} images (${failed} unreachable).`);

// Exact-binary duplicates first, then perceptual near-duplicates.
const byHash = new Map();
for (const h of ok) {
  const k = h.hash.toString();
  if (!byHash.has(k)) byHash.set(k, []);
  byHash.get(k).push(h);
}
const exact = [...byHash.values()].filter((g) => g.length > 1);

const near = [];
for (let i = 0; i < ok.length; i++) {
  for (let j = i + 1; j < ok.length; j++) {
    const d = hamming(ok[i].hash, ok[j].hash);
    if (d > 0 && d <= THRESHOLD) near.push({ a: ok[i].slug, b: ok[j].slug, d });
  }
}

console.log(`\nExact-identical image groups: ${exact.length}`);
for (const g of exact.slice(0, 10)) console.log(`  x${g.length}: ${g.map((x) => x.slug).join(', ')}`);
console.log(`Near-duplicate pairs (Hamming <= ${THRESHOLD}): ${near.length}`);
for (const p of near.slice(0, 10)) console.log(`  d=${p.d}  ${p.a}  ~  ${p.b}`);

if (exact.length === 0 && near.length === 0) {
  console.log('\n✅ No duplicate or near-duplicate campaign covers (binary level).');
  process.exit(0);
}
process.exit(1);
