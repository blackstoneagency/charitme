import 'server-only';
// ─────────────────────────────────────────────────────────────────────────────
// notify() — best-effort in-app notification insert. Never throws: a failed
// notification must not break the primary action that triggered it. Message
// content is built by the pure helpers in `notify-core.ts`.
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from './supabase';
import type { NotificationDraft } from './notify-core';

export async function notify(
  userId: string | null | undefined,
  draft: NotificationDraft | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  if (!userId || !draft) return;
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      kind: draft.kind,
      title: draft.title,
      body: draft.body,
      link: draft.link,
      meta: meta ?? {},
    });
  } catch {
    // Swallow — notifications are non-critical.
  }
}
