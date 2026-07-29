import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// `grant_documents` held 240 seeded rows across 240 applications with no reader
// anywhere in the app: an applicant could not see the files attached to their own
// application. Found by `npm run audit:orphan-tables`.

const WEB_ROOT = join(__dirname, '..');
const ROUTE = readFileSync(join(WEB_ROOT, 'app', 'api', 'grants', 'applications', 'route.ts'), 'utf8');
const CLIENT = readFileSync(
  join(WEB_ROOT, 'app', 'dashboard', 'grants', 'GrantApplicationsClient.tsx'),
  'utf8',
);

describe('grant application attachments are readable by their owner', () => {
  it('the route reads grant_documents', () => {
    expect(ROUTE).toMatch(/\.from\(\s*['"]grant_documents['"]\s*\)/);
  });

  it('scopes documents to the ids already filtered by applicant_user_id', () => {
    // The security property. Documents are fetched with `.in('application_id', ids)`
    // where `ids` comes from the applications query, which is itself filtered by
    // `applicant_user_id`. If that `.in()` ever became an unfiltered read, one
    // applicant's files would be served to another.
    expect(ROUTE).toMatch(/\.eq\(\s*['"]applicant_user_id['"]\s*,\s*user\.id\s*\)/);
    expect(ROUTE).toMatch(/\.in\(\s*['"]application_id['"]\s*,\s*ids\s*\)/);
    const idsAssignment = /const ids = applications\.map\(\(a\) => a\.id\)/;
    expect(ROUTE).toMatch(idsAssignment);
    // …and the ids must be derived AFTER the owner-scoped query, not before.
    expect(ROUTE.indexOf('applicant_user_id')).toBeLessThan(ROUTE.search(idsAssignment));
  });

  it('rejects unauthenticated callers before reading anything', () => {
    const authGate = ROUTE.indexOf("status: 401");
    expect(authGate).toBeGreaterThan(-1);
    expect(authGate).toBeLessThan(ROUTE.indexOf("from('grant_documents')"));
  });

  it('bounds the document read', () => {
    expect(ROUTE).toMatch(/\.limit\(DOCUMENT_CEILING\)/);
  });

  it('a failed document read does not take down the applications list', () => {
    // supabase-js resolves rather than throws, so an unchecked error yields
    // docs === null and every application reports zero attachments — which reads
    // to the applicant as "my files are gone" rather than "we could not load them".
    // Must assert the BRANCH, not the identifier: `docsError` still appears in the
    // destructuring even when nothing checks it, so /docsError/ alone passes with
    // the guard gutted — verified by replacing the condition with `if (false)`.
    expect(ROUTE).toMatch(/const\s*\{\s*data:\s*docs,\s*error:\s*docsError\s*\}/);
    expect(ROUTE).toMatch(/if\s*\(\s*docsError\s*\)/);
    expect(ROUTE).toMatch(/documentsFailed\s*=\s*true/);
    expect(ROUTE).toMatch(/documentsAvailable:\s*!documentsFailed/);
    // The list itself must still be returned, i.e. no 500 on the document path.
    const docBlock = ROUTE.slice(ROUTE.indexOf("from('grant_documents')"));
    expect(docBlock).not.toMatch(/status:\s*500/);
  });

  it('the client distinguishes "no attachments" from "could not load"', () => {
    expect(CLIENT).toMatch(/documentsAvailable/);
    expect(CLIENT).toContain('have not been removed');
    // An application with genuinely no attachments renders nothing rather than an
    // empty "0 attachments" block on every draft.
    expect(CLIENT).toMatch(/if \(docs\.length === 0\)/);
    expect(CLIENT).toMatch(/if \(available\) return null;/);
  });

  it('attachment links are safe and reachable', () => {
    expect(CLIENT).toContain('rel="noopener noreferrer"');
    // WCAG 2.2 SC 2.5.8 — the chips are interactive targets.
    expect(CLIENT).toMatch(/minHeight: 24/);
  });
});
