import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({
  // MediaModule exports R2Service — reused here to stream avatar uploads.
  imports: [MediaModule, NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
