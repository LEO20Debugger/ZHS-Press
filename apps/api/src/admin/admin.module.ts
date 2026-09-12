import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminProductsService } from './admin-products.service';
import { AudienceService } from './audience.service';
import { AuditService } from './audit.service';
import { ContributorsService } from './contributors.service';
import { ParityService } from './parity.service';
import { WaitlistNotifier } from './waitlist-notifier.service';

@Module({
  controllers: [AdminController],
  providers: [
    AdminProductsService,
    AuditService,
    ParityService,
    WaitlistNotifier,
    ContributorsService,
    AudienceService,
  ],
})
export class AdminModule {}
