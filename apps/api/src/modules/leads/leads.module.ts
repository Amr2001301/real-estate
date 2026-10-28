import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { LeadScopeGuard } from './guards/lead-scope.guard';
import { FollowUpReminderCron } from './follow-up-reminder.cron';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadScopeGuard, FollowUpReminderCron],
  exports: [LeadsService],
})
export class LeadsModule {}
