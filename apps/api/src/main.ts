import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { resolvePort, type Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Kept for any future provider that signs an HMAC over the exact bytes.
    // Flutterwave does not: its verif-hash is a static shared secret echoed
    // back verbatim, so it needs no raw body — which is precisely why every
    // webhook is independently re-verified against the provider.
    rawBody: true,
  });

  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix('api');

  /*
   * Uploaded artwork, served outside the /api prefix so the URLs stay clean.
   * Cached hard: filenames are randomly generated and a stored image is never
   * edited in place, so a URL always points at the same bytes.
   */
  app.useStaticAssets(config.get('UPLOAD_DIR', { infer: true }), {
    prefix: '/uploads/',
    immutable: true,
    maxAge: '365d',
    index: false,
    // Never let a stored file decide it is HTML or a script.
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });
  app.use(cookieParser());

  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    // The cart session cookie is httpOnly, so the browser must be allowed to
    // send it cross-origin.
    credentials: true,
  });

  /*
   * No global ValidationPipe.
   *
   * Nest's ValidationPipe needs class-validator and class-transformer as peer
   * dependencies, and throws at boot without them. It would also validate
   * nothing here: every request body and query is checked by ZodValidationPipe
   * against the schemas in @zhs/shared, and numeric coercion is handled by
   * z.coerce. Installing two packages to satisfy a pipe with no work to do
   * would be the wrong way round.
   */

  /*
   * Session cookies are marked Secure only when NODE_ENV is 'production'. A
   * host that leaves NODE_ENV blank therefore serves admin auth cookies
   * without the Secure flag over HTTPS — which fails silently and looks fine.
   * If the app is configured for an https origin, say so loudly at boot.
   */
  const webBaseUrl = config.get('WEB_BASE_URL', { infer: true });
  if (config.get('NODE_ENV', { infer: true }) !== 'production' && webBaseUrl.startsWith('https://')) {
    new Logger('Bootstrap').warn(
      `NODE_ENV is not "production" but WEB_BASE_URL is ${webBaseUrl}. ` +
        'Session cookies will NOT be marked Secure. Set NODE_ENV=production.',
    );
  }

  app.enableShutdownHooks();

  const port = resolvePort({
    PORT: config.get('PORT', { infer: true }),
    API_PORT: config.get('API_PORT', { infer: true }),
  } as Env);

  // 0.0.0.0, not the Node default of localhost: a container that binds the
  // loopback interface is unreachable from outside itself, so the platform's
  // health check fails against a perfectly healthy process.
  await app.listen(port, '0.0.0.0');

  new Logger('Bootstrap').log(`API listening on port ${port}`);
}

void bootstrap();
