import { describe, expect, it } from 'vitest';
import {
  campaignDaysLeft,
  campaignLifecycle,
  campaignTimeLabel,
  isCampaignAcceptingDonations,
} from '../lib/campaign-lifecycle';

// The bug this pins, exactly as it shipped: a campaign panel showing
// "136 days left" directly above "This campaign has ended." The countdown read
// the deadline alone; the call-to-action also read `status`. Both were rendered
// at the same moment and they disagreed.

const NOW = Date.UTC(2026, 0, 1);
const inDays = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

describe('the shipped contradiction', () => {
  const ended136 = { status: 'completed', deadline: inDays(136) };

  it('never says "days left" for a campaign that has ended', () => {
    expect(campaignTimeLabel(ended136, NOW)).toBe('Ended');
    expect(campaignTimeLabel(ended136, NOW)).not.toContain('days left');
  });

  it('agrees with the call-to-action it sits beside', () => {
    expect(campaignLifecycle(ended136, NOW)).toBe('ended');
    expect(isCampaignAcceptingDonations(ended136, NOW)).toBe(false);
  });
});

describe('campaignDaysLeft', () => {
  it('counts whole days to a future deadline', () => {
    expect(campaignDaysLeft(inDays(136), NOW)).toBe(136);
    expect(campaignDaysLeft(inDays(1), NOW)).toBe(1);
  });

  it('floors at zero for a past deadline rather than going negative', () => {
    expect(campaignDaysLeft(inDays(-5), NOW)).toBe(0);
  });

  it('returns null for no deadline', () => {
    expect(campaignDaysLeft(null, NOW)).toBeNull();
    expect(campaignDaysLeft(undefined, NOW)).toBeNull();
  });

  it('returns null — not 0 — for an unparseable deadline', () => {
    // "0 days left" would announce that a campaign ends today because a date
    // failed to parse. Missing data must read as missing.
    expect(campaignDaysLeft('not-a-date', NOW)).toBeNull();
  });
});

describe('campaignLifecycle', () => {
  it('is active when running, in date, accepting, and payout-ready', () => {
    expect(campaignLifecycle(
      { status: 'active', deadline: inDays(10), acceptDonations: true, payoutReady: true }, NOW,
    )).toBe('active');
  });

  it('is active with no deadline at all', () => {
    expect(campaignLifecycle({ status: 'active', deadline: null }, NOW)).toBe('active');
  });

  it.each(['completed', 'cancelled', 'draft', 'paused', 'pending', ''])(
    'is ended for status %p regardless of a future deadline',
    (status) => {
      expect(campaignLifecycle({ status, deadline: inDays(136) }, NOW)).toBe('ended');
    },
  );

  it('is ended once the deadline passes, even while status says active', () => {
    expect(campaignLifecycle({ status: 'active', deadline: inDays(-1) }, NOW)).toBe('ended');
    expect(campaignLifecycle({ status: 'active', deadline: inDays(0) }, NOW)).toBe('ended');
  });

  it('distinguishes paused from ended', () => {
    // Paused reads as "coming back"; ended does not. Collapsing them would tell
    // a donor a finished campaign might reopen.
    expect(campaignLifecycle(
      { status: 'active', deadline: inDays(10), acceptDonations: false }, NOW,
    )).toBe('paused');
  });

  it('reports payout-pending only while otherwise active', () => {
    expect(campaignLifecycle(
      { status: 'active', deadline: inDays(10), payoutReady: false }, NOW,
    )).toBe('payout-pending');
    // An ended campaign is never "payout pending" — that would imply it reopens.
    expect(campaignLifecycle(
      { status: 'completed', deadline: inDays(10), payoutReady: false }, NOW,
    )).toBe('ended');
  });

  it('treats a missing acceptDonations as accepting, matching the column default', () => {
    expect(campaignLifecycle({ status: 'active', deadline: inDays(10) }, NOW)).toBe('active');
    expect(campaignLifecycle(
      { status: 'active', deadline: inDays(10), acceptDonations: null }, NOW,
    )).toBe('active');
  });
});

