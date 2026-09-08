import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { resolvePort, type Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Kept for any future provider that signs an HMAC over the exact bytes.
    // Flutterwave does not: its verif-hash is a static shared secret echoed
    // back verbatim, so it needs no raw body — which is precisely why every
    // webhook is independently re-verified against the provider.
    rawBody: true,
  });

  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix('api');
  app.use(cookieParser());

  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    // The cart session cookie is httpOnly, so the browser must be allowed to
    // send it cross-origin.
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

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
