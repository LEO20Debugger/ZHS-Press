import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminProductsService } from './admin-products.service';
import { AuditService } from './audit.service';
import { ContributorsService } from './contributors.service';
import { PagesService } from './pages.service';
import { ParityService } from './parity.service';
import { WaitlistNotifier } from './waitlist-notifier.service';

@Module({
  controllers: [AdminController],
  exports: [PagesService],
  providers: [AdminProductsService, AuditService, ParityService, WaitlistNotifier, ContributorsService, PagesService],
})
export class AdminModule {}
