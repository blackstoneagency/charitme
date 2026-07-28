import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SUPABASE = join(__dirname, '..', '..', '..', 'supabase');
const CATCH_UP = join(SUPABASE, 'catch_up.sql');
const MIGRATIONS = join(SUPABASE, 'migrations');

// ─────────────────────────────────────────────────────────────────────────────
// `scripts/build_catchup.py` rewrites every `create policy X on T` into
// `drop policy if exists X on T; create policy X on T` so the catch-up script is
// re-runnable. The rewrite used a bare regex over the whole file, which does not
// know what a comment is.
//
// So a migration that QUOTES SQL while explaining itself had that SQL injected
// into catch_up.sql as a LIVE statement. A migration removing a world-readable
// policy documented the policy it was removing:
//
//     -- create policy public_creator_tips_read on creator_tips
//     --   for select using (true);
//
// …and the generator re-created it, after the drop, silently undoing the
// migration. Permissive policies OR together, so the resurrected one wins. And
// because the `using (...)` clause stayed commented out, the injected policy was
// UNQUALIFIED — granting more than the text it was copied from.
//
// This pins the invariant directly: a policy that exists in the generated output
// must trace back to a real statement in a migration, not to prose about one.
// ─────────────────────────────────────────────────────────────────────────────

/** Policy names from live SQL only — `--` comment text is stripped first. */
function livePolicyNames(sql: string): Set<string> {
  const code = sql
    .split('\n')
    .map((line) => {
      let inStr = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === "'") inStr = !inStr;
        else if (!inStr && line.startsWith('--', i)) return line.slice(0, i);
      }
      return line;
    })
    .join('\n');

  const names = new Set<string>();
  for (const m of code.matchAll(/\bcreate\s+policy\s+("(?:[^"]|"")+"|[a-zA-Z0-9_]+)/gi)) {
    names.add(m[1].replace(/"/g, ''));
  }
  return names;
}

describe('the catch-up generator does not turn comments into SQL', () => {
  const catchUp = readFileSync(CATCH_UP, 'utf8');
  const migrationSql = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n');

  const generated = livePolicyNames(catchUp);
  const declared = livePolicyNames(migrationSql);

  it('finds policies on both sides', () => {
    // Keeps the assertion below from passing vacuously if either parse breaks.
    expect(generated.size).toBeGreaterThan(100);
    expect(declared.size).toBeGreaterThan(100);
  });

  it('every generated policy traces to a real migration statement', () => {
    const phantom = [...generated].filter((n) => !declared.has(n)).sort();
    expect(
      phantom,
      'policy in catch_up.sql that no migration actually creates — the generator ' +
        'picked it up out of a comment, and it may be unqualified',
    ).toEqual([]);
  });

  it('creator_tips ends up private in the replayed schema', () => {
    // Checked against the MIRROR, not catch_up.sql: the original migration
    // legitimately creates the world-readable policy and a later one drops it,
    // so both names appear in the replay. Only the end state means anything —
    // which is the whole reason this bug survived being "fixed" once already.
    //
    // creator_tips exposes supporter_id, amount_cents and a Stripe payment
    // intent id, so a surviving `using (true)` here is a live data leak.
    const schema = readFileSync(join(SUPABASE, 'schema.sql'), 'utf8');
    expect(schema).not.toMatch(/CREATE POLICY public_creator_tips_read/);
    expect(schema).toMatch(/CREATE POLICY creator_tips_private ON public\.creator_tips FOR SELECT/);
  });
});
