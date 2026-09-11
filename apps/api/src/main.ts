import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { resolvePort, type Env } from './config/env';
import { MailService } from './mail/mail.service';
import { StorageService } from './storage/storage.service';

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
    setHeaders: (res) => {
      // Never let a stored file decide it is HTML or a script.
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Lets the admin read an uploaded image into a canvas to sample its
      // accent. Without it the canvas is tainted and getImageData throws.
      // These files are public either way, so nothing is exposed by it.
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
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

  // Surfaces a bad UPLOAD_DIR in the deploy log rather than on the first
  // upload attempt, which might be days later.
  await app.get(StorageService).verifyWritable();

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

  /*
   * Mail is checked after the port is open, and not awaited.
   *
   * It makes a network call to the mail provider, and a blocked or slow one
   * costs the full timeout — ten seconds during which the process is running
   * but not listening, so the platform's health check sees a dead app. Nothing
   * about serving the catalogue depends on the answer; it is diagnostics, and
   * diagnostics must not gate readiness.
   */
  void app
    .get(MailService)
    .verifyTransport()
    .catch((error) => {
      new Logger('Bootstrap').error(`Mail check failed: ${(error as Error).message}`);
    });
}

void bootstrap();
