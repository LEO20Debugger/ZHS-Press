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
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
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

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

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
