import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../app/api/support-tickets/route.ts'),
  'utf8',
);

// Regression: `error` was destructured away from the support_cases insert, so a
// failed insert still returned { ok: true } + 201 with a null ticketId. The user
// was told their request was filed when no row existed.
describe('support ticket insert result is checked', () => {
  it('captures the insert error', () => {
    expect(SRC, 'must capture `error` from the insert')
      .toMatch(/const \{\s*data: ticket,\s*error: \w+\s*\}\s*=\s*await supabaseAdmin/);
  });

  it('fails the request instead of reporting success', () => {
    expect(SRC).toMatch(/TICKET_NOT_SAVED/);
    expect(SRC, 'must return a 5xx when the row was not written').toMatch(/status: 500/);
  });

  it('still notifies support so the request is not lost', () => {
    expect(SRC).toMatch(/\[UNSAVED\]/);
  });
});
