import 'server-only';
// ─────────────────────────────────────────────────────────────────────────────
// notify() — best-effort in-app notification insert. Never throws: a failed
// notification must not break the primary action that triggered it. Message
// content is built by the pure helpers in `notify-core.ts`.
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from './supabase';
import type { NotificationDraft } from './notify-core';
import { pushToUser } from './push-server';

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

    // ⚠️ Push rides on THIS function rather than being called from each of the
    // fifteen routes that notify. One integration point means a new notification
    // is pushed automatically, and — more importantly — that the push and the
    // in-app row can never describe the same event differently.
    //
    // Awaited, not fired and forgotten: an un-awaited promise in a serverless
    // handler is cancelled when the response is returned, so the push would be
    // delivered or not depending on how fast the rest of the request finished.
    // `pushToUser` never throws and returns 0 when push is unconfigured, so the
    // cost when nobody has subscribed is one bounded query.
    await pushToUser(userId, draft);
  } catch {
    // Swallow — notifications are non-critical.
  }
}