describe('campaignTimeLabel', () => {
  it('reads naturally at the boundary', () => {
    expect(campaignTimeLabel({ status: 'active', deadline: inDays(1) }, NOW)).toBe('1 day left');
    expect(campaignTimeLabel({ status: 'active', deadline: inDays(2) }, NOW)).toBe('2 days left');
  });

  it('says "No deadline" for an open-ended live campaign', () => {
    expect(campaignTimeLabel({ status: 'active', deadline: null }, NOW)).toBe('No deadline');
  });

  it('says "Ended" — not "No deadline" — for a finished campaign with no deadline', () => {
    // "No deadline" on an ended campaign implies it is still open forever.
    expect(campaignTimeLabel({ status: 'completed', deadline: null }, NOW)).toBe('Ended');
  });

  it('still shows the countdown while merely paused', () => {
    // Paused is not over, so the remaining time is still meaningful.
    expect(campaignTimeLabel(
      { status: 'active', deadline: inDays(7), acceptDonations: false }, NOW,
    )).toBe('7 days left');
  });

  it('can never contradict the lifecycle', () => {
    // The property that matters, swept across the interesting combinations.
    for (const status of ['active', 'completed', 'cancelled', 'draft']) {
      for (const d of [-10, 0, 1, 136]) {
        const input = { status, deadline: inDays(d) };
        const label = campaignTimeLabel(input, NOW);
        if (campaignLifecycle(input, NOW) === 'ended') {
          expect(label, `${status} @ ${d}d`).toBe('Ended');
        } else {
          expect(label, `${status} @ ${d}d`).toMatch(/left$|^No deadline$/);
        }
      }
    }
  });
});

describe('no surface re-implements the countdown', () => {
  // This bug existed because "days left" was computed independently in four
  // places and only one of them consulted `status`. A single shared helper only
  // helps if new code uses it, so this fails when a fresh inline copy appears.
  it('renders "days left" only via campaignTimeLabel', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');

    const walk = (dir: string, out: string[] = []): string[] => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '.next') continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.tsx?$/.test(full)) out.push(full);
      }
      return out;
    };

    const offenders: string[] = [];
    // `lib` included deliberately: the first version of this guard walked only
    // app/ and components/, and a TENTH copy was sitting in lib/home-data.ts —
    // a guard is only as broad as the directories it looks in.
    for (const dir of ['app', 'components', 'lib']) {
      for (const file of walk(join(process.cwd(), dir))) {
        // The shared helper is the ONE place allowed to build the label; that is
        // the entire point of it. Excluded by exact path, not by a pattern that
        // could accidentally exempt a future file.
        if (file.endsWith(join('lib', 'campaign-lifecycle.ts'))) continue;
        const src = readFileSync(file, 'utf8');
        // A template literal that prints "<something> days left" is the shape
        // that shipped the contradiction. Comments quoting the bug are fine.
        for (const line of src.split('\n')) {
          if (/^\s*(\/\/|\*)/.test(line)) continue;
          // Any deadline arithmetic, not just the one phrasing that shipped.
          // The first guard only caught `${x} days left`; the homepage carried a
          // FIFTH copy that spelled it `${days} day${s} left` and slipped past.
          const printsDaysLeft = /\$\{[^}]*\}[^`'"]*days? left/.test(line);
          // Computing a DURATION from the deadline is the bug shape — that is
          // what becomes a countdown. A plain comparison
          // (`deadline.getTime() <= Date.now()`) is enforcement, not a label,
          // and /api/donations correctly pairs it with a `status !== 'active'`
          // check, so those are deliberately not flagged.
          const derivesFromDeadline =
            /deadline[^\n]*getTime\(\)\s*-/.test(line) || /-\s*new Date\([^)]*deadline/.test(line);
          if (printsDaysLeft || derivesFromDeadline) {
            offenders.push(`${file.replace(process.cwd(), '')}: ${line.trim().slice(0, 80)}`);
          }
        }
      }
    }

    expect(
      offenders,
      'Build the label with campaignTimeLabel() instead — it consults status, so it ' +
        'cannot print "N days left" beside "This campaign has ended".\n  ' +
        offenders.join('\n  '),
    ).toEqual([]);
  });
});
