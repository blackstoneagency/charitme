// One-route overflow explainer.
//
//   node scripts/probe-overflow.mjs <baseUrl> <path> [width]
//
// audit-mobile names the elements that widen a page. This says WHY: for the
// widest offender it prints the whole ancestor chain with each box's width, the
// computed properties that decide whether a box can shrink (display, flex/grid
// role, min-width, white-space, overflow-x), and where along the chain the width
// first exceeds the viewport. That transition is the element to fix; everything
// below it is inheriting.
//
// Written after four rounds of guessing from class names alone, two of which
// fixed the wrong element.
import { chromium } from 'playwright';

const [, , base, path, widthArg] = process.argv;
if (!base || !path) {
  console.error('usage: node scripts/probe-overflow.mjs <baseUrl> <path> [width]');
  process.exit(2);
}
const VW = Number(widthArg ?? 390);

const cookie = process.env.STUB_SESSION_COOKIE ? JSON.parse(process.env.STUB_SESSION_COOKIE) : null;

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: VW, height: 780 }, isMobile: true, hasTouch: true });
if (cookie) await ctx.addCookies([{ name: cookie.name, value: cookie.value, url: base }]);
const page = await ctx.newPage();
await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(400);

const report = await page.evaluate((vw) => {
  const clips = (el) => {
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
    }
    return false;
  };
  let worst = null;
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= vw + 1) continue;
    if (clips(el)) continue;
    if (!worst || r.right > worst.rect.right) worst = { el, rect: r };
  }
  if (!worst) return { scrollW: document.body.scrollWidth, chain: [] };

  const describe = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().slice(0, 60),
      width: Math.round(r.width),
      right: Math.round(r.right),
      display: cs.display,
      minWidth: cs.minWidth,
      whiteSpace: cs.whiteSpace,
      overflowX: cs.overflowX,
      flexWrap: cs.flexWrap,
      gridCols: cs.gridTemplateColumns.slice(0, 60),
      inline: el.getAttribute('style')?.slice(0, 80) ?? '',
    };
  };

  const chain = [];
  for (let el = worst.el; el && el !== document.documentElement; el = el.parentElement) chain.unshift(describe(el));
  return { scrollW: document.body.scrollWidth, chain };
}, VW);

console.log(`${path} @ ${VW}px — content ${report.scrollW}px`);
if (report.chain.length === 0) {
  console.log('  no unclipped element crosses the edge');
} else {
  let flagged = false;
  for (const n of report.chain) {
    // Mark the FIRST box on the way down that exceeds the viewport. That is
    // where the width is introduced; its descendants merely inherit it.
    const marker = !flagged && n.width > VW ? '>>' : '  ';
    if (n.width > VW) flagged = true;
    console.log(`${marker} <${n.tag}> ${n.cls ? `.${n.cls}` : ''} w=${n.width} right=${n.right}`);
    console.log(`     display=${n.display} min-width=${n.minWidth} white-space=${n.whiteSpace} overflow-x=${n.overflowX} flex-wrap=${n.flexWrap}`);
    if (n.gridCols && n.gridCols !== 'none') console.log(`     grid-cols=${n.gridCols}`);
    if (n.inline) console.log(`     style="${n.inline}"`);
  }
}

await b.close();
