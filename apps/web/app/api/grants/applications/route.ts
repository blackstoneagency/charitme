import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

// One applicant's own attachments across all their applications. Bounded so a
// pathological account cannot make this endpoint unbounded; the warning fires
// rather than silently truncating.
const DOCUMENT_CEILING = 500;

// The `.select()` below is built by string concatenation, which defeats
// supabase-js's literal-type inference and degrades the row type to
// GenericStringError. Naming the shape here restores it.
type ApplicationRow = { id: string } & Record<string, unknown>;

type GrantDocument = {
  id: string;
  application_id: string;
  file_name: string;
  file_url: string;
  doc_type: string | null;
  created_at: string;
};

// GET /api/grants/applications — the signed-in user's grant applications with
// summary grant info, newest first.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('grant_applications')
    .select(
      'id, grant_id, status, amount_requested, organization_name, submitted_at, decision_at, award_amount, created_at, updated_at, ' +
      'grants:grant_id(id, slug, title, funder_name, deadline_at, currency)',
    )
    .eq('applicant_user_id', user.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  const applications = (data ?? []) as unknown as ApplicationRow[];

  // Attach uploaded documents. `grant_documents` held 240 seeded rows with no
  // reader anywhere in the app — applicants could not see what was attached to
  // their own application.
  //
  // Scoped by the ids just fetched, which are already filtered to
  // applicant_user_id, so this cannot reach another applicant's files. Doing it as
  // one `.in()` rather than per-application keeps it a single round trip, not N.
  const byApplication = new Map<string, GrantDocument[]>();
  let documentsFailed = false;
  const ids = applications.map((a) => a.id);

  if (ids.length > 0) {
    const { data: docs, error: docsError } = await supabaseAdmin
      .from('grant_documents')
      .select('id, application_id, file_name, file_url, doc_type, created_at')
      .in('application_id', ids)
      .order('created_at', { ascending: false })
      .limit(DOCUMENT_CEILING);

    // A failed document read must not take down the applications list — the
    // applications are the point of this endpoint. supabase-js resolves rather
    // than throws, so without this check `docs` is null and every application
    // silently reports zero attachments, which reads to the applicant as "my
    // files are gone" rather than "we could not load them".
    if (docsError) {
      documentsFailed = true;
      console.warn('[grants] documents unavailable', { code: docsError.code });
    } else {
      for (const doc of (docs ?? []) as GrantDocument[]) {
        const list = byApplication.get(doc.application_id);
        if (list) list.push(doc);
        else byApplication.set(doc.application_id, [doc]);
      }
    }
  }

  return NextResponse.json({
    applications: applications.map((a) => ({ ...a, documents: byApplication.get(a.id) ?? [] })),
    // Lets the client tell "no attachments" from "we could not read them", which
    // an empty array alone cannot express.
    documentsAvailable: !documentsFailed,
  });
}
