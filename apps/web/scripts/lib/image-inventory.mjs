import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Keep docs/image-inventory.json in step with the generators that write PNGs.
//
// ── Why this exists ─────────────────────────────────────────────────────────
// `audit:image-assets` requires every raster under `public/` to carry a subject,
// purpose, source, licence basis and content hash. Nothing wrote those entries,
// so every capture or regeneration broke the audit until a human hand-edited
// JSON. Measured on master, three separate times in one session:
//
//   · screenshots/home.png captured, inventoried, then RECAPTURED — stale hash
//   · campaigns/donate/how-it-works.png captured, never inventoried
//   · 12 store/screenshots/*.png captured, never inventoried
//
// Each one turned master red, and because CI tests a PR against its merge with
// master, each one turned EVERY open PR red with a failure its author did not
// cause. That is a coordination cost paid repeatedly by people who did nothing
// wrong.
//
// The scripts know exactly what they wrote and why. They should say so.
//
// ⚠️ This deliberately does NOT invent provenance. The caller passes subject,
// fit, source and licence; this only writes them down and hashes the bytes. An
// entry that describes an asset nobody looked at is worse than no entry, because
// the audit then reports a "verified" provenance that was never verified.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ FOUR levels, not three: this file is at apps/web/scripts/lib/, so it is
// lib → scripts → web → apps → repo root. A three-level version resolved to
// `apps/` and threw ENOENT on `apps/docs/image-inventory.json`. The same
// off-by-one-level mistake in a test helper earlier silently dropped 67 tests
// from a run that still printed green — here it throws, which is the better
// failure, but the check below makes it unmistakable either way.
const REPO_ROOT = path.join(import.meta.dirname, '..', '..', '..', '..');
const INVENTORY = path.join(REPO_ROOT, 'docs', 'image-inventory.json');
const PUBLIC_DIR = path.join(REPO_ROOT, 'apps', 'web', 'public');

if (!existsSync(INVENTORY)) {
  throw new Error(
    `image inventory not found at ${INVENTORY} — REPO_ROOT resolved to ${REPO_ROOT}, check the path depth`,
  );
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/**
 * Re-inline the short `uses` arrays after JSON.stringify expands them.
 *
 * Not cosmetic: this file is edited by several lanes at once, and a reformat
 * turns a one-entry change into a hundred-line diff that conflicts with
 * everything. One such reformat had to be redone by hand already.
 */
function serialize(inventory) {
  const out = JSON.stringify(inventory, null, 2).replace(
    /"uses": \[\n\s+((?:"[^"]*",?\n\s+)+)\]/g,
    (_m, body) => `"uses": [${body.trim().split('\n').map((x) => x.trim().replace(/,$/, '')).join(', ')}]`,
  );
  return `${out}\n`;
}

/**
 * Insert or refresh inventory entries for assets a script just wrote.
 *
 * @param {{path: string, subject: string, fit: string, sourceType?: string,
 *          source: string, license: string, uses: string[]}[]} assets
 *   `path` is relative to `apps/web/public`.
 * @returns {{added: string[], updated: string[], unchanged: string[]}}
 */
export function recordAssets(assets) {
  const inventory = JSON.parse(readFileSync(INVENTORY, 'utf8'));
  const byPath = new Map(inventory.assets.map((a) => [a.path, a]));
  const added = [];
  const updated = [];
  const unchanged = [];

  for (const asset of assets) {
    const hash = sha256(path.join(PUBLIC_DIR, asset.path));
    const existing = byPath.get(asset.path);
    if (!existing) {
      inventory.assets.push({
        path: asset.path,
        sha256: hash,
        status: 'active',
        subject: asset.subject,
        fit: asset.fit,
        sourceType: asset.sourceType ?? 'first-party',
        source: asset.source,
        license: asset.license,
        uses: asset.uses,
      });
      added.push(asset.path);
      continue;
    }
    if (existing.sha256 === hash) {
      unchanged.push(asset.path);
      continue;
    }
    // The bytes changed. Refresh the hash and the description together — a
    // refreshed hash beside a stale subject is how "verified provenance"
    // quietly stops meaning anything.
    existing.sha256 = hash;
    existing.subject = asset.subject;
    existing.fit = asset.fit;
    existing.source = asset.source;
    existing.license = asset.license;
    existing.uses = asset.uses;
    updated.push(asset.path);
  }

  writeFileSync(INVENTORY, serialize(inventory));
  return { added, updated, unchanged };
}

/** One-line summary for a generator's own output. */
export function summarize({ added, updated, unchanged }) {
  const parts = [];
  if (added.length > 0) parts.push(`${added.length} added`);
  if (updated.length > 0) parts.push(`${updated.length} re-hashed`);
  if (unchanged.length > 0) parts.push(`${unchanged.length} unchanged`);
  return `image inventory: ${parts.join(', ') || 'nothing to record'}`;
}
