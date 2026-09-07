import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import type { Env } from './config/env';

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

  app.enableShutdownHooks();

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port);

  new Logger('Bootstrap').log(`API listening on http://localhost:${port}/api`);
}

void bootstrap();
