import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CaptureModule } from './capture/capture.module';
import { CartModule } from './cart/cart.module';
import { CheckoutModule } from './checkout/checkout.module';
import { DbModule } from './db/db.module';
import { HealthController } from './health/health.controller';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env', '../../.env'],
      validate: validateEnv,
    }),
    DbModule,
    ProductsModule,
    CaptureModule,
    CartModule,
    CheckoutModule,
    AuthModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
