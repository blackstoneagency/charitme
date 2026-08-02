import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// No request path may read a growing table whole.
//
// An unbounded `select()` costs nothing at 500 rows and takes a page down at
// 500,000. It never announces the transition — the query simply gets slower
// until it times out, which is the same shape as every other defect fixed this
// session: fine until it very suddenly is not.
//
// The last one was lib/home-data.ts's category-stats scan, reading one row per
// ACTIVE campaign to build the homepage "Discover causes" grid. On the
// highest-traffic page on the site, with nothing bounding it.
//
// Bounded means ANY of: .limit(), .range(), .single(), .maybeSingle(), or a
// head-only count. A filter (.eq/.in/…) also counts — it makes the read
// proportional to one user's data rather than the whole table.
//
// ⚠️ THAT LAST CLAUSE HAS A HOLE, and it let two unbounded reads onto the
// PUBLIC /contact page. The reasoning holds for an identity filter like
// `.eq('user_id', …)`. It does not hold for a STATUS filter:
// `.eq('status','completed')` on `donations` selects nearly every row in the
// table, and `.in('status',['resolved','closed'])` selects most support cases.
// Those are proportional to the PLATFORM, not to a user — exactly what this
// file exists to catch — and the filter check waved them through.
//
// `STATUS_ONLY_FILTER` below closes it: a query whose only filters are on a
// status-like column is treated as UNBOUNDED and must carry a real limit.
// Fixed at the two /contact call sites; the rule stops the next one.
// ─────────────────────────────────────────────────────────────────────────────

const WEB = join(__dirname, '..');

/** Tables with no natural ceiling — they grow with usage, forever. */
const UNBOUNDED_TABLES = [
  'donations', 'campaigns', 'profiles', 'marketing_contacts', 'notifications',
  'donor_messages', 'campaign_updates', 'payouts', 'recurring_donations',
  'support_cases', 'risk_flags', 'audit_logs', 'share_events', 'webhook_events',
];

const BOUNDED = /head:\s*true|\bhead\b|\.limit\(|\.single\(|\.maybeSingle\(|\.range\(/;
const FILTERED = /\.eq\(|\.in\(|\.gte\(|\.lte\(|\.gt\(|\.lt\(|\.neq\(|\.is\(|\.contains\(|\.or\(|\.filter\(|\.ilike\(|\.match\(/;

/**
 * Filters that select a large FRACTION of a table rather than one owner's rows.
 * A query filtered only by these is not bounded in any useful sense.
 */
const STATUS_ONLY_FILTER =
  /\.(?:eq|in|neq)\(\s*['"](?:status|state|visibility|active|is_active|type|kind)['"]/;
/** An identity filter genuinely does scope a read to one owner's data. */
const IDENTITY_FILTER =
  /\.(?:eq|in)\(\s*['"](?:id|user_id|owner_id|profile_id|campaign_id|donor_id|donation_id|parent_campaign_id|recipient_id|author_id|team_id|organization_id)['"]/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * The query chain from `.from(` to its terminating `;` at depth 0.
 *
 * A fixed-size window does NOT work here: several call sites build the column
 * list by concatenating strings across many lines, which pushed the `.eq()` or
 * `.single()` past the window and produced four false positives on the first
 * run of this scan. Read to the end of the statement instead.
 */
function statementFrom(src: string, start: number): string {
  let depth = 0;
  for (let i = start; i < Math.min(src.length, start + 4000); i++) {
    const ch = src[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ';' && depth <= 0) return src.slice(start, i);
  }
  return src.slice(start, start + 4000);
}

/** The variable a query is assigned to, if the statement is an assignment. */
function assignedNameBefore(src: string, fromIndex: number): string | null {
  const head = src.slice(Math.max(0, fromIndex - 400), fromIndex);
  const matches = [...head.matchAll(/(?:const|let|var)\s+(\w+)\s*=/g)];
  return matches.length > 0 ? matches[matches.length - 1][1] : null;
}

/**
 * True when that variable later has a bounding call applied to it.
 *
 * Intervening chain links are allowed: the real shape is
 * `await donationQuery.order(…).limit(5000)`, so requiring the bound to sit
 * immediately after the name misses it. Scoped to a window after each mention
 * rather than the whole file, so an unrelated `.limit()` further down cannot
 * vouch for a query it has nothing to do with.
 */
function boundedLater(src: string, name: string, after: number): boolean {
  const rest = src.slice(after);
  for (const use of rest.matchAll(new RegExp(`\\b${name}\\b`, 'g'))) {
    const window = rest.slice(use.index ?? 0, (use.index ?? 0) + 300);
    if (/\.(limit|range|single|maybeSingle)\(/.test(window)) return true;
  }
  return false;
}

function findWholeTableReads(): string[] {
  const offenders: string[] = [];
  for (const dir of ['app', 'lib']) {
    for (const file of sourceFiles(join(WEB, dir))) {
      const src = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
        .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
      for (const m of src.matchAll(/\.from\('(\w+)'\)/g)) {
        if (!UNBOUNDED_TABLES.includes(m[1])) continue;
        const chain = statementFrom(src, m.index ?? 0);
        if (!/\.select\(/.test(chain)) continue;
        if (BOUNDED.test(chain)) continue;
        // A filter only bounds the read if it scopes to an OWNER. A query whose
        // only filter is a status needs a real limit — see the note at the top.
        if (FILTERED.test(chain)) {
          const statusOnly = STATUS_ONLY_FILTER.test(chain) && !IDENTITY_FILTER.test(chain);
          if (!statusOnly) continue;
        }

        // Builder pattern: `let q = supabase.from(…)…;` bounded LATER via
        // `await q.range(from, to)`. The bound is in a different statement, so a
        // statement-scoped read cannot see it and reports a false positive —
        // three of them on the first run, all verified bounded by hand. Follow
        // the variable instead.
        const assigned = assignedNameBefore(src, m.index ?? 0);
        if (assigned && boundedLater(src, assigned, (m.index ?? 0) + chain.length)) continue;

        offenders.push(`${relative(WEB, file)}:${src.slice(0, m.index).split('\n').length} (${m[1]})`);
      }
    }
  }
  return offenders;
}

describe('no request path reads a growing table whole', () => {
  it('scans a meaningful number of queries, so zero means checked', () => {
    // A scan matching nothing also reports no offenders.
    let queries = 0;
    for (const dir of ['app', 'lib']) {
      for (const file of sourceFiles(join(WEB, dir))) {
        queries += [...readFileSync(file, 'utf8').matchAll(/\.from\('\w+'\)/g)].length;
      }
    }
    expect(queries).toBeGreaterThan(200);
  });

  it('has no unbounded whole-table select', () => {
    const offenders = findWholeTableReads();
    expect(
      offenders,
      'These read an entire growing table with no limit, range, or filter.\n' +
        'Cheap now, a timeout later, and it never announces the change:\n  ' +
        offenders.join('\n  '),
    ).toEqual([]);
  });

  it('keeps the homepage category scan bounded and self-reporting', () => {
    const src = readFileSync(join(WEB, 'lib/home-data.ts'), 'utf8');
    expect(src).toMatch(/CATEGORY_STATS_CEILING/);
    expect(src).toMatch(/\.limit\(CATEGORY_STATS_CEILING\)/);
    // A silent truncation would under-report every category below the cut while
    // the grid still looked correct. Hitting the ceiling has to be noticeable.
    expect(src).toMatch(/rows\.length >= CATEGORY_STATS_CEILING/);
    expect(src).toMatch(/console\.warn/);
  });
});
