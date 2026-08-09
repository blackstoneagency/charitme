import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, '..', p), 'utf8');
const raw = read('app/campaigns/[slug]/DonateButton.tsx');
/** The comment explains the removal and therefore names what was removed. */
const code = raw
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// ─────────────────────────────────────────────────────────────────────────────
// "Dedicate this donation (optional)" was removed from the campaign page's
// donate form on request.
//
// The important half is what did NOT change: the dedication was never a column.
// It was composed into `message`, which is still collected and still posted, so
// existing donations carrying a composed dedication still read correctly on the
// donor wall. Removing the input must not remove the message.
// ─────────────────────────────────────────────────────────────────────────────

describe('the dedication field is gone from the campaign donate form', () => {
  it('renders no dedication control', () => {
    expect(code).not.toMatch(/donor-dedication/);
    expect(code).not.toMatch(/No dedication/);
    expect(code).not.toMatch(/Dedicate this donation/);
  });

  it('keeps no dead state for it', () => {
    for (const sym of ['dedicationKind', 'honoreeName', 'dedicatedMessage', 'composeDedicatedMessage', 'isValidDedication', 'DEDICATION_KINDS']) {
      expect(code, `${sym} is left over`).not.toMatch(new RegExp(`\\b${sym}\\b`));
    }
  });
});

describe('the message of support still works', () => {
  it('still collects a message', () => {
    // The dedication was folded INTO this field. Removing the message too would
    // silently drop what donors write on the donor wall.
    expect(code).toMatch(/id="donor-message"/);
    expect(code).toMatch(/Leave a message of support/);
  });

  it('posts the plain message, with empty still meaning absent', () => {
    // `message.trim() ? message : undefined` — an all-whitespace message must
    // not become an empty donor-wall entry.
    expect(code).toMatch(/message: message\.trim\(\) \? message : undefined/);
  });
});

describe('the shared donation-flow module is untouched', () => {
  it('still exports the dedication helpers for the guided flow', () => {
    // /donate/[slug] still uses them. Deleting the module because one caller
    // stopped importing it would break a different page.
    const core = read('lib/donation-flow-core.ts');
    expect(core).toMatch(/export function composeDedicatedMessage/);
    expect(read('app/donate/[slug]/GuidedDonation.tsx')).toMatch(/composeDedicatedMessage/);
  });
});
