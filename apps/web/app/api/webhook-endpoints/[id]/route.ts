import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { isWebhookEvent, validateWebhookUrl } from '../../../../lib/webhook-endpoint-access';

export const dynamic = 'force-dynamic';

const SELECT = 'id, owner_id, url, events, active, created_at, updated_at';

const UpdateSchema = z.object({
  url: z.string().min(8).max(2000).optional(),
  events: z.array(z.string().max(60)).min(1).max(20).optional(),
  active: z.boolean().optional(),
});

/**
 * Loads the endpoint and authorizes the caller.
 *
 * These routes use the service-role client, which BYPASSES RLS, so this check —
 * not `outbound_webhooks_owner_private` — is what actually runs. It mirrors that
 * policy: owner only. Admins are deliberately NOT included: an admin has no
 * reason to repoint someone else's webhook, and the policy's admin clause exists
 * for support reads, not for edits made through this UI.
 */
async function loadOwned(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data, error } = await supabaseAdmin
    .from('outbound_webhook_endpoints')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return { err: NextResponse.json({ error: 'Could not load the endpoint', code: 'ENDPOINT_UNAVAILABLE' }, { status: 503 }) };
  }
  if (!data || (data as { owner_id: string }).owner_id !== user.id) {
    // 404 rather than 403 — whether someone else's endpoint exists is not this
    // caller's business.
    return { err: NextResponse.json({ error: 'Endpoint not found' }, { status: 404 }) };
  }
  return { endpoint: data };
}

// ── PATCH /api/webhook-endpoints/[id] ───────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadOwned(id);
  if (loaded.err) return loaded.err;

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid endpoint', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const u = parsed.data;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (u.url !== undefined) {
    // Re-validated on every edit, not just at creation: otherwise an endpoint
    // could be created with a public https URL and then repointed at
    // 169.254.169.254, which is the SSRF the create-time check exists to stop.
    const urlCheck = validateWebhookUrl(u.url);
    if (!urlCheck.ok) return NextResponse.json({ error: urlCheck.reason, code: 'INVALID_URL' }, { status: 400 });
    patch.url = urlCheck.url;
  }
  if (u.events !== undefined) {
    const unknown = u.events.filter((e) => !isWebhookEvent(e));
    if (unknown.length) {
      return NextResponse.json(
        { error: `Unknown events: ${unknown.join(', ')}`, code: 'UNKNOWN_EVENT' },
        { status: 400 },
      );
    }
    patch.events = u.events;
  }
  if (u.active !== undefined) patch.active = u.active;

  const { data, error } = await supabaseAdmin
    .from('outbound_webhook_endpoints')
    .update(patch)
    .eq('id', id)
    .select(SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Could not save the endpoint', code: 'SAVE_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ endpoint: data });
}

// ── DELETE /api/webhook-endpoints/[id] ──────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadOwned(id);
  if (loaded.err) return loaded.err;

  const { error } = await supabaseAdmin.from('outbound_webhook_endpoints').delete().eq('id', id);
  if (error) {
    // Reporting success on a failed delete would leave an endpoint the owner
    // believes they revoked, still holding a valid signing secret.
    return NextResponse.json({ error: 'Could not delete the endpoint', code: 'DELETE_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
