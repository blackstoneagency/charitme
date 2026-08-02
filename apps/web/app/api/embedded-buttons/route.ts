import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import {
  BUTTON_TYPES,
  LABEL_MAX_LENGTH,
  isValidLabel,
  isValidTarget,
} from '../../../lib/embedded-buttons-core';

/**
 * Reader and writer for `embedded_buttons`.
 *
 * Unlike the other orphan tables wired this pass, this one HAS a public read
 * policy (`public_embedded_buttons_read`, `FOR SELECT USING (true)`) alongside
 * `embedded_buttons_owner_write`. The write path still goes through the
 * service-role client, so ownership is checked here — `owner_id` is taken from
 * the SESSION and never from the request body, which is the difference between
 * "who is asking" and "who they claim to be".
 */

const ConfigSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  width: z.number().int().min(120).max(1200).optional(),
  showCover: z.boolean().optional(),
  showProgress: z.boolean().optional(),
  showDonorCount: z.boolean().optional(),
});

const CreateSchema = z.object({
  label: z.string().trim().min(1).max(LABEL_MAX_LENGTH),
  buttonType: z.enum(BUTTON_TYPES),
  campaignId: z.string().uuid().nullable().optional(),
  config: ConfigSchema.optional(),
});

const DeleteSchema = z.object({ id: z.string().uuid() });

async function sessionUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(): Promise<NextResponse> {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('embedded_buttons')
    .select('id, label, button_type, campaign_id, config, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.warn('[embedded-buttons] read failed', { code: error.code });
    return NextResponse.json({ error: 'Buttons unavailable', code: 'READ_FAILED' }, { status: 503 });
  }
  return NextResponse.json({ buttons: data ?? [] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid button', code: 'INVALID_INPUT' }, { status: 400 });
  }
  const { label, buttonType, campaignId, config } = parsed.data;

  if (!isValidLabel(label)) {
    return NextResponse.json({ error: 'A button needs a label', code: 'INVALID_LABEL' }, { status: 400 });
  }

  // A donate button with no campaign cannot take a donation. The column is
  // nullable because the other types target something else, so the database
  // cannot express this and it has to be refused here.
  if (!isValidTarget(buttonType, campaignId ?? null)) {
    return NextResponse.json(
      { error: 'A donation button needs a campaign to send money to', code: 'MISSING_CAMPAIGN' },
      { status: 400 },
    );
  }

  // A campaign may only be embedded by the person who owns it. Checked against
  // the database rather than trusted from the body.
  if (campaignId) {
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id')
      .eq('id', campaignId)
      .maybeSingle();
    if (!campaign || campaign.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from('embedded_buttons')
    .insert({
      // From the session, never the body.
      owner_id: user.id,
      label: label.trim(),
      button_type: buttonType,
      campaign_id: campaignId ?? null,
      config: config ?? {},
    })
    .select('id')
    .single();
  if (error) {
    console.warn('[embedded-buttons] insert failed', { code: error.code });
    return NextResponse.json({ error: 'Could not save', code: 'WRITE_FAILED' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const parsed = DeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'id required', code: 'INVALID_INPUT' }, { status: 400 });
  }

  // Scope the delete by owner in the same statement. Deleting by id alone would
  // let anyone who can guess a uuid remove another fundraiser's button.
  const { error } = await supabaseAdmin
    .from('embedded_buttons')
    .delete()
    .eq('id', parsed.data.id)
    .eq('owner_id', user.id);
  if (error) return NextResponse.json({ error: 'Could not delete', code: 'WRITE_FAILED' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
