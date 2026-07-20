import { describe, it, expect } from 'vitest';
import { validateEnv, SERVER_SECRET_KEYS } from '../lib/env';

const base = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://proj.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

describe('validateEnv', () => {
  it('passes with the minimum required (non-production)', () => {
    const r = validateEnv({ ...base, NODE_ENV: 'development' });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('flags a missing hard-required var', () => {
    const { NEXT_PUBLIC_SUPABASE_URL: _omit, ...missing } = base;
    void _omit;
    const r = validateEnv({ ...missing, NODE_ENV: 'development' });
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.key)).toContain('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('rejects a malformed URL', () => {
    const r = validateEnv({ ...base, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url', NODE_ENV: 'development' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.key === 'NEXT_PUBLIC_SUPABASE_URL')).toBe(true);
  });

  it('treats prod-required vars as warnings in dev, errors in prod', () => {
    const dev = validateEnv({ ...base, NODE_ENV: 'development' });
    expect(dev.ok).toBe(true);
    expect(dev.warnings.map((w) => w.key)).toContain('STRIPE_SECRET_KEY');

    const prod = validateEnv({ ...base, NODE_ENV: 'production' });
    expect(prod.ok).toBe(false);
    expect(prod.errors.map((e) => e.key)).toContain('STRIPE_SECRET_KEY');
    expect(prod.errors.map((e) => e.key)).toContain('NEXT_PUBLIC_APP_URL');
  });

  it('accepts a full production environment', () => {
    const r = validateEnv({
      ...base,
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://www.charitme.com',
      STRIPE_SECRET_KEY: 'sk_live_x',
      STRIPE_WEBHOOK_SECRET: 'whsec_x',
    });
    expect(r.ok).toBe(true);
  });

  it('validates DEFAULT_DONOR_TIP_PERCENT is a 0–100 number', () => {
    const bad = validateEnv({ ...base, NODE_ENV: 'development', DEFAULT_DONOR_TIP_PERCENT: '250' });
    expect(bad.ok).toBe(false);
    const good = validateEnv({ ...base, NODE_ENV: 'development', DEFAULT_DONOR_TIP_PERCENT: '15' });
    expect(good.ok).toBe(true);
  });

  it('exposes the server-secret key list used by the exposure guard', () => {
    expect(SERVER_SECRET_KEYS).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(SERVER_SECRET_KEYS).toContain('STRIPE_SECRET_KEY');
    expect(SERVER_SECRET_KEYS).not.toContain('NEXT_PUBLIC_SUPABASE_URL');
  });
});
