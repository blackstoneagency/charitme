import 'server-only';
import type { Metadata } from 'next';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import WebhooksClient, { type WebhookEndpoint } from './WebhooksClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Webhooks | CharitMe' };

// ─────────────────────────────────────────────────────────────────────────────
// Webhooks (design #174).
//
// `outbound_webhook_endpoints` has shipped since 20260525002000 with no reader
// and no writer — its only mention was a row count on /admin/system. Same orphan
// family as `donation_forms`.
//
// ⚠️ WHAT THIS PAGE DELIBERATELY DOES NOT SHOW. The design has a "Last
// Triggered" column and a Webhook Logs panel with Success/Delivered rows. Both
// are omitted, because:
//
//   1. Nothing in this codebase DISPATCHES an outbound webhook. There is no
//      sender, and no delivery-log table (`webhook_events` and
//      `campaign_payment_webhook_events` are both INBOUND Stripe records).
//   2. Delivery cannot be built on the current schema anyway: the table stores
//      `secret_hash` and nothing else. Signing a payload requires the SECRET,
//      and a SHA-256 hash cannot be reversed to produce it. So there is no key
//      available to HMAC with.
//
// Rendering "Last triggered: never" as a column implies a mechanism that would
// eventually fill it. Rendering "Delivered ✓" rows would be inventing them
// outright. Registering an endpoint is genuinely useful — it is real, owned,
// validated configuration — but the page says plainly that delivery is not live
// yet rather than implying it is. See todo.md for the schema decision required.
// ─────────────────────────────────────────────────────────────────────────────

export default async function WebhooksPage() {
  const user = await requireUser();

  const { data, error } = await supabaseAdmin
    .from('outbound_webhook_endpoints')
    .select('id, owner_id, url, events, active, created_at, updated_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  // null means the read FAILED — rendered differently from "you have none", so
  // nobody re-registers an endpoint that already exists.
  const endpoints: WebhookEndpoint[] | null = error ? null : ((data ?? []) as WebhookEndpoint[]);

  return (
    <CharitMeShell active="Webhooks">
      <TopBar
        title="Webhooks"
        subtitle="Send CharitMe events to your own systems."
      />
      <WebhooksClient initialEndpoints={endpoints} />
    </CharitMeShell>
  );
}
