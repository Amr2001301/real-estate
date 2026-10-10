import { Module } from '@nestjs/common';
import { BrokerUsersService } from './broker-users.service';
import { BrokerUsersController } from './broker-users.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BrokerUsersController],
  providers: [BrokerUsersService],
  exports: [BrokerUsersService],
})
export class BrokerUsersModule {}
