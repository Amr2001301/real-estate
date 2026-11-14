import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UnitsModule } from '../units/units.module';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ListingTermsService } from './listing-terms.service';
import { ListingRemindersCron } from './listing-reminders.cron';
import { ListingMatchingService } from './listing-matching.service';

@Module({
  imports: [UnitsModule, MediaModule, NotificationsModule],
  controllers: [ListingsController],
  providers: [ListingsService, ListingTermsService, ListingRemindersCron, ListingMatchingService],
  exports: [ListingsService, ListingTermsService],
})
export class ListingsModule {}
