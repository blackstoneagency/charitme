import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// /corporate-partnerships showed four invented figures and three invented
// testimonials to prospective partners:
//
//   $48M+ Raised by corporate partners · 2,100+ Corporate partners worldwide
//   6.2M+ Lives positively impacted    · 1.8M+ Volunteer hours contributed
//
//   "Erin W., Director of Corporate Responsibility"
//   "David L., VP, Global Impact"
//   "Maria G., Head of Social Impact"
//
// None of it exists in the data, and there is no testimonials table. The
// figures are the same class already removed from /about-us and refused on
// /impact; the quotes are worse, because fabricated testimony attributed to
// named individuals with job titles reads as verifiable and is not.
//
// This guard is deliberately about the LITERALS, not about the file's shape:
// a future edit may legitimately re-add a stats band or a quotes section
// driven by owner-authored, source-noted data. What must never come back is
// the invented content itself.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE = path.join(__dirname, '..', 'app', 'corporate-partnerships', 'page.tsx');
const source = readFileSync(PAGE, 'utf8');
// Comments explain what was removed and naturally quote it, so they must not
// satisfy the assertions that the content is absent.
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('/corporate-partnerships makes no unverifiable claims', () => {
  it('is reading the real page', () => {
    expect(code).toContain('Ways to Partner');
    expect(code.length).toBeGreaterThan(2_000);
  });

  it('renders none of the invented impact figures', () => {
    for (const figure of ['$48M+', '2,100+', '6.2M+', '1.8M+']) {
      expect(code, `${figure} is fabricated`).not.toContain(figure);
    }
    expect(code).not.toMatch(/Lives positively impacted/i);
    expect(code).not.toMatch(/Volunteer hours contributed/i);
  });

  it('renders none of the invented testimonials', () => {
    for (const name of ['Erin W.', 'David L.', 'Maria G.']) {
      expect(code, `${name} is not a real partner`).not.toContain(name);
    }
    expect(code).not.toMatch(/Director of Corporate Responsibility/i);
    expect(code).not.toMatch(/VP, Global Impact/i);
    expect(code).not.toMatch(/Head of Social Impact/i);
  });
});
