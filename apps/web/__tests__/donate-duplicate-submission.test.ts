import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// §1: "Prevent duplicate submissions."
//
// Two defects made the existing protection inert, and each hid the other:
//
//  1. The Idempotency-Key was `crypto.randomUUID()` written INLINE in the fetch
//     call, so every POST carried a different key. Stripe's idempotency does
//     nothing with a unique key — a duplicated or retried request created a
//     SECOND Checkout Session, while the code read as though it were protected.
//
//  2. `disabled={loading}` looked like a click guard, but `setLoading(true)` ran
//     AFTER `await supabase.auth.getUser()`. Between the click and the re-render
//     the button was still live, so two rapid clicks both got through.
//
// Together: two clicks, two keys, two sessions.
// ─────────────────────────────────────────────────────────────────────────────

/** Code only — a guard that reads its own explanation is checking prose. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
}

const button = readFileSync(
  path.join(__dirname, '..', 'app', 'campaigns', '[slug]', 'DonateButton.tsx'),
  'utf8',
);

describe('the click guard closes before the first await', () => {
  it('uses a ref, which updates synchronously', () => {
    // React state does not update in time to guard a window that closes before
    // the next render. A ref does.
    expect(button).toContain('const submittingRef = useRef(false)');
  });

  it('checks and sets it as the first thing the handler does', () => {
    // ⚠️ Comments stripped first. The guard's own comment explains that it runs
    // "before any await" and therefore CONTAINS the word — so an index search
    // over the raw source finds the prose, not the code, and the comparison is
    // backwards. This repo has shipped that mistake in several guards.
    const handler = stripComments(button.slice(button.indexOf('const handleDonate = async () => {')));
    const guard = handler.indexOf('if (submittingRef.current) return;');
    const firstAwait = handler.indexOf('await ');
    expect(guard, 'no re-entry guard').toBeGreaterThan(-1);
    expect(guard, 'the guard must precede every await').toBeLessThan(firstAwait);
  });

  it('releases it on every path that hands control back to the donor', () => {
    // Otherwise the button stays dead for the rest of the page's life — a bug
    // that presents as "the donate button stopped working".
    const handler = button.slice(button.indexOf('const handleDonate = async () => {'));
    const releases = handler.match(/submittingRef\.current = false/g) ?? [];
    // minimum <100, maximum >MAX, guest-email prompts (2), and the catch.
    expect(releases.length).toBeGreaterThanOrEqual(5);
  });
});

describe('the idempotency key is stable within one attempt', () => {
  it('is not generated inline in the fetch call', () => {
    // The exact defect: a fresh uuid per request makes Stripe's idempotency a
    // no-op while looking like protection.
    expect(button).not.toMatch(/'Idempotency-Key':\s*crypto\.randomUUID\(\)/);
  });

  it('comes from a ref minted once per attempt', () => {
    expect(button).toContain("const attemptKeyRef = useRef<string>('')");
    expect(button).toContain("'Idempotency-Key': attemptKeyRef.current");
    expect(button).toContain('if (!attemptKeyRef.current) attemptKeyRef.current = crypto.randomUUID()');
  });

  it('clears the key when the attempt fails', () => {
    // A deliberate retry is a NEW attempt: the donor may have changed the
    // amount, and reusing the key would return Stripe's session for the old one.
    const catchBlock = button.slice(button.indexOf('} catch (e: unknown) {'));
    expect(catchBlock).toContain("attemptKeyRef.current = ''");
  });
});

describe('the server still builds its key from the header', () => {
  const route = readFileSync(
    path.join(__dirname, '..', 'app', 'api', 'donations', 'route.ts'),
    'utf8',
  );

  it('reads the client key and scopes it to the donation', () => {
    // Scoping to campaign + amount + user means a stale key cannot be replayed
    // against a different donation.
    expect(route).toMatch(/request\.headers\.get\('idempotency-key'\)/);
    expect(route).toMatch(/donation_\$\{campaignId\}_\$\{amountCents\}/);
  });
});
