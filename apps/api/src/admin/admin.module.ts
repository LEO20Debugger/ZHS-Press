import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminProductsService } from './admin-products.service';
import { AuditService } from './audit.service';
import { ParityService } from './parity.service';
import { WaitlistNotifier } from './waitlist-notifier.service';

@Module({
  controllers: [AdminController],
  providers: [AdminProductsService, AuditService, ParityService, WaitlistNotifier],
})
export class AdminModule {}
