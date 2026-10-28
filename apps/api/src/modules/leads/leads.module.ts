import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { LeadScopeGuard } from './guards/lead-scope.guard';
import { FollowUpReminderCron } from './follow-up-reminder.cron';
import { LeadDuplicatesService } from './lead-duplicates.service';
import { LeadCalendarService } from './lead-calendar.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadScopeGuard, FollowUpReminderCron, LeadDuplicatesService, LeadCalendarService],
  exports: [LeadsService],
})
export class LeadsModule {}
