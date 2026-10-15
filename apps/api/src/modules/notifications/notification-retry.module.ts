import { Module } from '@nestjs/common';
import { NotificationsModule } from './notifications.module';
import { NotificationRetryCron } from './notification-retry.cron';

/** Separate from NotificationsModule: the cron imports that module's file. */
@Module({
  imports: [NotificationsModule],
  providers: [NotificationRetryCron],
})
export class NotificationRetryModule {}
