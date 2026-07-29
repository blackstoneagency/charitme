import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

// Shared Chromium resolution for the audit scripts.
//
// Every audit needs the same answer to "which browser do I launch", and they had
// three different ones: some hardcoded the sandbox path, some consulted
// PLAYWRIGHT_CHROMIUM_PATH, and audit-contrast built a candidate list that omitted
// the sandbox path entirely. That last one only surfaced when audit-signed-in ran
// it as a CHILD process without the env var set — Playwright fell back to a
// headless-shell build that is not installed here and printed its "run npx
// playwright install" banner, which reads as a broken setup rather than a missing
// path. audit-scroll-keyboard.mjs already carried a comment about exactly this:
// an audit that cannot launch produces NO signal, which is indistinguishable from
// a clean run to anyone reading an exit code.
//
// Order: explicit env var, then the sandbox's prebuilt browser, then Playwright's
// own download, then common system installs. Every candidate is existence-checked,
// so a stale path never wins over a real one.
export function resolveChromium() {
  let playwrightPath = null;
  try { playwrightPath = chromium.executablePath(); } catch { /* not downloaded */ }

  return [
    process.env.PLAYWRIGHT_CHROMIUM_PATH,
    '/opt/pw-browsers/chromium',
    playwrightPath,
    process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe` : null,
    process.env['PROGRAMFILES(X86)'] ? `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe` : null,
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : null,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((candidate) => candidate && existsSync(candidate));
}

/** Launch options with the resolved executable, or none if nothing was found. */
export function chromiumLaunchOptions(extra = {}) {
  const executablePath = resolveChromium();
  return { ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'], ...extra };
}
