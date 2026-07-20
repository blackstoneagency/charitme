import { z } from 'zod';

/**
 * Central environment-variable schema + validation.
 *
 * Two goals:
 *  1. A single, documented source of truth for every env var the app reads,
 *     split by trust level (public vs server-only secret vs server config).
 *  2. A *non-throwing* validator (`validateEnv`) so CI / a deploy preflight can
 *     report every problem at once, without importing this module crashing a
 *     build. Individual clients keep their own graceful fallbacks; this schema
 *     is the auditable contract, not a hard boot gate.
 *
 * SECURITY: only `NEXT_PUBLIC_*` values may ever reach the browser bundle. The
 * `SERVER_SECRET_KEYS` list below is enforced by
 * `__tests__/secret-exposure.test.ts`, which fails the build if any of these
 * names appears in a client (`'use client'`) module.
 */

const nonEmpty = z.string().trim().min(1);
const optionalStr = z.string().trim().min(1).optional();

/** Values that are safe to expose to the browser (must be prefixed NEXT_PUBLIC_). */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: nonEmpty.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty,
  NEXT_PUBLIC_APP_URL: nonEmpty.url().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalStr,
  NEXT_PUBLIC_FACEBOOK_APP_ID: optionalStr,
});

/** Server-only secrets. NEVER reference these from a client component. */
export const serverSecretSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty,
  STRIPE_SECRET_KEY: optionalStr,
  STRIPE_WEBHOOK_SECRET: optionalStr,
  STRIPE_CONNECT_WEBHOOK_SECRET: optionalStr,
  SUPABASE_ACCESS_TOKEN: optionalStr,
  RESEND_API_KEY: optionalStr,
  OPENAI_API_KEY: optionalStr,
  OPENCORPORATES_API_TOKEN: optionalStr,
  CRON_SECRET: optionalStr,
});

/** Server-side, non-secret configuration. */
export const serverConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  EMAIL_FROM: optionalStr,
  SUPPORT_EMAIL: optionalStr,
  CONTACT_EMAIL: optionalStr,
  ADMIN_EMAILS: optionalStr,
  OPENAI_MODEL: optionalStr,
  DEFAULT_DONOR_TIP_PERCENT: z.coerce.number().min(0).max(100).optional(),
  STRIPE_STARTER_MONTHLY_PRICE_ID: optionalStr,
  STRIPE_STARTER_YEARLY_PRICE_ID: optionalStr,
  STRIPE_PRO_MONTHLY_PRICE_ID: optionalStr,
  STRIPE_PRO_YEARLY_PRICE_ID: optionalStr,
});

/** The exact set of names that must never appear in a client bundle. */
export const SERVER_SECRET_KEYS = Object.keys(serverSecretSchema.shape) as string[];

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerSecretEnv = z.infer<typeof serverSecretSchema>;
export type ServerConfigEnv = z.infer<typeof serverConfigSchema>;

export type EnvIssue = { key: string; message: string };
export type EnvReport = {
  ok: boolean;
  /** Issues that should block a production deploy. */
  errors: EnvIssue[];
  /** Missing-but-optional values (feature-degrading, not fatal). */
  warnings: EnvIssue[];
};

/**
 * Vars that are required for a *production* deploy specifically (beyond the
 * schema's hard-required fields, which are required everywhere).
 */
const PROD_REQUIRED = [
  'NEXT_PUBLIC_APP_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
] as const;

function collectIssues(
  schema: z.ZodObject<z.ZodRawShape>,
  source: Record<string, string | undefined>,
): EnvIssue[] {
  const result = schema.safeParse(source);
  if (result.success) return [];
  return result.error.issues.map((i) => ({
    key: String(i.path[0] ?? '(unknown)'),
    message: i.message,
  }));
}

/**
 * Validate the current environment without throwing. Pass `{ production: true }`
 * to also require the prod-only vars. Returns a structured report so a caller
 * (CI preflight, health route) can present everything at once.
 */
export function validateEnv(
  source: NodeJS.ProcessEnv = process.env,
  opts: { production?: boolean } = {},
): EnvReport {
  const isProd = opts.production ?? source.NODE_ENV === 'production';

  const errors: EnvIssue[] = [
    ...collectIssues(publicEnvSchema, source),
    ...collectIssues(serverSecretSchema, source),
    ...collectIssues(serverConfigSchema, source),
  ];

  const warnings: EnvIssue[] = [];
  for (const key of PROD_REQUIRED) {
    const present = (source[key] ?? '').toString().trim().length > 0;
    if (present) continue;
    const issue = { key, message: `${key} is required in production` };
    if (isProd) errors.push(issue);
    else warnings.push(issue);
  }

  return { ok: errors.length === 0, errors, warnings };
}
