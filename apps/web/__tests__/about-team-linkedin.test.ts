import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTeam, parseLinkedIn } from '../lib/about-page';

const here = dirname(fileURLToPath(import.meta.url));
const card = readFileSync(join(here, '..', 'app', 'about-us', 'AboutTeam.tsx'), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// The reference shows a small "in" control under each face. It is the one part
// of that section safe to build: a LinkedIn URL is entered by an administrator,
// unlike the six named executives, which are claims about real humans and are
// deliberately not shipped.
//
// ⚠️ THE RENDER ASSERTIONS HERE ARE SOURCE-LEVEL, AND THAT IS A LIMITATION.
// This repo cannot render a component in a test: `vitest.config.ts` collects
// `__tests__/**/*.test.ts` only, and importing a `.tsx` fails to transform
// because Next sets `jsx: 'preserve'` in tsconfig. `esbuild.jsx` and a
// `tsconfigRaw` override were both tried; vite's import analysis still refuses.
// Making it work needs `@vitejs/plugin-react`, which is not installed — a
// shared-toolchain dependency that should be added deliberately, not as a side
// effect of an About-page change.
//
// The consequence is worth naming rather than hiding: a render bug in this card
// would pass every assertion below. The URL parsing underneath it is pure, so
// that half IS executed.
// ─────────────────────────────────────────────────────────────────────────────

describe('the LinkedIn control the reference shows', () => {
  it('renders only when a profile was configured', () => {
    // An icon that links nowhere is worse than no icon.
    expect(card).toMatch(/\{member\.linkedin && \(/);
  });

  it('leaves the site safely', () => {
    expect(card).toContain('rel="noreferrer noopener"');
    expect(card).toContain('target="_blank"');
  });

  it('names the link per person rather than just "LinkedIn"', () => {
    // Six links all called "LinkedIn" are indistinguishable to someone tabbing
    // the row with a screen reader.
    expect(card).toMatch(/aria-label=\{`\$\{member\.name\} on LinkedIn`\}/);
  });

  it('still ships no invented people alongside it', () => {
    for (const invented of ['Sarah', 'Michael', 'Aisha', 'Chief Executive']) {
      expect(card).not.toContain(invented);
    }
  });
});

describe('a LinkedIn URL is checked for being LinkedIn', () => {
  it('accepts real profile URLs', () => {
    expect(parseLinkedIn('https://www.linkedin.com/in/ada')).toBe('https://www.linkedin.com/in/ada');
    expect(parseLinkedIn('https://linkedin.com/in/ada')).toBe('https://linkedin.com/in/ada');
    expect(parseLinkedIn('https://uk.linkedin.com/in/ada')).toBe('https://uk.linkedin.com/in/ada');
  });

  it('rejects the two tricks a substring match would let through', () => {
    // Both CONTAIN "linkedin.com" and neither is LinkedIn. Comparing the parsed
    // HOSTNAME is the only form that gets both right, which is why the parser
    // builds a URL rather than running a regex over the string.
    expect(parseLinkedIn('https://evil.com/linkedin.com/in/ada')).toBeUndefined();
    expect(parseLinkedIn('https://linkedin.com.evil.com/in/ada')).toBeUndefined();
  });

  it('rejects anything not https', () => {
    expect(parseLinkedIn('http://www.linkedin.com/in/ada')).toBeUndefined();
    expect(parseLinkedIn('javascript:alert(1)')).toBeUndefined();
    expect(parseLinkedIn('not a url')).toBeUndefined();
    expect(parseLinkedIn(undefined)).toBeUndefined();
  });

  it('flows through the roster parser, so a bad link drops the LINK not the person', () => {
    const [member] = parseTeam([
      { name: 'Ada Lovelace', title: 'Head of Impact', linkedin: 'http://linkedin.com/in/ada' },
    ]);
    expect(member.name, 'the person must survive a bad link').toBe('Ada Lovelace');
    expect(member.linkedin).toBeUndefined();
  });

  it('keeps a good link', () => {
    const [member] = parseTeam([
      { name: 'Ada Lovelace', title: 'Head of Impact', linkedin: 'https://www.linkedin.com/in/ada' },
    ]);
    expect(member.linkedin).toBe('https://www.linkedin.com/in/ada');
  });
});
