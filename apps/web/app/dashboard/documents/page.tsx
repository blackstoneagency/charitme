import 'server-only';
import type { Metadata } from 'next';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import DocumentsClient, { type DocumentEntry } from './DocumentsClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Documents | CharitMe' };

// ─────────────────────────────────────────────────────────────────────────────
// Document Library (design #153).
//
// Second page in this deck that needed NO new table. I had it on the blocked
// list; the rule that came out of the Calendar caught it — ask whether the data
// already exists before concluding a page needs storage. Four tables already
// hold this user's files, and nothing brought them together:
//
//   • campaign_media          — media_type = 'document', on campaigns they own
//   • verification_documents  — their own identity / nonprofit verification
//   • grant_documents         — attached to grant applications they filed
//   • impact_evidence         — receipts on their campaign updates
//
// So a fundraiser's paperwork was scattered across four screens, each reachable
// only from the workflow that created it. Nothing is inert: every source is an
// applied table.
//
// ⚠️ verification_documents holds IDENTITY documents. They are included because
// these are the caller's OWN — the query is keyed on user_id — but they carry a
// `sensitive` flag so the UI never renders a public link for them, and only the
// storage path is shown, never a signed URL. Aggregating files is exactly where
// a scoping mistake turns into a document leak.
//
// Each source is read independently and can fail on its own; the page names what
// is missing rather than presenting a partial library as complete.
// ─────────────────────────────────────────────────────────────────────────────

type SourceResult = { entries: DocumentEntry[]; failed: boolean };

async function campaignDocuments(userId: string): Promise<SourceResult> {
  const { data: campaigns, error: cErr } = await supabaseAdmin
    .from('campaigns')
    .select('id, title')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .limit(300);
  if (cErr) return { entries: [], failed: true };

  const byId = new Map((campaigns ?? []).map((c) => [(c as { id: string }).id, (c as { title: string }).title]));
  if (byId.size === 0) return { entries: [], failed: false };

  const { data, error } = await supabaseAdmin
    .from('campaign_media')
    .select('id, campaign_id, storage_path, public_url, media_type, created_at')
    .in('campaign_id', [...byId.keys()])
    .eq('media_type', 'document')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return { entries: [], failed: true };

  return {
    failed: false,
    entries: (data ?? []).map((m) => {
      const row = m as {
        id: string; campaign_id: string; storage_path: string;
        public_url: string | null; created_at: string;
      };
      return {
        id: `media-${row.id}`,
        name: row.storage_path.split('/').pop() ?? 'Document',
        category: 'Campaign',
        context: byId.get(row.campaign_id) ?? null,
        url: row.public_url,
        createdAt: row.created_at,
        sensitive: false,
      };
    }),
  };
}

async function verificationDocuments(userId: string): Promise<SourceResult> {
  const { data, error } = await supabaseAdmin
    .from('verification_documents')
    .select('id, document_type, storage_path, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return { entries: [], failed: true };

  return {
    failed: false,
    entries: (data ?? []).map((d) => {
      const row = d as { id: string; document_type: string; storage_path: string; status: string; created_at: string };
      return {
        id: `verif-${row.id}`,
        name: row.storage_path.split('/').pop() ?? row.document_type,
        category: 'Verification',
        context: `${row.document_type} · ${row.status}`,
        // Never a link: these are identity documents, and the storage bucket is
        // private. A link here would either 404 or, worse, not.
        url: null,
        createdAt: row.created_at,
        sensitive: true,
      };
    }),
  };
}

async function grantDocuments(userId: string): Promise<SourceResult> {
  const { data: apps, error: aErr } = await supabaseAdmin
    .from('grant_applications')
    .select('id')
    .eq('applicant_user_id', userId)
    .limit(300);
  if (aErr) return { entries: [], failed: true };

  const ids = (apps ?? []).map((a) => (a as { id: string }).id);
  if (ids.length === 0) return { entries: [], failed: false };

  const { data, error } = await supabaseAdmin
    .from('grant_documents')
    .select('id, file_url, file_name, doc_type, created_at')
    .in('application_id', ids)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return { entries: [], failed: true };

  return {
    failed: false,
    entries: (data ?? []).map((g) => {
      const row = g as { id: string; file_url: string; file_name: string | null; doc_type: string | null; created_at: string };
      return {
        id: `grant-${row.id}`,
        name: row.file_name ?? 'Grant document',
        category: 'Grant',
        context: row.doc_type,
        url: row.file_url,
        createdAt: row.created_at,
        sensitive: false,
      };
    }),
  };
}

export default async function DocumentsPage() {
  const user = await requireUser();

  const [campaignDocs, verifDocs, grantDocs] = await Promise.all([
    campaignDocuments(user.id),
    verificationDocuments(user.id),
    grantDocuments(user.id),
  ]);

  const failedSources = [
    campaignDocs.failed ? 'campaign files' : null,
    verifDocs.failed ? 'verification documents' : null,
    grantDocs.failed ? 'grant documents' : null,
  ].filter((s): s is string => s !== null);

  const documents = [...campaignDocs.entries, ...verifDocs.entries, ...grantDocs.entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <CharitMeShell active="Documents">
      <TopBar title="Documents" subtitle="Every file attached to your campaigns, grants and verification." />
      <DocumentsClient documents={documents} failedSources={failedSources} />
    </CharitMeShell>
  );
}
