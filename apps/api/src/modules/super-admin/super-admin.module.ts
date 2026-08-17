import { Module } from '@nestjs/common';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { SubscriptionExpiryCron } from './subscription-expiry.cron';

@Module({
  controllers: [SuperAdminController],
  providers: [SuperAdminService, SubscriptionExpiryCron],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
