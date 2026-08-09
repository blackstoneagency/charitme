import type { CampaignBuilderPath } from './campaign-builder-model';

export const AI_INTAKE_SESSION_KEY = 'charitme-ai-intake-v1';
export const AI_INTAKE_FILE_DB = 'charitme-campaign-intake';
export const AI_INTAKE_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const AI_INTAKE_MAX_FILES = 10;

const ALLOWED_INTAKE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

export type AiIntakeFileMeta = {
  id: string;
  name: string;
  type: string;
  size: number;
};

export type AiCampaignIntake = {
  version: 1;
  path: CampaignBuilderPath;
  prompt: string;
  links: string[];
  files: AiIntakeFileMeta[];
  createdAt: number;
};

type CachedIntakeFile = AiIntakeFileMeta & { blob: Blob };

export function validateAiIntakeFile(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  if (!ALLOWED_INTAKE_TYPES.has(file.type)) {
    return `${file.name} is not a supported image, PDF, Word, or text file.`;
  }
  if (file.size <= 0 || file.size > AI_INTAKE_MAX_FILE_BYTES) {
    return `${file.name} must be smaller than 5 MB.`;
  }
  return null;
}
export function normalizeAiIntakeLinks(values: readonly string[]): { links: string[]; invalid: string[] } {
  const links: string[] = [];
  const invalid: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('protocol');
      const normalized = url.toString();
      if (!links.includes(normalized)) links.push(normalized);
    } catch {
      invalid.push(value);
    }
  }
  return { links: links.slice(0, 5), invalid };
}

export function parseAiCampaignIntake(raw: string | null | undefined): AiCampaignIntake | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (row.version !== 1 || row.path !== 'ai' || typeof row.prompt !== 'string') return null;
  const links = Array.isArray(row.links)
    ? row.links.filter((item): item is string => typeof item === 'string').slice(0, 5)
    : [];
  const files = Array.isArray(row.files)
    ? row.files.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const file = item as Record<string, unknown>;
        if (typeof file.id !== 'string' || typeof file.name !== 'string'
          || typeof file.type !== 'string' || typeof file.size !== 'number') return [];
        return [{ id: file.id, name: file.name, type: file.type, size: file.size }];
      }).slice(0, AI_INTAKE_MAX_FILES)
    : [];
  return {
    version: 1,
    path: 'ai',
    prompt: row.prompt.slice(0, 4000),
    links,
    files,
    createdAt: typeof row.createdAt === 'number' && Number.isFinite(row.createdAt) ? row.createdAt : Date.now(),
  };
}

function openFileDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AI_INTAKE_FILE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local file storage.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save local files.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Local file save was cancelled.'));
  });
}

export async function cacheAiIntakeFiles(files: readonly File[]): Promise<AiIntakeFileMeta[]> {
  if (typeof indexedDB === 'undefined' || files.length === 0) return [];
  const db = await openFileDb();
  try {
    const transaction = db.transaction('files', 'readwrite');
    const store = transaction.objectStore('files');
    store.clear();
    const metadata = files.slice(0, AI_INTAKE_MAX_FILES).map((file) => {
      const meta: AiIntakeFileMeta = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
      };
      const record: CachedIntakeFile = { ...meta, blob: file };
      store.put(record);
      return meta;
    });
    await transactionDone(transaction);
    return metadata;
  } finally {
    db.close();
  }
}

export async function loadCachedAiIntakeFiles(ids: readonly string[]): Promise<File[]> {
  if (typeof indexedDB === 'undefined' || ids.length === 0) return [];
  const db = await openFileDb();
  try {
    const transaction = db.transaction('files', 'readonly');
    const store = transaction.objectStore('files');
    const reads = ids.map((id) => new Promise<File | null>((resolve) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const row: unknown = request.result;
        if (!row || typeof row !== 'object') { resolve(null); return; }
        const file = row as Partial<CachedIntakeFile>;
        if (!(file.blob instanceof Blob) || typeof file.name !== 'string' || typeof file.type !== 'string') {
          resolve(null);
          return;
        }
        resolve(new File([file.blob], file.name, { type: file.type }));
      };
      request.onerror = () => resolve(null);
    }));
    const loaded = await Promise.all(reads);
    await transactionDone(transaction);
    return loaded.filter((file): file is File => file !== null);
  } finally {
    db.close();
  }
}

export async function clearCachedAiIntakeFiles(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openFileDb();
  try {
    const transaction = db.transaction('files', 'readwrite');
    transaction.objectStore('files').clear();
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}
