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

// ─────────────────────────────────────────────────────────────────────────────
// Cross-device resume (Supabase-backed).
//
// Signed-in organizers get their draft mirrored to `campaign_wizard_drafts`, so
// starting on a phone and finishing on a laptop no longer loses work. Local and
// remote copies are interchangeable; on restore the NEWER of the two wins, and a
// remote copy carrying images beats an otherwise-equal local copy that lost them
// (the OAuth bounce used to drop uploads).
// ─────────────────────────────────────────────────────────────────────────────

/** Shape returned by GET /api/campaigns/draft (snake_case straight from the row). */
export interface RemoteDraftRow {
  step?: string | null;
  story_mode?: string | null;
  form?: unknown;
  images?: unknown;
  client_ts?: number | null;
}

/** Normalise a Supabase draft row into the same shape as a localStorage draft. */
export function fromRemoteDraft<F = Record<string, string>>(
  row: RemoteDraftRow | null | undefined,
): CampaignDraft<F> | null {
  if (!row || !row.form || typeof row.form !== 'object') return null;
  const ts = typeof row.client_ts === 'number' && Number.isFinite(row.client_ts) ? row.client_ts : 0;
  return {
    v: 1,
    ts,
    step: typeof row.step === 'string' ? row.step : '',
    storyMode: typeof row.story_mode === 'string' ? row.story_mode : 'freeform',
    form: row.form as F,
    images: Array.isArray(row.images)
      ? (row.images as { url?: unknown; name?: unknown }[])
          .filter((i) => i && typeof i.url === 'string')
          .map((i) => ({ url: i.url as string, name: typeof i.name === 'string' ? i.name : '' }))
      : [],
  };
}

/**
 * Pick the draft to restore. Newest timestamp wins; on a tie (or when one side
 * has no usable timestamp) prefer the copy that still has images, since losing
 * uploads is the most expensive kind of loss for the organizer.
 */
export function pickFreshestDraft<F>(
  local: CampaignDraft<F> | null,
  remote: CampaignDraft<F> | null,
): CampaignDraft<F> | null {
  if (!local) return remote;
  if (!remote) return local;
  if (remote.ts > local.ts) return remote;
  if (local.ts > remote.ts) return local;
  if (remote.images.length > local.images.length) return remote;
  return local;
}

// ─────────────────────────────────────────────────────────────────────────────
// Publish-failure copy.
//
// The builder surfaced raw API strings ("duplicate key value violates unique
// constraint …") straight to organizers at the most fragile moment in the
// journey. This maps what the API can actually return to plain language plus a
// clear next action, and always leaves the user something to do.
// ─────────────────────────────────────────────────────────────────────────────

export interface PublishFailure {
  message: string;
  /** True when simply pressing publish again is a reasonable next step. */
  retryable: boolean;
}

export function describePublishFailure(raw: unknown, httpStatus?: number): PublishFailure {
  const text = (typeof raw === 'string' ? raw : '').toLowerCase();

  if (httpStatus === 401 || httpStatus === 403 || text.includes('unauthor') || text.includes('forbidden')) {
    return { message: 'Your session expired. Sign in again and your campaign will still be here.', retryable: false };
  }
  if (httpStatus === 429 || text.includes('rate limit') || text.includes('too many')) {
    return { message: 'Too many attempts in a short time. Wait a moment, then try again.', retryable: true };
  }
  if (text.includes('duplicate') || text.includes('already exists') || text.includes('unique constraint')) {
    return { message: 'A campaign with this title already exists. Try a slightly different title.', retryable: false };
  }
  if (text.includes('title')) {
    return { message: 'Your campaign title needs a small fix before publishing — check the Title step.', retryable: false };
  }
  if (text.includes('goal') || text.includes('amount')) {
    return { message: 'Your fundraising goal needs a small fix before publishing — check the Goal step.', retryable: false };
  }
  if (text.includes('image') || text.includes('upload')) {
    return { message: 'One of your images could not be saved. Remove it on the Media step and try again.', retryable: false };
  }
  if (httpStatus === 413 || text.includes('too large') || text.includes('payload')) {
    return { message: 'Your campaign is a little too large to save — try removing an image.', retryable: false };
  }
  if (text.includes('network') || text.includes('fetch') || text.includes('timeout') || (httpStatus ?? 0) >= 500) {
    return { message: 'We could not reach CharitMe just now. Your work is saved — check your connection and try again.', retryable: true };
  }
  return { message: 'Something went wrong publishing your campaign. Your work is saved — please try again.', retryable: true };
}
