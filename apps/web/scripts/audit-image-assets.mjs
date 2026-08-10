import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const ROOT = resolve(WEB, '..', '..');
const PUBLIC = join(WEB, 'public');
const MANIFEST_PATH = join(ROOT, 'docs', 'image-inventory.json');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.json']);
const SOURCE_ROOTS = ['app', 'components', 'lib', 'public/sw.js'];

function walk(path) {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === '.next') return [];
    return walk(join(path, entry.name));
  });
}

function publicPath(path) {
  return relative(PUBLIC, path).replaceAll('\\', '/');
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
const files = walk(PUBLIC).filter((path) => IMAGE_EXTENSIONS.has(extname(path).toLowerCase()));
const actualPaths = new Set(files.map(publicPath));
const listedPaths = new Set();
const hashes = new Map();
const errors = [];

for (const asset of assets) {
  if (listedPaths.has(asset.path)) errors.push(`Duplicate inventory entry: ${asset.path}`);
  listedPaths.add(asset.path);
  if (!actualPaths.has(asset.path)) {
    errors.push(`Inventory points to a missing file: ${asset.path}`);
    continue;
  }
  for (const field of ['sha256', 'status', 'subject', 'fit', 'sourceType', 'source', 'license']) {
    if (typeof asset[field] !== 'string' || asset[field].trim() === '') {
      errors.push(`${asset.path} is missing ${field}`);
    }
  }
  if (!['active', 'retired'].includes(asset.status)) errors.push(`${asset.path} has invalid status ${asset.status}`);
  if (!Array.isArray(asset.uses)) errors.push(`${asset.path} is missing uses[]`);
  if (asset.status === 'active' && (!Array.isArray(asset.uses) || asset.uses.length === 0)) {
    errors.push(`${asset.path} is active but has no documented use`);
  }
  const digest = sha256(join(PUBLIC, asset.path));
  if (digest !== asset.sha256) errors.push(`${asset.path} changed without a new visual/provenance review`);
  if (hashes.has(digest)) errors.push(`${asset.path} duplicates ${hashes.get(digest)} byte-for-byte`);
  hashes.set(digest, asset.path);
}

for (const path of actualPaths) {
  if (!listedPaths.has(path)) errors.push(`Raster asset is not in docs/image-inventory.json: ${path}`);
}

const sourceFiles = SOURCE_ROOTS.flatMap((path) => walk(join(WEB, path)))
  .filter((path) => SOURCE_EXTENSIONS.has(extname(path).toLowerCase()));
const sourceText = sourceFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
const referencePattern = /[('"`]\/(?!\/)([^?'"`)]+\.(?:png|jpe?g|webp|avif|gif))(?:\?[^'"`)]*)?[)'"`]/gi;
for (const match of sourceText.matchAll(referencePattern)) {
  const referenced = match[1];
  const isBundledAsset = referenced.startsWith('images/')
    || referenced.startsWith('icons/')
    || ['CharitMe_Logo.png', 'logo.png', 'hero-child-crop.webp'].includes(referenced);
  if (!isBundledAsset) continue;
  if (!actualPaths.has(referenced)) errors.push(`Source references a missing raster asset: /${referenced}`);
}

for (const asset of assets.filter((item) => item.status === 'retired')) {
  if (sourceText.includes(`/${asset.path}`)) errors.push(`Retired asset is still referenced: /${asset.path}`);
}

if (manifest.schemaVersion !== 1) errors.push('Unsupported image inventory schemaVersion');
if (assets.length !== files.length) errors.push(`Inventory has ${assets.length} entries but public has ${files.length} raster assets`);

if (errors.length > 0) {
  process.stderr.write(`${errors.map((error) => `- ${error}`).join('\n')}\n`);
  process.exit(1);
}

const active = assets.filter((asset) => asset.status === 'active').length;
const retired = assets.length - active;
process.stdout.write(
  `Image asset audit passed: ${assets.length} unique files (${active} active, ${retired} retired).\n` +
  'Every raster has a verified subject, purpose, source, license basis, and content hash.\n',
);
