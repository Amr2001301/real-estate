import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LaunchesController } from './launches.controller';
import { LaunchesService } from './launches.service';

@Module({
  imports: [NotificationsModule],
  controllers: [LaunchesController],
  providers: [LaunchesService],
})
export class LaunchesModule {}
