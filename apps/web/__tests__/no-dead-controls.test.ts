import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ─────────────────────────────────────────────────────────────────────────────
// A button that does nothing is worse than no button: it invites a click and
// then silently fails. An earlier audit of Settings removed ten of these; this
// guard stops them coming back on user-facing surfaces.
//
// Scope is deliberate:
//  • `app/admin/**` is excluded — internal tooling with its own known backlog of
//    placeholder controls; gating it here would freeze that cleanup rather than
//    help it, and it is not a surface real users touch.
//  • Only <button> is checked. A styled <span>/<div> is not announced as a
//    control, and links are covered by the broken-link crawl.
// ─────────────────────────────────────────────────────────────────────────────

const HANDLER_ATTRS = [
  'onClick', 'onMouseDown', 'onPointerDown', 'onKeyDown', 'onSubmit',
  'type="submit"', "type='submit'", 'form=',
  '{...', // spread props may carry a handler
];

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    if (name === 'node_modules' || name === '.next') return [];
    const path = join(root, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith('.tsx') ? [path] : [];
  });
}

/** Yields each `<button …>` opening tag, respecting braces in JSX expressions. */
function buttonTags(source: string): { index: number; tag: string }[] {
  const out: { index: number; tag: string }[] = [];
  let i = source.indexOf('<button');
  while (i >= 0) {
    let depth = 0;
    let j = i;
    while (j < source.length) {
      const c = source[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
      j++;
    }
    out.push({ index: i, tag: source.slice(i, j + 1) });
    i = source.indexOf('<button', j + 1);
  }
  return out;
}

describe('no dead buttons on user-facing surfaces', () => {
  it('every <button> outside admin has a handler, submits, or is disabled', () => {
    const files = [
      ...sourceFiles(join(WEB_ROOT, 'app')),
      ...sourceFiles(join(WEB_ROOT, 'components')),
    ].filter((path) => !path.includes(`${'app'}/admin/`));

    const offenders: string[] = [];
    for (const path of files) {
      const source = readFileSync(path, 'utf8');
      for (const { index, tag } of buttonTags(source)) {
        if (HANDLER_ATTRS.some((attr) => tag.includes(attr))) continue;
        // A disabled button is an intentional, visibly-inert affordance.
        if (/\bdisabled\b/.test(tag)) continue;
        const line = source.slice(0, index).split('\n').length;
        offenders.push(`${relative(WEB_ROOT, path)}:${line}  ${tag.replace(/\s+/g, ' ').slice(0, 80)}`);
      }
    }

    expect(
      offenders,
      `These buttons do nothing when clicked:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
