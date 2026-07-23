import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDemoSeedAllowed } from './seed-guard.mjs';

test('allows an explicitly enabled non-production seed run', () => {
  assert.doesNotThrow(() => assertDemoSeedAllowed({ NODE_ENV: 'development', CHARITME_ALLOW_DEMO_SEED: 'true' }));
});

test('blocks seed runs without the explicit flag', () => {
  assert.throws(() => assertDemoSeedAllowed({ NODE_ENV: 'development' }), /Demo seed blocked/);
});

test('blocks production even when the flag is present', () => {
  assert.throws(() => assertDemoSeedAllowed({ NODE_ENV: 'production', CHARITME_ALLOW_DEMO_SEED: 'true' }), /Demo seed blocked/);
});

test('production cannot be overridden by a lower-priority env file', () => {
  const envFile = { NODE_ENV: 'development', CHARITME_ALLOW_DEMO_SEED: 'true' };
  const runtime = { NODE_ENV: 'production' };
  assert.throws(() => assertDemoSeedAllowed({ ...envFile, ...runtime }), /Demo seed blocked/);
});
