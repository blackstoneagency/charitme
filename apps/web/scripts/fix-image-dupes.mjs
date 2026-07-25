#!/usr/bin/env node
/**
 * Resolve perceptual duplicate campaign covers found by audit-image-dupes.mjs.
 *
 * Different Lorem Picsum ids can resolve to visually identical photos, so
 * URL-level uniqueness is not enough. This hashes every cover, finds conflicting
 * campaigns, and reassigns each conflict to a replacement id whose *hash* is
 * verified distinct from every kept image before it is written.
 *
 *   node scripts/fix-image-dupes.mjs [--threshold 5] [--apply]
 *
 * Without --apply it is a dry run.
 */
import sharp from 'sharp';
import fs from 'node:fs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : d; };
const THRESHOLD = arg('threshold', 5);
const APPLY = process.argv.includes('--apply');

function env(key) {
  if (process.env[key]) return process.env[key];
  const txt = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const m = txt.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}
const SUPA = env('NEXT_PUBLIC_SUPABASE_URL');
const KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function dhash(buf) {
  const px = await sharp(buf).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits = (bits << 1n) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1n : 0n);
  return bits;
}
const hamming = (a, b) => { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };
async function hashUrl(u) {
  const r = await fetch(u, { redirect: 'follow' });
  if (!r.ok) return null;
  return dhash(Buffer.from(await r.arrayBuffer()));
}
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

// 1. Hash every current cover.
const rows = await (await fetch(`${SUPA}/rest/v1/campaigns?select=id,slug,cover_image_url&cover_image_url=not.is.null&order=created_at.asc&limit=1000`, { headers: H })).json();
console.log(`Hashing ${rows.length} covers…`);
const hashed = (await mapLimit(rows, 16, async (r) => {
  const h = await hashUrl(r.cover_image_url).catch(() => null);
  return h === null ? null : { ...r, hash: h };
})).filter(Boolean);

// 2. Greedily keep the first of each conflicting cluster; the rest need new images.
const kept = [];
const conflicts = [];
for (const row of hashed) {
  const clash = kept.find((k) => hamming(k.hash, row.hash) <= THRESHOLD);
  if (clash) conflicts.push({ ...row, clashesWith: clash.slug });
  else kept.push(row);
}
console.log(`Distinct: ${kept.length} | need replacement: ${conflicts.length}`);
if (conflicts.length === 0) { console.log('✅ Nothing to fix.'); process.exit(0); }

// 3. Candidate ids from the Picsum catalogue that are not already in use.
const usedIds = new Set(rows.map((r) => (r.cover_image_url.match(/picsum\.photos\/id\/(\d+)\//) || [])[1]).filter(Boolean));
const catalogue = [];
for (let p = 1; p <= 10; p++) {
  const list = await (await fetch(`https://picsum.photos/v2/list?page=${p}&limit=100`)).json();
  if (!list.length) break;
  for (const it of list) if (!usedIds.has(String(it.id))) catalogue.push(Number(it.id));
}
console.log(`Unused candidate ids: ${catalogue.length}`);

// 4. Assign, verifying each replacement's hash against everything kept so far.
const updates = [];
let ci = 0;
for (const c of conflicts) {
  let assigned = null;
  while (ci < catalogue.length && !assigned) {
    const id = catalogue[ci++];
    const url = `https://picsum.photos/id/${id}/800/600`;
    const h = await hashUrl(url).catch(() => null);
    if (h === null) continue;
    if (kept.some((k) => hamming(k.hash, h) <= THRESHOLD)) continue; // still a dupe — skip
    kept.push({ slug: c.slug, hash: h });
    assigned = url;
  }
  if (!assigned) { console.log(`  !! no unique replacement found for ${c.slug}`); continue; }
  updates.push({ id: c.id, slug: c.slug, from: c.cover_image_url, to: assigned, clashedWith: c.clashesWith });
  console.log(`  ${c.slug}: ${c.cover_image_url.split('/id/')[1]} → ${assigned.split('/id/')[1]}  (clashed with ${c.clashesWith})`);
}

if (!APPLY) { console.log(`\nDRY RUN — ${updates.length} update(s). Re-run with --apply.`); process.exit(0); }

for (const u of updates) {
  const r = await fetch(`${SUPA}/rest/v1/campaigns?id=eq.${u.id}`, {
    method: 'PATCH',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ cover_image_url: u.to, image_urls: [u.to] }),
  });
  if (!r.ok) console.log(`  FAILED ${u.slug}: ${r.status}`);
}
console.log(`\n✅ Applied ${updates.length} replacement cover(s).`);
