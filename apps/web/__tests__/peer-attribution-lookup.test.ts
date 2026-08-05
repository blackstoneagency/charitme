import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROUTE = join(here, '..', 'app', 'api', 'donations', 'route.ts');
const MIGRATION = join(
  here, '..', '..', '..', 'supabase', 'migrations',
  '20260816000000_record_donation_peer_attribution.sql',
);

/** Strip comments — prose explaining a fix must not satisfy an assertion about it. */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// ─────────────────────────────────────────────────────────────────────────────
// A donation given through a supporter's team page must be credited to them.
//
// The pre-check in /api/donations discarded its `error`, so "this id is stale or
// forged" and "we could not check" both became `null` — and only the VERIFIED id
// is written into Stripe metadata. That makes the loss unrecoverable: the webhook
// has nothing to re-check, `record_donation` receives NULL, and the gift is
// permanently a direct donation while the supporter's total never moves.
//
// The fix passes the REQUESTED id through when the check could not run, because
// `record_donation` re-runs the identical rule server-side under SECURITY
// DEFINER. That is only safe while the server-side rule actually exists — which
// is why the last test here reads the migration rather than trusting the comment.
// ─────────────────────────────────────────────────────────────────────────────

describe('peer attribution distinguishes "not valid" from "could not check"', () => {
  const src = strip(readFileSync(ROUTE, 'utf8'));

  it('captures the error instead of discarding it', () => {
    expect(
      /const \{ data: peer, error: peerError \}/.test(src),
      'the lookup must observe its own failure',
    ).toBe(true);
  });

  it('falls back to the requested id ONLY on a read failure', () => {
    // The three outcomes must stay distinct: verified → that id; no row → null;
    // read failed → defer to the server-side check.
    expect(src).toMatch(/if \(peerError\)[\s\S]{0,400}peerIdToRecord = peerFundraiserId;/);
    expect(
      src,
      'a genuine "no such peer" must still record NULL, not the requested id',
    ).toMatch(/peerIdToRecord = \(peer as \{ id: string \} \| null\)\?\.id \?\? null;/);
  });

  it('never sends an unverified id without that fallback being deliberate', () => {
    // Guards against someone "simplifying" this to always pass the raw input,
    // which would put a forged id in metadata whenever the read SUCCEEDS and
    // returned no row — the one case the server-side check is not a backstop for
    // being reached at all.
    expect(src).not.toMatch(/peerIdToRecord = peerFundraiserId;\s*\n\s*\}\s*\n\s*\/\/ ── Campaign currency/);
    expect(src).toMatch(/peerFundraiserId:\s+peerIdToRecord \?\? '',/);
  });

  it('records the deferral rather than doing it silently', () => {
    expect(src).toMatch(/console\.error\(\s*'\[donations\] peer verification unavailable/);
  });

  it('the server-side rule the fallback depends on actually exists', () => {
    // This is the load-bearing assumption. If `record_donation` ever stops
    // re-checking, the fallback becomes a forgery hole rather than belt and
    // braces, and this must fail loudly.
    const sql = readFileSync(MIGRATION, 'utf8').toLowerCase();
    expect(sql, 'record_donation must re-verify the peer id').toMatch(
      /from peer_fundraisers[\s\S]{0,200}where id = p_peer_fundraiser_id[\s\S]{0,200}parent_campaign_id = p_campaign_id/,
    );
    expect(
      sql,
      'and it must scope the check to the campaign being donated to, not just the id',
    ).toContain('parent_campaign_id = p_campaign_id');
  });
});
