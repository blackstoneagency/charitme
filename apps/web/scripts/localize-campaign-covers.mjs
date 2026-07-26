#!/usr/bin/env node
/**
 * IMG-05 — move campaign covers off the external hotlink onto Supabase Storage.
 *
 * Every seeded cover currently points at picsum.photos. That is a live
 * third-party dependency on the most visible asset of every campaign: if picsum
 * rate-limits, changes ids, or goes down, every campaign image on the site breaks
 * at once. This downloads each cover, re-encodes it as WebP (much smaller than the
 * source JPEG), uploads it to the public `campaign-media` bucket under a stable
 * per-campaign path, and repoints `cover_image_url` / `image_urls` at it.
 *
 *   node scripts/localize-campaign-covers.mjs [--limit N] [--concurrency 8] [--apply]
 *
 * Dry run by default. Idempotent: a campaign already on Storage is skipped, and
 * uploads use upsert so a re-run repairs rather than duplicates.
 */
import sharp from 'sharp';
import fs from 'node:fs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : d; };
const LIMIT = arg('limit', 1000);
const CONCURRENCY = arg('concurrency', 8);
const APPLY = process.argv.includes('--apply');
const BUCKET = 'campaign-media';
const PREFIX = 'covers';

function env(key) {
  if (process.env[key]) return process.env[key];
  const txt = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const m = txt.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}
const SUPA = env('NEXT_PUBLIC_SUPABASE_URL');
const KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const isExternal = (u) => !!u && !u.includes('/storage/v1/object/public/');

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

const rows = (await (await fetch(
  `${SUPA}/rest/v1/campaigns?select=id,slug,cover_image_url&cover_image_url=not.is.null&order=created_at.asc&limit=${LIMIT}`,
  { headers: H },
)).json()).filter((r) => isExternal(r.cover_image_url));

console.log(`${rows.length} campaign(s) still on an external cover host.`);
if (!rows.length) { console.log('✅ All covers already served from Supabase Storage.'); process.exit(0); }
if (!APPLY) {
  console.log(`DRY RUN — would localize ${rows.length}. Sample:`);
  for (const r of rows.slice(0, 3)) console.log(`  ${r.slug}: ${r.cover_image_url} → ${SUPA}/storage/v1/object/public/${BUCKET}/${PREFIX}/${r.slug}.webp`);
  console.log('Re-run with --apply.');
  process.exit(0);
}

let done = 0, failed = 0, bytesIn = 0, bytesOut = 0;
await mapLimit(rows, CONCURRENCY, async (r) => {
  try {
    const src = await fetch(r.cover_image_url, { redirect: 'follow' });
    if (!src.ok) { failed++; return; }
    const input = Buffer.from(await src.arrayBuffer());
    // 1200px wide covers the largest render (campaign hero) at 2x for a 600px slot.
    const webp = await sharp(input).resize(1200, 900, { fit: 'cover', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    bytesIn += input.length; bytesOut += webp.length;

    const path = `${PREFIX}/${r.slug}.webp`;
    const up = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'image/webp', 'x-upsert': 'true', 'Cache-Control': 'public, max-age=31536000, immutable' },
      body: webp,
    });
    if (!up.ok && up.status !== 200) { console.log(`  upload failed ${r.slug}: ${up.status} ${(await up.text()).slice(0, 90)}`); failed++; return; }

    const publicUrl = `${SUPA}/storage/v1/object/public/${BUCKET}/${path}`;
    const patch = await fetch(`${SUPA}/rest/v1/campaigns?id=eq.${r.id}`, {
      method: 'PATCH',
      headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ cover_image_url: publicUrl, image_urls: [publicUrl] }),
    });
    if (!patch.ok) { console.log(`  db patch failed ${r.slug}: ${patch.status}`); failed++; return; }
    done++;
    if (done % 50 === 0) process.stdout.write(`\r  localized ${done}/${rows.length}`);
  } catch (e) { failed++; console.log(`  error ${r.slug}: ${String(e.message).slice(0, 70)}`); }
});

console.log(`\n✅ Localized ${done} cover(s), ${failed} failure(s).`);
if (bytesIn) console.log(`   ${(bytesIn / 1048576).toFixed(1)}MB source → ${(bytesOut / 1048576).toFixed(1)}MB WebP (${Math.round((1 - bytesOut / bytesIn) * 100)}% smaller)`);
