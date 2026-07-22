// ─────────────────────────────────────────────────────────────────────────────
// Campaign-builder draft autosave / recovery.
//
// The guided wizard (/create) only writes to Supabase on the final submit, so an
// interruption (refresh, closed tab, dead battery, accidental back) lost all the
// user's work — a major abandonment driver. This module persists the in-progress
// wizard state to localStorage on every change and restores it on return, so the
// user can pick up exactly where they left off. (In-progress form state lives in
// localStorage by design — instant, offline-safe, and it avoids spamming the DB
// with half-built campaign rows; a *committed* draft still goes to Supabase via
// "Save draft".)
//
// Pure + framework-free so it is fully unit-tested; the React layer only does the
// localStorage read/write.
// ─────────────────────────────────────────────────────────────────────────────

export const CAMPAIGN_DRAFT_KEY = 'charitme-campaign-draft-v1';
export const CAMPAIGN_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CampaignDraft<F = Record<string, string>> {
  v: 1;
  ts: number;
  step: string;
  storyMode: string;
  form: F;
  images: { url: string; name: string }[];
}

/** The form fields that indicate a user has actually started (drives whether we offer recovery). */
const MEANINGFUL_KEYS = ['title', 'tagline', 'description', 'goal', 'beneficiaryName', 'zipCode'] as const;

export function buildDraft<F>(input: {
  step: string;
  storyMode: string;
  form: F;
  images: { url: string; name: string }[];
  now?: number;
}): CampaignDraft<F> {
  return {
    v: 1,
    ts: input.now ?? Date.now(),
    step: input.step,
    storyMode: input.storyMode,
    form: input.form,
    images: input.images,
  };
}

export function serializeDraft(draft: CampaignDraft<unknown>): string {
  return JSON.stringify(draft);
}

/**
 * Parse a stored draft, returning null when it is missing, malformed, the wrong
 * version, or older than the TTL. Never throws.
 */
export function parseDraft<F = Record<string, string>>(
  raw: string | null | undefined,
  now: number = Date.now(),
  ttlMs: number = CAMPAIGN_DRAFT_TTL_MS,
): CampaignDraft<F> | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const d = parsed as Partial<CampaignDraft<F>>;
  if (d.v !== 1) return null;
  if (typeof d.ts !== 'number' || !Number.isFinite(d.ts)) return null;
  if (now - d.ts > ttlMs || now - d.ts < 0) return null;
  if (!d.form || typeof d.form !== 'object') return null;
  return {
    v: 1,
    ts: d.ts,
    step: typeof d.step === 'string' ? d.step : '',
    storyMode: typeof d.storyMode === 'string' ? d.storyMode : 'freeform',
    form: d.form as F,
    images: Array.isArray(d.images) ? d.images.filter((i) => i && typeof i.url === 'string') : [],
  };
}

/** True when the draft holds enough real input that offering to restore it is worthwhile. */
export function draftHasContent(form: unknown, imageCount = 0): boolean {
  if (imageCount > 0) return true;
  if (!form || typeof form !== 'object') return false;
  const f = form as Record<string, unknown>;
  return MEANINGFUL_KEYS.some((k) => String(f[k] ?? '').trim().length > 0);
}

/** Human "saved 3 hours ago" label for the recovery banner. */
export function draftAgeLabel(ts: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
