#!/usr/bin/env node
/**
 * Lightweight concurrent load probe for the public read paths.
 *
 * Not a replacement for a real load-testing rig, but it answers the questions
 * that actually matter before launch: do the hot pages stay correct and
 * reasonably fast under simultaneous traffic, and does anything 5xx or fall over
 * when many requests hit the same Supabase-backed route at once?
 *
 *   node scripts/load-test.mjs [--base http://127.0.0.1:3100] [--concurrency 20] [--requests 200]
 *
 * Exits 1 if any request fails or p95 exceeds --budget ms.
 */
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://127.0.0.1:3100');
const CONCURRENCY = Number(arg('concurrency', 20));
const REQUESTS = Number(arg('requests', 200));
const BUDGET_MS = Number(arg('budget', 2000));

const PATHS = ['/', '/campaigns', '/leaderboard', '/grants', '/events', '/pricing', '/faq', '/supported-countries'];

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

async function run(path) {
  const times = [];
  const errors = [];
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < REQUESTS) {
      next++;
      const t0 = performance.now();
      try {
        const r = await fetch(BASE + path, { headers: { 'cache-control': 'no-cache' } });
        const ms = performance.now() - t0;
        // Drain the body so the timing includes transfer, not just headers.
        await r.arrayBuffer();
        if (!r.ok) errors.push(r.status);
        else times.push(ms);
      } catch (e) {
        errors.push(String(e.message).slice(0, 40));
      }
    }
  }));
  times.sort((a, b) => a - b);
  return { path, ok: times.length, errors, p50: pct(times, 50), p95: pct(times, 95), max: times.at(-1) };
}

console.log(`Load probe: ${REQUESTS} requests @ concurrency ${CONCURRENCY} per path, budget p95 < ${BUDGET_MS}ms\n`);
let failed = 0;
for (const p of PATHS) {
  const r = await run(p);
  const bad = r.errors.length > 0 || r.p95 > BUDGET_MS;
  if (bad) failed++;
  console.log(
    `${bad ? 'FAIL' : ' ok '} ${p.padEnd(22)} ok=${String(r.ok).padStart(4)} err=${String(r.errors.length).padStart(3)}` +
    `  p50=${Math.round(r.p50)}ms p95=${Math.round(r.p95)}ms max=${Math.round(r.max)}ms`,
  );
  if (r.errors.length) console.log(`     errors: ${[...new Set(r.errors)].slice(0, 5).join(', ')}`);
}
console.log(failed === 0 ? '\n✅ All paths served cleanly under load.' : `\n${failed} path(s) failed.`);
process.exitCode = failed === 0 ? 0 : 1;
