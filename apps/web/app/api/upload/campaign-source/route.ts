import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';
import { isSafeStoragePath } from '../../../../lib/storage-path';

const BUCKET = 'campaign-source-documents';
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ['application/pdf', 'pdf'],
  ['application/msword', 'doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['text/plain', 'txt'],
]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  if (!(await checkRateLimitDurable(`campaign-source:${user.id}`, 20, 60_000))) {
    return NextResponse.json({ error: 'Too many uploads', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file', code: 'MISSING_FILE' }, { status: 400 });
  }
  if (file.name.length === 0 || file.name.length > 255) {
    return NextResponse.json({ error: 'File name must be 255 characters or fewer.', code: 'INVALID_FILE_NAME' }, { status: 400 });
  }
  const extension = ALLOWED_TYPES.get(file.type);
  if (!extension) {
    return NextResponse.json({ error: 'Use a PDF, Word, or text document.', code: 'INVALID_FILE_TYPE' }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File must be smaller than 5 MB.', code: 'FILE_TOO_LARGE' }, { status: 400 });
  }

  const storagePath = `campaigns/${user.id}/sources/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(
    storagePath,
    new Uint8Array(await file.arrayBuffer()),
    { contentType: file.type, cacheControl: '3600', upsert: false },
  );
  if (error) {
    return NextResponse.json({ error: 'Document could not be uploaded.', code: 'UPLOAD_FAILED' }, { status: 500 });
  }

  return NextResponse.json({
    path: storagePath,
    name: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  if (!(await checkRateLimitDurable(`campaign-source-delete:${user.id}`, 60, 60_000))) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const path = body && typeof body === 'object' && typeof (body as { path?: unknown }).path === 'string'
    ? (body as { path: string }).path
    : '';
  if (!isSafeStoragePath(path)) {
    return NextResponse.json({ error: 'Invalid path', code: 'INVALID_PATH' }, { status: 400 });
  }
  if (!path.startsWith(`campaigns/${user.id}/sources/`)) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (error) return NextResponse.json({ error: 'Document could not be removed.', code: 'DELETE_FAILED' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
