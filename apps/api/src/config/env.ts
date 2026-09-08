import { z } from 'zod';

/**
 * Environment validation.
 *
 * Parsed once at boot and the process refuses to start if anything required is
 * missing. A misconfigured payment secret should fail loudly on deploy, not
 * silently at the moment a customer tries to pay.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /**
   * Most managed hosts (Railway, Render, Heroku) assign a port through `PORT`
   * and health-check that exact port. Binding anything else means the app runs
   * fine and the platform still reports it as unhealthy.
   *
   * `PORT` wins where the platform sets it; `API_PORT` stays for local use.
   */
  PORT: z.coerce.number().int().positive().optional(),
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        // A browser sends Origin with no path, so "https://site.com/" never
        // matches and every request is blocked — with an error that points at
        // CORS rather than at the stray slash. Strip it rather than rely on
        // whoever fills in the dashboard.
        .map((origin) => origin.replace(/\/+$/, ''))
        .filter(Boolean),
    ),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  /**
   * Required, and long. This signs admin access tokens; a short or guessable
   * value means anyone can mint themselves an admin session. Generate with:
   *   openssl rand -base64 48
   */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  WEB_BASE_URL: z.string().url().default('http://localhost:3000'),

  // Payment configuration is optional at boot so the catalogue can be built and
  // reviewed before the Flutterwave account is confirmed. CheckoutService
  // asserts these are present the moment it is actually used — see
  // requirePaymentConfig() below.
  FLW_PUBLIC_KEY: z.string().optional(),
  FLW_SECRET_KEY: z.string().optional(),
  FLW_SECRET_HASH: z.string().optional(),
  FLW_BASE_URL: z.string().url().default('https://api.flutterwave.com/v3'),
});

export type Env = z.infer<typeof envSchema>;

/** The port to bind: the platform's assignment if present, else the local default. */
export function resolvePort(env: Env): number {
  return env.PORT ?? env.API_PORT;
}

/**
 * Drops keys whose value is an empty string.
 *
 * Zod's `.default()` and `.optional()` only apply to `undefined`. An empty
 * string is a *present* value, so it gets validated and rejected — which is
 * how a blank NODE_ENV injected by the host takes down a boot that should have
 * fallen back to the default.
 *
 * Deployment platforms, Docker and CI runners all set empty variables freely,
 * so an unset variable and a blank one are treated the same here.
 */
function withoutBlanks(raw: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim() === '') continue;
    cleaned[key] = value;
  }
  return cleaned;
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(withoutBlanks(raw));

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}

export interface PaymentConfig {
  publicKey: string;
  secretKey: string;
  secretHash: string;
  baseUrl: string;
}

/**
 * Payments cannot run half-configured.
 *
 * FLW_SECRET_HASH in particular is not optional in any meaningful sense: it is
 * the only thing separating a real webhook from anyone on the internet who can
 * reach the endpoint and would like their order marked paid.
 */
export function requirePaymentConfig(env: Env): PaymentConfig {
  const missing = (
    ['FLW_PUBLIC_KEY', 'FLW_SECRET_KEY', 'FLW_SECRET_HASH'] as const
  ).filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Payments are not configured. Missing: ${missing.join(', ')}. ` +
        'Checkout is disabled until these are set.',
    );
  }

  return {
    publicKey: env.FLW_PUBLIC_KEY as string,
    secretKey: env.FLW_SECRET_KEY as string,
    secretHash: env.FLW_SECRET_HASH as string,
    baseUrl: env.FLW_BASE_URL,
  };
}
