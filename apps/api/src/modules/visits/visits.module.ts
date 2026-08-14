import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VisitsService } from './visits.service';
import { VisitsController } from './visits.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { CronLockModule } from '../../common/cron/cron-lock.module';
import { AppointmentReminderCron } from './appointment-reminder.cron';

@Module({
  imports: [NotificationsModule, CronLockModule, ConfigModule],
  controllers: [VisitsController],
  providers: [VisitsService, AppointmentReminderCron],
  exports: [VisitsService],
})
export class VisitsModule {}
