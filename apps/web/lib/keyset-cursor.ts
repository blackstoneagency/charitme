import 'server-only';

export type KeysetCursor = Readonly<{
  createdAt: string;
  id: string;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeKeysetCursor(cursor: KeysetCursor): string {
  return Buffer.from(`${cursor.createdAt}|${cursor.id}`, 'utf8').toString('base64url');
}

export function decodeKeysetCursor(value: string | string[] | undefined): KeysetCursor | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256) return null;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const separator = decoded.indexOf('|');
    if (separator < 1 || separator !== decoded.lastIndexOf('|')) return null;
    const createdAt = decoded.slice(0, separator);
    const id = decoded.slice(separator + 1);
    const timestamp = Date.parse(createdAt);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== createdAt) return null;
    if (!UUID_PATTERN.test(id)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}
