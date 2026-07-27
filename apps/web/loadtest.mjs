// Measure the SAME pages with and without the readiness gate, under identical load.
import { chromium } from '@playwright/test';
const PAGES = ['/offline','/login','/forgot-password','/','/pricing'];
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });
async function sweep(gated) {
  const ctx = await b.newContext({ viewport:{width:768,height:900}, colorScheme:'light' });
  await ctx.addInitScript(()=>{try{localStorage.setItem('charitme-theme-v2','light')}catch{}});
  const p = await ctx.newPage();
  let overlaps = 0;
  for (const path of PAGES) {
    await p.goto('http://127.0.0.1:3200'+path, { waitUntil:'domcontentloaded' });
    if (gated) { await p.waitForLoadState('load').catch(()=>{}); await p.evaluate(()=>document.fonts?.ready??Promise.resolve()).catch(()=>{}); }
    await p.waitForTimeout(350);
    overlaps += await p.evaluate(() => {
      const els=[...document.querySelectorAll('a,button')].filter(e=>e.offsetParent!==null);
      let n=0;
      for (let i=0;i<els.length;i++) for (let j=i+1;j<els.length;j++){
        const a=els[i].getBoundingClientRect(), c=els[j].getBoundingClientRect();
        if(a.width<8||c.width<8) continue;
        if(a.left<c.right&&c.left<a.right&&a.top<c.bottom&&c.top<a.bottom) n++;
      }
      return n;
    });
  }
  await ctx.close();
  return overlaps;
}
// Create contention.
const load = [];
for (let i=0;i<6;i++) load.push((async()=>{ const c=await b.newContext(); const q=await c.newPage(); for(let k=0;k<12;k++) await q.goto('http://127.0.0.1:3200/campaigns',{waitUntil:'domcontentloaded'}).catch(()=>{}); await c.close(); })());
const ungated = await sweep(false);
const gated   = await sweep(true);
await Promise.allSettled(load);
console.log(`UNGATED overlaps: ${ungated}`);
console.log(`GATED   overlaps: ${gated}`);
await b.close();
