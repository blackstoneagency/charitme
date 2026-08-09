import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const middleware = read('middleware.ts');
const builder = read('app/create/page.tsx');
/**
 * Comments stripped. The builder carries a note EXPLAINING why the old
 * step-shaped gate was wrong, and that note necessarily quotes the identifier —
 * matching raw text would fail on the explanation and teach the next author to
 * delete it. Same trap, and same fix, as the fabricated-figure guards elsewhere.
 */
const builderCode = builder
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/**
 * The builder is reachable without an account, and the two moments that need a
 * session ask for one themselves.
 *
 * ⚠️ The risk this file exists to police is NOT "can a guest see the page" — it
 * is that opening the page also opened a write. It did not: the builder holds a
 * draft in local state and reaches the database only through API routes, each of
 * which checks the session server-side. These tests pin both halves, because
 * either one silently reverting turns a deliberate funnel decision into a
 * security hole or back into a signup wall.
 */
describe('a guest can reach the builder', () => {
  it('/create is exempt from the protected-route redirect', () => {
    const line = middleware.split('\n').find((l) => l.startsWith('const PUBLIC_EXCEPTIONS'));
    expect(line, 'PUBLIC_EXCEPTIONS is gone').toBeTruthy();
    expect(line).toContain("'/create'");
  });

  it('exempts /create EXACTLY, so nothing under it is opened by accident', () => {
    // `/create/ai` and any future child must stay protected. A `startsWith`
    // match here would open all of them, which is why the exemption test reads
    // the comparison and not just the list.
    expect(middleware).toContain('!PUBLIC_EXCEPTIONS.some((p) => path === p)');
    expect(middleware).not.toContain('PUBLIC_EXCEPTIONS.some((p) => path.startsWith(p))');
  });

  it('still protects the rest of the console', () => {
    const line = middleware.split('\n').find((l) => l.startsWith('const PROTECTED'));
    for (const p of ['/create', '/dashboard', '/profile', '/admin']) {
      expect(line, `${p} left the protected list`).toContain(`'${p}'`);
    }
  });
});

describe('the session is still required where it matters', () => {
  it('publishing asks a guest to sign in rather than posting anonymously', () => {
    // Both publish controls take this branch. If either ever calls publish()
    // directly for a guest, POST /api/campaigns rejects it — but the organizer
    // sees a failure instead of a sign-in prompt, having done all the work.
    const calls = builder.match(/if \(isGuest !== false\) \{ setLoginIntent\('publish'\); setShowLoginModal\(true\); \} else \{ void publish\(\); \}/g) ?? [];
    expect(calls.length, 'a publish control stopped gating guests').toBeGreaterThanOrEqual(2);
  });

  it('uploading asks at the moment the upload is attempted', () => {
    // Not on entering the media step: photos are optional to publish, so a guest
    // with no photo must never be asked at all.
    expect(builder).toContain("if (isGuest === true) { setLoginIntent('upload'); setShowLoginModal(true); return; }");
  });

  it('no step gates guests any more', () => {
    // The old gate keyed off a single step, which sat one step AFTER the upload
    // it was protecting. Nothing should reintroduce a step-shaped gate.
    expect(builderCode).not.toContain('GUEST_GATE_STEP: WizardStep');
    expect(builderCode).not.toMatch(/step === GUEST_GATE_STEP/);
  });

  it('signing in to upload does not publish the campaign', () => {
    // The success handler used to infer intent from the current step. With two
    // callers able to fire on the same step, that inference would publish a
    // campaign because someone signed in to attach a photo.
    expect(builder).toContain("if (loginIntent === 'publish') void publish();");
    expect(builderCode).not.toMatch(/if \(step === GUEST_GATE_STEP\) \{[\s\S]*?void publish\(\)/);
  });
});
