import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/roles';

const BUCKET = 'receipts';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function isBucketMissing(msg: string): boolean {
  return msg.toLowerCase().includes('bucket') || msg.toLowerCase().includes('not found');
}

async function canAccessCampaign(userId: string, email: string | null | undefined, campaignId: string): Promise<boolean> {
  if (await isAdmin(userId, email)) return true;
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

// POST /api/upload/receipt
// Body: multipart/form-data { file, campaignId, ledgerItemId? }
// Returns: { path, url }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
  }

  const campaignId = formData.get('campaignId');
  if (typeof campaignId !== 'string' || !campaignId.trim()) {
    return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Use JPG, PNG, WebP, or PDF.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large. Max size is 5MB.' }, { status: 400 });
  }

  if (!(await canAccessCampaign(user.id, user.email, campaignId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ledgerItemIdRaw = formData.get('ledgerItemId');
  const ledgerItemId = typeof ledgerItemIdRaw === 'string' && ledgerItemIdRaw.trim() ? ledgerItemIdRaw.trim() : null;

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const storagePath = `${user.id}/${campaignId}/${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { data, error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    const msg = isBucketMissing(uploadError.message)
      ? `Storage bucket "${BUCKET}" was not found. Please create it in the Supabase dashboard.`
      : uploadError.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS);

  if (signError) return NextResponse.json({ error: signError.message }, { status: 500 });

  if (ledgerItemId) {
    await supabaseAdmin
      .from('transparency_ledger_items')
      .update({ receipt_url: data.path })
      .eq('id', ledgerItemId)
      .eq('campaign_id', campaignId);
  }

  return NextResponse.json({ path: data.path, url: signed.signedUrl });
}

// GET /api/upload/receipt?path=...
// Returns a fresh signed URL for a previously uploaded receipt.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = req.nextUrl.searchParams.get('path');
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 });

  const [ownerId, campaignId] = path.split('/');
  if (!ownerId || !campaignId) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });

  if (ownerId !== user.id && !(await canAccessCampaign(user.id, user.email, campaignId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (signError) return NextResponse.json({ error: signError.message }, { status: 500 });

  return NextResponse.json({ url: signed.signedUrl });
}

// DELETE /api/upload/receipt
// Body: { path: string, ledgerItemId?: string }
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const path = typeof body?.path === 'string' ? body.path : null;
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 });

  const [ownerId, campaignId] = path.split('/');
  if (!ownerId || !campaignId) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });

  if (ownerId !== user.id && !(await canAccessCampaign(user.id, user.email, campaignId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (removeError) return NextResponse.json({ error: removeError.message }, { status: 500 });

  const ledgerItemId = typeof body?.ledgerItemId === 'string' ? body.ledgerItemId : null;
  if (ledgerItemId) {
    await supabaseAdmin
      .from('transparency_ledger_items')
      .update({ receipt_url: null })
      .eq('id', ledgerItemId)
      .eq('campaign_id', campaignId);
  }

  return NextResponse.json({ ok: true });
}
