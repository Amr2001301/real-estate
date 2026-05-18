import { Module } from '@nestjs/common';
import { BrokerUsersService } from './broker-users.service';
import { BrokerUsersController } from './broker-users.controller';

@Module({
  controllers: [BrokerUsersController],
  providers: [BrokerUsersService],
  exports: [BrokerUsersService],
})
export class BrokerUsersModule {}
