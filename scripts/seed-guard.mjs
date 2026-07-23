const DEMO_SEED_FLAG = 'CHARITME_ALLOW_DEMO_SEED';

export function assertDemoSeedAllowed(env = process.env) {
  const nodeEnv = String(env.NODE_ENV ?? '').trim().toLowerCase();
  const explicitlyAllowed = env[DEMO_SEED_FLAG] === 'true';

  if (nodeEnv === 'production' || !explicitlyAllowed) {
    throw new Error(
      `Demo seed blocked. Run only against a disposable staging/demo project with ${DEMO_SEED_FLAG}=true.`
    );
  }
}
