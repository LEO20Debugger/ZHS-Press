import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { ContentController } from './content.controller';

@Module({
  imports: [AdminModule],
  controllers: [ContentController],
})
export class ContentModule {}
