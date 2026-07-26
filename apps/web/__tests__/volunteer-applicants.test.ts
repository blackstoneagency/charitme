import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WEB_ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB_ROOT, p), 'utf8');

const API = 'app/api/volunteers/applicants/route.ts';
const UI = 'app/dashboard/volunteer/VolunteerApplicantsClient.tsx';
const DECISION = 'app/api/volunteers/applications/[id]/decision/route.ts';

function uiSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx$/.test(name)) out.push(readFileSync(p, 'utf8'));
    }
  };
  walk(join(WEB_ROOT, 'app'));
  walk(join(WEB_ROOT, 'components'));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Volunteering was broken end to end: a volunteer could apply, and the organizer
// accept/decline endpoint was fully implemented — but NOTHING in the UI called it
// and no screen listed who had applied. Applications went into a black hole.
// ─────────────────────────────────────────────────────────────────────────────

describe('the organizer can actually reach volunteer applications', () => {
  it('some UI calls the accept/decline endpoint', () => {
    // The regression that mattered: this endpoint existing with zero callers.
    const callers = uiSources().filter((s) => /applications\/\$\{[^}]+\}\/decision/.test(s));
    expect(callers.length, 'the decision endpoint has no UI caller again').toBeGreaterThan(0);
  });

  it('the applicants list is rendered on the volunteer dashboard', () => {
    const page = read('app/dashboard/volunteer/page.tsx');
    expect(page).toContain('VolunteerApplicantsClient');
  });

  it('offers the decisions the endpoint accepts', () => {
    const ui = read(UI);
    const endpoint = read(DECISION);
    for (const decision of ['accepted', 'declined', 'completed']) {
      expect(endpoint, `endpoint no longer supports ${decision}`).toContain(`'${decision}'`);
      expect(ui, `UI cannot issue ${decision}`).toContain(`'${decision}'`);
    }
  });
});

describe('the applicants endpoint is scoped and safe', () => {
  const src = read(API);

  it('only ever returns applicants for opportunities the caller owns', () => {
    // Ownership is applied to the opportunity query first, and the applications
    // query is filtered by the resulting ids — so a wrong filter cannot leak
    // another organizer's applicants.
    expect(src).toContain("eq('created_by', user.id)");
    expect(src).toMatch(/in\('opportunity_id', oppIds\)/);
  });

  it('rejects anonymous callers', () => {
    expect(src).toContain("{ error: 'Unauthorized' }");
  });

  it('withholds the free-text bio of a private volunteer profile', () => {
    // Skills/availability are needed to judge an application you received; the bio
    // is written for a public audience, so `is_public: false` suppresses it.
    expect(src).toContain('isPublic ?');
    expect(src).toContain('is_public !== false');
  });

  it('batches the applicant lookups instead of querying per row', () => {
    expect(src).toContain('Promise.all');
    expect(src).toMatch(/in\('id', applicantIds\)/);
    expect(src).toMatch(/in\('user_id', applicantIds\)/);
  });

  it('reads volunteer_profiles — the table that had 1131 rows and no reader', () => {
    expect(src).toContain("from('volunteer_profiles')");
  });

  it('bounds the applications query', () => {
    expect(src).toMatch(/\.limit\(\d+\)/);
  });
});

describe('the applicants UI degrades honestly', () => {
  const ui = read(UI);

  it('distinguishes a failed load from having no applicants', () => {
    expect(ui).toContain('setFailed(true)');
    expect(ui).toContain('role="alert"');
    expect(ui).toContain("We couldn&apos;t load your applicants");
  });

  it('does not tell an organizer their applications were lost', () => {
    expect(ui).toMatch(/no applications have been lost/i);
  });
});
