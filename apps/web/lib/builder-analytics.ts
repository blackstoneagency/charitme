// Pure validation for campaign-builder funnel events. No Supabase import so it is
// unit-testable; the API route does the insert.

export const BUILDER_EVENTS = ['enter', 'advance', 'back', 'publish', 'save_draft', 'abandon'] as const;
export const BUILDER_PATHS = ['guided', 'ai'] as const;

export type BuilderEvent = (typeof BUILDER_EVENTS)[number];
export type BuilderPath = (typeof BUILDER_PATHS)[number];

export interface BuilderEventRecord {
  session_id: string;
  path: BuilderPath;
  step: string;
  event: BuilderEvent;
  meta: Record<string, unknown>;
}

export type ParseResult =
  | { ok: true; value: BuilderEventRecord }
  | { ok: false; error: string };

/**
 * Validate + normalize an incoming builder-analytics payload. Rejects unknown
 * events/paths, over-long ids/steps, and non-object meta; caps meta size so the
 * open (anon) insert endpoint can't be used to store large blobs.
 */
export function parseBuilderEvent(input: unknown): ParseResult {
  if (!input || typeof input !== 'object') return { ok: false, error: 'invalid body' };
  const b = input as Record<string, unknown>;

  const sessionId = typeof b.sessionId === 'string' ? b.sessionId.trim() : '';
  if (!sessionId || sessionId.length > 100) return { ok: false, error: 'invalid sessionId' };

  const event = b.event;
  if (typeof event !== 'string' || !(BUILDER_EVENTS as readonly string[]).includes(event)) {
    return { ok: false, error: 'invalid event' };
  }

  const path = typeof b.path === 'string' && (BUILDER_PATHS as readonly string[]).includes(b.path) ? b.path : 'guided';

  const step = typeof b.step === 'string' ? b.step.trim().slice(0, 60) : '';
  if (!step) return { ok: false, error: 'invalid step' };

  let meta: Record<string, unknown> = {};
  if (b.meta && typeof b.meta === 'object' && !Array.isArray(b.meta)) {
    const json = JSON.stringify(b.meta);
    if (json.length <= 2000) meta = b.meta as Record<string, unknown>;
  }

  return { ok: true, value: { session_id: sessionId, path: path as BuilderPath, step, event: event as BuilderEvent, meta } };
}
