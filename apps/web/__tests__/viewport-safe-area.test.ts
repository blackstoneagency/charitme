import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// `viewportFit: 'cover'` and `env(safe-area-inset-*)` are ONE change, not two.
//
// This exists because of a finding I got backwards. `.kf-set-toast` is
// `position: fixed; bottom: 28px`, and I recorded it as overlapping the ~34px
// iPhone home indicator. It does not — and the reason is the very setting the
// proposed fix would have changed.
//
// The viewport-fit default is `contain`: iOS lays the page out inside the
// largest rectangle that fits the display's SAFE area, so nothing renders under
// the home indicator, the notch or the rounded corners. `bottom: 28px` is 28px
// above the safe area's own edge. `env(safe-area-inset-*)` correctly returns 0
// there, because there is nothing to inset past.
//
// `viewport-fit=cover` opts OUT of that: the page then extends edge to edge and
// every edge-anchored element becomes the author's problem. That is why adding
// it alone is worse than not adding it — it introduces the exact defect the
// insets exist to fix, across every fixed and full-bleed element at once.
//
// So this test does not forbid `cover`. It forbids `cover` WITHOUT insets.
// ─────────────────────────────────────────────────────────────────────────────

const WEB_ROOT = path.join(__dirname, '..');
const layout = readFileSync(path.join(WEB_ROOT, 'app', 'layout.tsx'), 'utf8');
const css = readFileSync(path.join(WEB_ROOT, 'app', 'globals.css'), 'utf8');

const declaresCover = /viewportFit:\s*['"]cover['"]|viewport-fit=cover/.test(layout);
const insetUses = [...css.matchAll(/env\(\s*safe-area-inset-(top|right|bottom|left)/g)];
const insetSides = new Set(insetUses.map((m) => m[1]));

describe('viewport-fit and safe-area insets move together', () => {
  it('the layout still exports a viewport, so this test is reading the right thing', () => {
    expect(layout).toMatch(/export const viewport/);
  });

  it('does not opt into edge-to-edge without handling all four insets', () => {
    if (!declaresCover) {
      // Current state: `contain`, so iOS keeps content out of the unsafe areas
      // and no inset is needed. Nothing to check.
      expect(insetSides.size, 'insets are pointless without viewport-fit=cover — env() returns 0').toBe(0);
      return;
    }
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(insetSides.has(side), `viewport-fit=cover is set but no rule uses safe-area-inset-${side}`).toBe(true);
    }
  });

  it('never blocks pinch-zoom', () => {
    expect(layout).not.toMatch(/userScalable:\s*false|maximumScale:\s*1/);
  });
});
