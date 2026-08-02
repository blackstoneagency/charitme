import { chromium } from 'playwright';
import routes from '../e2e/public-routes.json' with { type: 'json' };
const BASE = 'http://localhost:4312';
const list = (Array.isArray(routes) ? routes : (routes.public ?? routes.routes ?? []))
  .filter(r => !r.includes('[') && !r.includes(':'));
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });
const findings = [];
let renders = 0;
for (const theme of ['light','dark']) {
  const ctx = await b.newContext({ viewport:{width:320,height:800}, colorScheme: theme });
  const p = await ctx.newPage();
  for (const r of list) {
    try {
      const resp = await p.goto(BASE+r, { waitUntil:'load', timeout:20000 });
      await p.evaluate(()=>document.fonts.ready);
      renders++;
      const res = await p.evaluate(() => ({
        sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        h1: document.querySelectorAll('h1').length,
        noAlt: [...document.querySelectorAll('img')].filter(i=>!i.hasAttribute('alt')).length,
        noName: [...document.querySelectorAll('button')].filter(x=>!(x.textContent||'').trim() && !x.getAttribute('aria-label') && !x.getAttribute('title')).length,
        main: !!document.querySelector('main, #main-content'),
      }));
      const st = resp.status();
      if (st >= 400) findings.push(`${r} [${theme}] HTTP ${st}`);
      else {
        if (res.sw > res.cw + 1) findings.push(`${r} [${theme}] OVERFLOW ${res.sw}>${res.cw}`);
        if (res.h1 !== 1) findings.push(`${r} [${theme}] h1=${res.h1}`);
        if (res.noAlt) findings.push(`${r} [${theme}] ${res.noAlt} img no alt`);
        if (res.noName) findings.push(`${r} [${theme}] ${res.noName} btn no name`);
        if (!res.main) findings.push(`${r} [${theme}] no main landmark`);
      }
    } catch (e) { findings.push(`${r} [${theme}] ERR ${e.message.slice(0,60)}`); }
  }
  await ctx.close();
}
await b.close();
console.log('renders:', renders, 'of', list.length*2);
console.log(findings.length ? findings.join('\n') : 'CLEAN');
console.log('findings:', findings.length);
