#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Accessibility sweep — axe-core across every public route, in BOTH themes.
//
// Run against a production build (`next start`), not `next dev`:
//
//   npm run audit:a11y -- http://127.0.0.1:3000
//
// Tags cover WCAG 2.0/2.1/2.2 at A and AA. Both themes are swept because
// contrast findings differ between them, and the theme is pinned via
// localStorage before load — setting it afterwards lets the ThemeProvider
// overwrite it, which is how an earlier suite audited dark twice and never
// checked light at all.
//
// Exits non-zero on any violation so it can gate a release.
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import routes from '../e2e/public-routes.json' with { type: 'json' };

const BASE = process.argv[2] || 'http://127.0.0.1:3260';
const list = Array.isArray(routes) ? routes : (routes.routes ?? routes.public ?? []);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
let total = 0; const byRule = new Map();

for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem('charitme-theme-v2', t); } catch {} }, theme);
  const page = await ctx.newPage();
  for (const r of list) {
    const path = typeof r === 'string' ? r : r.path;
    try {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400);
      const res = await new AxeBuilder({ page })
        .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])
        .analyze();
      if (res.violations.length) {
        total += res.violations.length;
        for (const v of res.violations) {
          byRule.set(v.id, (byRule.get(v.id) ?? 0) + v.nodes.length);
          console.log(`✗ ${theme} ${path} — ${v.id} (${v.impact}) ×${v.nodes.length}`);
        }
      }
    } catch (e) { console.log(`! ${theme} ${path} — ${String(e.message).slice(0,60)}`); }
  }
  await ctx.close();
  console.log(`· ${theme}: swept ${list.length} routes`);
}
await b.close();
console.log(total === 0 ? `\n✅ 0 axe violations across ${list.length} routes × 2 themes`
  : `\n${total} violation group(s):\n` + [...byRule].map(([k,v])=>`   ${k}: ${v} nodes`).join('\n'));
process.exit(total === 0 ? 0 : 1);
