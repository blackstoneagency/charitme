export function assertDemoSeedAllowed(env = process.env) {
  if (env.NODE_ENV === 'production') {
    throw new Error('Demo seed blocked in production. Use a disposable staging/demo project.');
  }
  if (env.CHARITME_ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Demo seed blocked. Set CHARITME_ALLOW_DEMO_SEED=true only for a disposable staging/demo project.');
  }
}
