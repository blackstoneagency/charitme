// Mobile layout audit: no page may scroll horizontally on a phone.
//
//   node scripts/audit-mobile.mjs [baseUrl]
//
// A page wider than the viewport is the single most visible mobile defect —
// text runs off the edge and the whole layout slides sideways. PR #49 and PR
// #127 each fixed this on /ai-fundraising, the second time as a REGRESSION,
// because the check lived in a session transcript rather than in a script. This
// makes it repeatable.
//
// 320px is the narrowest phone still in use (iPhone SE 1st gen); 390px is a
// current iPhone. Both are checked because a layout can pass one and fail the
// other.
//
// When a page overflows, the offending elements are named with their widths —
// a bare "page is 410px" tells you nothing about which node did it. Follows
// audit-a11y.mjs: a page that never loaded is a failed audit, not a silent pass.
import { chromium } from 'playwright';
import routes from '../e2e/public-routes.json' with { type: 'json' };

const list = Array.isArray(routes) ? routes : (routes.routes ?? routes.public ?? []);

const BASE = process.argv[2] || 'http://127.0.0.1:3000';
const WIDTHS = [320, 390];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const failures = [];
const errors = [];
let analyzed = 0;

for (const width of WIDTHS) {
  const ctx = await b.newContext({
    viewport: { width, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  for (const r of list) {
    const path = typeof r === 'string' ? r : r.path;
    try {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(350);
      analyzed++;

      const result = await page.evaluate((vw) => {
        const doc = document.documentElement;
        const scrollW = Math.max(doc.scrollWidth, document.body.scrollWidth);
        if (scrollW <= vw + 1) return null;
        // Name the widest elements that actually cross the viewport edge.
        const guilty = [];
        for (const el of document.querySelectorAll('body *')) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.right <= vw + 1) continue;
          guilty.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || '').toString().slice(0, 48),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          });
        }
        guilty.sort((a, c) => c.right - a.right);
        // Keep the outermost few; children inherit their parent's overflow.
        return { scrollW, guilty: guilty.slice(0, 4) };
      }, width);

      if (result) {
        failures.push({ path, width, ...result });
        console.log(`✗ ${width}px ${path} — document is ${result.scrollW}px`);
        for (const g of result.guilty) {
          console.log(`      <${g.tag}> class="${g.cls}" width=${g.width} right=${g.right}`);
        }
      }
    } catch (e) {
      errors.push(`${width}px ${path}`);
      console.log(`! ${width}px ${path} — ${String(e.message).slice(0, 60)}`);
    }
  }
  await ctx.close();
  console.log(`· ${width}px: swept ${list.length} routes`);
}
await b.close();

if (errors.length) {
  console.log(`\n⚠️  ${errors.length} page load(s) failed — is the server up on ${BASE}?`);
  console.log(`   Only ${analyzed} page(s) were analyzed, so a clean result here would be meaningless.`);
  process.exit(1);
}

if (failures.length) {
  console.log(`\n${failures.length} horizontal overflow(s) across ${analyzed} page loads.`);
  process.exit(1);
}
console.log(`\n✅ No horizontal overflow across ${analyzed} page loads (${list.length} routes × ${WIDTHS.length} widths)`);
